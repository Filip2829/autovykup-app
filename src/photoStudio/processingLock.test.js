import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireProcessingLock, lockLifetimeMs } from '../../supabase/functions/vehicle-photo-studio/processingLock.js';

function storage() {
  const objects = new Map(), timestamps = new Map();
  return { objects, timestamps, bucket: {
    upload: async (path, blob) => { if (objects.has(path)) return { error: new Error('duplicate') }; objects.set(path, blob); return { data: {} }; },
    download: async path => objects.has(path) ? { data: objects.get(path) } : { error: new Error('missing') },
    remove: async paths => { paths.forEach(path => objects.delete(path)); return { data: {} }; },
    list: async folder => ({ data: [...objects.keys()].filter(path => path.startsWith(`${folder}/`)).map(path => ({ name: path.slice(folder.length + 1), created_at: timestamps.get(path) })) }),
  } };
}

test('live locks exclude concurrent edits and release only their own generation', async () => {
  const f = storage(), path = 'photos/id-lock', now = Date.now();
  const release = await acquireProcessingLock(f.bucket, path, now);
  assert.equal(typeof release, 'function');
  assert.equal(await acquireProcessingLock(f.bucket, path, now + 1000), null);
  f.objects.set(path, new Blob(['replacement']));
  await release();
  assert.equal(await f.objects.get(path).text(), 'replacement');
});

test('a crashed job expires safely and only one simultaneous retry acquires it', async () => {
  const f = storage(), path = 'photos/id-lock', now = Date.now();
  await acquireProcessingLock(f.bucket, path, now - lockLifetimeMs - 1);
  const contenders = await Promise.all([acquireProcessingLock(f.bucket, path, now), acquireProcessingLock(f.bucket, path, now)]);
  assert.equal(contenders.filter(Boolean).length, 1);
  await contenders.find(Boolean)();
  assert.equal(f.objects.size, 0);
});

test('legacy locks recover using storage creation date; unknown age never steals a job', async () => {
  const f = storage(), path = 'photos/id-lock', now = Date.now();
  f.objects.set(path, new Blob(['processing']));
  assert.equal(await acquireProcessingLock(f.bucket, path, now), null);
  f.timestamps.set(path, new Date(now - lockLifetimeMs - 1).toISOString());
  const release = await acquireProcessingLock(f.bucket, path, now);
  assert.equal(typeof release, 'function');
  await release();
  assert.equal(f.objects.size, 0);
});

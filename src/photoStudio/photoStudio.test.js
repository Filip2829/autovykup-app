import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoto, editPrompt, exportName } from './model.js';
import { makeZip } from './zip.js';
import { createPhotoStudioHandler } from '../../supabase/functions/vehicle-photo-studio/handler.js';

test('upload rejects unsupported and oversized images', () => {
  assert.throws(() => validatePhoto({ type: 'image/heic', size: 100 }));
  assert.throws(() => validatePhoto({ type: 'image/jpeg', size: 13 * 1024 * 1024 }));
  assert.doesNotThrow(() => validatePhoto({ type: 'image/jpeg', size: 100 }));
});
test('edits preserve vehicle identity and evidence; reject arbitrary prompt inputs', () => {
  assert.match(editPrompt('frontLeft', 'gray'), /Never repair/);
  assert.match(editPrompt('interior', 'white'), /do not replace any background/);
  assert.match(editPrompt('detail', 'gray'), /do not crop away evidence/);
  assert.throws(() => editPrompt('invent a vehicle', 'gray'));
  assert.equal(exportName(0, 'frontLeft'), '01-frontLeft.jpg');
});
test('ZIP contains valid CRC32, directory and UTF-8 filenames', async () => {
  const bytes = new Uint8Array(await makeZip([{ name: '01-front.jpg', bytes: new TextEncoder().encode('123456789') }]).arrayBuffer());
  const v = new DataView(bytes.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(14, true), 0xcbf43926);
  assert.equal(v.getUint32(bytes.length - 22, true), 0x06054b50);
  const central = v.getUint32(bytes.length - 6, true);
  assert.equal(v.getUint32(central, true), 0x02014b50);
  assert.equal(v.getUint16(6, true), 0x800);
});
function fixture({ authenticated = true, staff = true, failAi = false } = {}) {
  const objects = new Map(); let calls = 0;
  const bucket = {
    upload: async (path, data, options = {}) => {
      if (objects.has(path) && !options.upsert) return { error: new Error('duplicate') };
      objects.set(path, data instanceof Blob ? data : new Blob([data])); return { data: {} };
    },
    download: async path => objects.has(path) ? { data: objects.get(path) } : { error: new Error('missing') },
    remove: async paths => { paths.forEach(p => objects.delete(p)); return { data: {} }; },
    list: async (_, { search }) => ({ data: [...objects.keys()].filter(p => p.split('/')[1].startsWith(search)).map(p => ({ name: p.split('/')[1] })) }),
    getPublicUrl: path => ({ data: { publicUrl: `https://test.example/${path}` } }),
  };
  const db = { storage: { from: () => bucket }, auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'staff-id' } : null } }) }, from: table => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'cars' ? { id: 1 } : staff ? { user_id: 'staff-id' } : null }) }) }) }) };
  const handler = createPhotoStudioHandler({ db, apiKey: 'test', fetchImage: async () => { calls++; return new Response(JSON.stringify({ data: [{ b64_json: btoa('image bytes') }] }), { status: failAi ? 429 : 200 }); } });
  return { objects, calls: () => calls, async request(action, values = {}) {
    const form = new FormData(); form.set('carId', '1'); form.set('action', action);
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: form }));
  } };
}
test('authentication and staff membership are checked before any storage operation', async () => {
  for (const [config, status] of [[{ authenticated: false }, 401], [{ staff: false }, 403]]) {
    const f = fixture(config); assert.equal((await f.request('list')).status, status); assert.equal(f.objects.size, 0);
  }
});
test('upload → process → approve → reload persists originals and results, repeat costs nothing', async () => {
  const f = fixture();
  const uploaded = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'frontLeft', background: 'gray' })).json();
  const id = uploaded.item.id;
  assert.equal((await f.request('approve', { id, approved: 'true' })).status, 400);
  const processed = await (await f.request('process', { id })).json();
  assert.equal(processed.item.ready, true);
  await f.request('process', { id }); assert.equal(f.calls(), 1);
  await f.request('approve', { id, approved: 'true' });
  const listed = await (await f.request('list')).json();
  assert.equal(listed.items.length, 1); assert.equal(listed.items[0].approved, true);
  assert.equal(await f.objects.get(`photo-studio/1-${id}-original`).text(), 'original');
  assert.ok(![...f.objects.keys()].some(p => p.endsWith('-lock')));
});
test('AI failure retains original and releases lock for retry', async () => {
  const f = fixture({ failAi: true });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.png', { type: 'image/png' }), angle: 'detail', background: 'white' })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 502);
  const { items } = await (await f.request('list')).json();
  assert.equal(items[0].ready, false);
  assert.ok(![...f.objects.keys()].some(p => p.endsWith('-lock')));
});

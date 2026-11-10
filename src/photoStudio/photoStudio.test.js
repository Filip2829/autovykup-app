import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoto, editPrompt, exportName, backgrounds, backgroundReference } from './model.js';
import { validatePlates, paintPlateLogos } from './plates.js';
import { detectPlates } from '../../supabase/functions/vehicle-photo-studio/plateDetection.js';
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
function fixture({ authenticated = true, staff = true, failAi = false, failBackground = false } = {}) {
  const objects = new Map(); let calls = 0; const aiRequests = [], backgroundRequests = [];
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
  const handler = createPhotoStudioHandler({ db, apiKey: 'test',
    fetchImage: async (_, options) => { calls++; aiRequests.push(options.body); return new Response(JSON.stringify({ data: [{ b64_json: btoa('image bytes') }] }), { status: failAi ? 429 : 200 }); },
    fetchBackground: async url => { backgroundRequests.push(url); return new Response(new Blob(['background'], { type: 'image/png' }), { status: failBackground ? 404 : 200 }); },
    fetchVision: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ status: 'located', plates: [samplePlate] }) } }] })),
  });
  return { objects, aiRequests, backgroundRequests, calls: () => calls, async request(action, values = {}) {
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
  assert.equal((await f.request('approve', { id, approved: 'true' })).status, 400);
  await f.request('plate', { id, plates: JSON.stringify([samplePlate]) });
  await f.request('approve', { id, approved: 'true' });
  const listed = await (await f.request('list')).json();
  assert.equal(listed.items.length, 1); assert.equal(listed.items[0].approved, true);
  assert.equal(await f.objects.get(`photo-studio/1-${id}-original`).text(), 'original');
  assert.ok(![...f.objects.keys()].some(p => p.endsWith('-lock')));
});
const samplePlate = [{ x: .4, y: .6 }, { x: .6, y: .62 }, { x: .59, y: .67 }, { x: .4, y: .65 }];
test('branded presets send a real background image, neutral and interior edits do not', async () => {
  assert.equal(Object.keys(backgrounds).length, 6);
  for (const [angle, background, count] of [['frontLeft', 'opportunityGraphite', 2], ['interior', 'opportunityWhite', 1], ['detail', 'opportunityShowroom', 1], ['front', 'gray', 1]]) {
    const f = fixture();
    const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle, background })).json();
    assert.equal((await f.request('process', { id: item.id })).status, 200);
    assert.equal(f.aiRequests[0].getAll('image[]').length, count);
    assert.equal(f.backgroundRequests.length, count - 1);
    if (count === 2) assert.match(f.aiRequests[0].get('prompt'), /Image 2 is the selected empty Opportunity Graphite/);
  }
  assert.equal(backgroundReference('front', 'opportunityWhite'), '/photo-studio/opportunity-white.png');
  assert.equal(backgroundReference('interior', 'opportunityWhite'), null);
  assert.throws(() => backgroundReference('front', 'https://evil.test/image.png'));
  assert.doesNotMatch(editPrompt('interior', 'opportunityWhite'), /OPPORTUNITY/);
});
test('missing reference blocks AI edit, preserves original and releases lock', async () => {
  const f = fixture({ failBackground: true });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'opportunityWhite' })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 502);
  assert.equal(f.calls(), 0);
  assert.ok(f.objects.has(`photo-studio/1-${item.id}-original`));
  assert.ok(![...f.objects.keys()].some(p => p.endsWith('-lock')));
});
test('plate validation rejects crossed, inverted, excessive and out-of-image areas', () => {
  assert.doesNotThrow(() => validatePlates([samplePlate]));
  assert.throws(() => validatePlates([[samplePlate[0], samplePlate[2], samplePlate[1], samplePlate[3]]]));
  assert.throws(() => validatePlates([[{ x: -1, y: .2 }, ...samplePlate.slice(1)]]));
  assert.throws(() => validatePlates([[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]]));
  assert.throws(() => validatePlates(Array(6).fill(samplePlate)));
});
test('perspective logo paints only the selected plate and is completely opaque', () => {
  const image = { width: 100, height: 100, data: new Uint8ClampedArray(40000).fill(200) };
  const logo = { width: 2, height: 1, data: new Uint8ClampedArray([20, 21, 22, 0, 250, 251, 252, 0]) };
  const quad = [{ x: .2, y: .3 }, { x: .8, y: .35 }, { x: .7, y: .5 }, { x: .25, y: .45 }];
  paintPlateLogos(image, logo, [quad]);
  const pixel = (x, y) => Array.from(image.data.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 4));
  assert.deepEqual(pixel(5, 5), [200, 200, 200, 200]);
  assert.deepEqual(pixel(22, 48), [200, 200, 200, 200]); // Outside slanted quadrilateral, inside its bounding box.
  assert.deepEqual(pixel(35, 38), [20, 21, 22, 255]);
  assert.deepEqual(pixel(65, 40), [250, 251, 252, 255]);
});
test('failed or invalid AI plate detection always requires manual review', async () => {
  assert.equal((await detectPlates('fake', 'test', async () => new Response('', { status: 429 }))).plateVerified, false);
  assert.equal((await detectPlates('fake', 'test', async () => { throw new Error('offline'); })).plateStatus, 'review');
});
test('manual plate confirmation persists, invalid geometry is rejected, correction revokes approval', async () => {
  const f = fixture();
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'gray' })).json();
  await f.request('process', { id: item.id });
  assert.equal((await f.request('plate', { id: item.id, plates: '[null]' })).status, 400);
  await f.request('plate', { id: item.id, plates: JSON.stringify([samplePlate]) });
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 200);
  await f.request('plate', { id: item.id, plates: '[]' });
  const { items } = await (await f.request('list')).json();
  assert.equal(items[0].plateVerified, true); assert.equal(items[0].approved, false); assert.deepEqual(items[0].plates, []);
});
test('AI failure retains original and releases lock for retry', async () => {
  const f = fixture({ failAi: true });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.png', { type: 'image/png' }), angle: 'detail', background: 'white' })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 502);
  const { items } = await (await f.request('list')).json();
  assert.equal(items[0].ready, false);
  assert.ok(![...f.objects.keys()].some(p => p.endsWith('-lock')));
});

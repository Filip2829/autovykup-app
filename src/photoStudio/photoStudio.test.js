import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoto, editPrompt, exportName, backgrounds, backgroundReference, needsPlateUpdate, canExportPhoto } from './model.js';
import { validatePlates, paintPlateLogos, makePlateLogo } from './plates.js';
import { detectPlates } from '../../supabase/functions/vehicle-photo-studio/plateDetection.js';
import { makeZip } from './zip.js';
import { createPhotoStudioHandler } from '../../supabase/functions/vehicle-photo-studio/handler.js';
import { checkPlateRegion, cropPlateRegion, renderMaskedJpeg } from '../../supabase/functions/vehicle-photo-studio/imageCodec.js';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

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
function fixture({ authenticated = true, staff = true, failAi = false, failBackground = false, failRemove = false, failRenderOnce = false, detection = 'located', actualRender = false, imageBytes = new TextEncoder().encode('image bytes') } = {}) {
  const objects = new Map(); let calls = 0, removeFailure = failRemove; const aiRequests = [], backgroundRequests = [], renders = [];
  const bucket = {
    upload: async (path, data, options = {}) => {
      if (objects.has(path) && !options.upsert) return { error: new Error('duplicate') };
      objects.set(path, data instanceof Blob ? data : new Blob([data])); return { data: {} };
    },
    download: async path => objects.has(path) ? { data: objects.get(path) } : { error: new Error('missing') },
    remove: async paths => { if (removeFailure && !paths.every(p => p.endsWith('-lock'))) return { error: new Error('storage unavailable') }; paths.forEach(p => objects.delete(p)); return { data: {} }; },
    list: async (_, { search }) => ({ data: [...objects.keys()].filter(p => p.split('/')[1].startsWith(search)).map(p => ({ name: p.split('/')[1] })) }),
    getPublicUrl: path => ({ data: { publicUrl: `https://test.example/${path}` } }),
  };
  const db = { storage: { from: () => bucket }, auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'staff-id' } : null } }) }, from: table => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'cars' ? { id: 1 } : staff ? { user_id: 'staff-id' } : null }) }) }) }) };
  const handler = createPhotoStudioHandler({ db, apiKey: 'test',
    fetchImage: async (_, options) => { calls++; aiRequests.push(options.body); return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }] }), { status: failAi ? 429 : 200 }); },
    fetchBackground: async url => { backgroundRequests.push(url); const data = url.endsWith('opportunity-logo.png') ? readFileSync(new URL('../../public/photo-studio/opportunity-logo.png', import.meta.url)) : 'background'; return new Response(new Blob([data], { type: 'image/png' }), { status: failBackground ? 404 : 200 }); },
    fetchVision: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ status: detection, plates: detection === 'located' ? [samplePlate] : [] }) } }] })),
    cropPlateRegion: base64 => ({ base64, left: 0, top: 0, width: 1, height: 1 }),
    checkPlateRegion: () => true,
    renderMaskedJpeg: (bytes, plates, logo) => { renders.push({ bytes, plates }); if (failRenderOnce && renders.length === 1) throw new Error('temporary render failure'); return actualRender ? renderMaskedJpeg(bytes, plates, logo) : new TextEncoder().encode('masked result'); },
  });
  return { objects, aiRequests, backgroundRequests, renders, calls: () => calls, allowRemove: () => { removeFailure = false; }, async request(action, values = {}) {
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
  assert.equal(processed.item.plateVerified, true);
  assert.equal(processed.item.plateRendered, true);
  assert.equal(processed.item.plateStatus, 'automatic');
  assert.equal(await f.objects.get(`photo-studio/1-${id}-result.jpg`).text(), 'masked result');
  assert.equal(await f.objects.get(`photo-studio/1-${id}-base.jpg`).text(), 'image bytes');
  await f.request('approve', { id, approved: 'true' });
  const listed = await (await f.request('list')).json();
  assert.equal(listed.items.length, 1); assert.equal(listed.items[0].approved, true);
  assert.equal(await f.objects.get(`photo-studio/1-${id}-original`).text(), 'original');
  assert.ok(![...f.objects.keys()].some(p => p.endsWith('-lock')));
});
const samplePlate = [{ x: .4, y: .6 }, { x: .6, y: .62 }, { x: .59, y: .67 }, { x: .4, y: .65 }];
test('branded presets send a real background image, neutral and interior edits do not', async () => {
  assert.equal(Object.keys(backgrounds).length, 7);
  for (const [angle, background, count] of [['frontLeft', 'opportunityGraphite', 2], ['frontLeft', 'opportunityWorkshop', 2], ['interior', 'opportunityWhite', 1], ['detail', 'opportunityShowroom', 1], ['front', 'gray', 1]]) {
    const f = fixture();
    const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle, background })).json();
    assert.equal((await f.request('process', { id: item.id })).status, 200);
    assert.equal(f.aiRequests[0].getAll('image[]').length, count);
    assert.equal(f.backgroundRequests.filter(url => !url.endsWith('opportunity-logo.png')).length, count - 1);
    if (count === 2) assert.match(f.aiRequests[0].get('prompt'), new RegExp(`Image 2 is the selected empty ${backgrounds[background]}`));
  }
  assert.equal(backgroundReference('front', 'opportunityWhite'), '/photo-studio/opportunity-white.png');
  assert.equal(backgroundReference('interior', 'opportunityWhite'), null);
  assert.throws(() => backgroundReference('front', 'https://evil.test/image.png'));
  assert.doesNotMatch(editPrompt('interior', 'opportunityWhite'), /OPPORTUNITY/);
  assert.equal(backgroundReference('frontLeft', 'opportunityWorkshop'), '/photo-studio/opportunity-workshop.png');
  assert.match(editPrompt('frontLeft', 'opportunityWorkshop'), /dark gray ribbed garage door/);
  assert.match(editPrompt('frontLeft', 'opportunityWorkshop'), /Do not add a wall logo/);
  assert.doesNotMatch(editPrompt('frontLeft', 'opportunityWorkshop'), /upper-left OPPORTUNITY wall sign/);
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

async function newPhoto(f) {
  return (await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'gray' })).json()).item;
}
test('delete removes all studio variants of only the selected photo and supports retry', async () => {
  const f = fixture(); const first = await newPhoto(f), other = await newPhoto(f);
  await f.request('process', { id: first.id });
  f.objects.set('vehicle-photos/1-unrelated.jpg', new Blob(['gallery']));
  const result = await f.request('delete', { id: first.id });
  assert.equal(result.status, 200); assert.equal((await result.json()).deletedId, first.id);
  assert.ok(![...f.objects.keys()].some(path => path.includes(first.id)));
  assert.ok(f.objects.has(`photo-studio/1-${other.id}-original`));
  assert.ok(f.objects.has('vehicle-photos/1-unrelated.jpg'));
  assert.equal((await f.request('delete', { id: first.id })).status, 200);
  assert.equal((await (await f.request('list')).json()).items.length, 1);
});
test('delete refuses active processing and unauthorized users', async () => {
  const f = fixture(); const item = await newPhoto(f);
  f.objects.set(`photo-studio/1-${item.id}-lock`, new Blob(['processing']));
  assert.equal((await f.request('delete', { id: item.id })).status, 409);
  assert.ok(f.objects.has(`photo-studio/1-${item.id}-original`));
  assert.equal((await fixture({ staff: false }).request('delete', { id: item.id })).status, 403);
  assert.equal((await f.request('delete', { id: '../../other-file' })).status, 400);
  assert.equal((await f.request('delete', { id: item.id, carId: '2' })).status, 200);
  assert.ok(f.objects.has(`photo-studio/1-${item.id}-original`));
});
test('storage deletion failure keeps manifest visible, does not report success and can be retried', async () => {
  const f = fixture({ failRemove: true }); const item = await newPhoto(f);
  assert.equal((await f.request('delete', { id: item.id })).status, 500);
  assert.ok(f.objects.has(`photo-studio/1-${item.id}-meta.json`));
  assert.ok(!f.objects.has(`photo-studio/1-${item.id}-lock`));
  f.allowRemove(); assert.equal((await f.request('delete', { id: item.id })).status, 200);
});
test('uncertain detection retains a correctable base and cannot be approved', async () => {
  const f = fixture({ detection: 'uncertain' }); const item = await newPhoto(f);
  const processed = await (await f.request('process', { id: item.id })).json();
  assert.equal(processed.item.plateVerified, false); assert.equal(processed.item.plateRendered, false);
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 400);
  await f.request('plate', { id: item.id, plates: JSON.stringify([samplePlate]) });
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 200);
});
test('no visible plate needs no logo rendering or separate confirmation', async () => {
  const f = fixture({ detection: 'none' }); const item = await newPhoto(f);
  const { item: result } = await (await f.request('process', { id: item.id })).json();
  assert.equal(result.plateVerified, true); assert.equal(result.plateStatus, 'not-visible');
  assert.equal(f.renders.length, 0); assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 200);
});
test('masking retry resumes from the saved base without paying for generation again', async () => {
  const f = fixture({ failRenderOnce: true }); const item = await newPhoto(f);
  assert.equal((await f.request('process', { id: item.id })).status, 500);
  assert.ok(f.objects.has(`photo-studio/1-${item.id}-base.jpg`));
  assert.equal((await f.request('process', { id: item.id })).status, 200);
  assert.equal(f.calls(), 1);
});
test('automatic retry and manual correction both render from the unmasked base', async () => {
  const f = fixture(); const item = await newPhoto(f);
  const first = await (await f.request('process', { id: item.id })).json();
  const second = await (await f.request('autoPlate', { id: item.id })).json();
  assert.notEqual(first.item.resultUrl, second.item.resultUrl);
  await f.request('plate', { id: item.id, plates: JSON.stringify([samplePlate]) });
  assert.equal(f.calls(), 1);
  assert.equal(f.renders.length, 3);
  for (const render of f.renders) assert.equal(new TextDecoder().decode(render.bytes), 'image bytes');
});
test('real JPEG pipeline saves an opaque logo into result pixels and preserves the base', async () => {
  const rgba = { width: 320, height: 200, data: new Uint8Array(320 * 200 * 4).fill(210) };
  for (let y = 120; y < 135; y++) for (let x = 128; x < 192; x++) rgba.data.set([255, 0, 0, 255], (y * 320 + x) * 4);
  const bytes = new Uint8Array(jpeg.encode(rgba, 95).data);
  const f = fixture({ actualRender: true, imageBytes: bytes }); const item = await newPhoto(f);
  assert.equal((await f.request('process', { id: item.id })).status, 200);
  const base = new Uint8Array(await f.objects.get(`photo-studio/1-${item.id}-base.jpg`).arrayBuffer());
  const rendered = new Uint8Array(await f.objects.get(`photo-studio/1-${item.id}-result.jpg`).arrayBuffer());
  assert.deepEqual(base, bytes); assert.notDeepEqual(rendered, bytes);
  const decoded = jpeg.decode(rendered, { useTArray: true });
  assert.equal(decoded.width, 320); assert.equal(decoded.height, 200);
  const pixel = (127 * 320 + 160) * 4;
  assert.ok(!(decoded.data[pixel] > 180 && decoded.data[pixel + 1] < 60));
});

test('wordmark bounds are centered horizontally and vertically, with an opaque background', () => {
  const source = PNG.sync.read(readFileSync(new URL('../../public/photo-studio/opportunity-logo.png', import.meta.url)));
  const logo = makePlateLogo(source); const xs = [], ys = [];
  for (let y = 0; y < logo.height; y++) for (let x = 0; x < logo.width; x++) {
    const i = (y * logo.width + x) * 4; assert.equal(logo.data[i + 3], 255);
    if (logo.data[i] > 190 && logo.data[i + 1] > 190 && logo.data[i + 2] > 190) { xs.push(x); ys.push(y); }
  }
  assert.ok(xs.length > 100);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs) + 1) / 2 - logo.width / 2) <= 1);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys) + 1) / 2 - logo.height / 2) <= 1);
});
const visionResponse = (status, plates) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ status, plates }) } }] }));
test('only refined crop coordinates are mapped back and rendered, never a rough bumper estimate', async () => {
  let calls = 0;
  const crop = { base64: 'crop-image', left: .1, top: .3, width: .4, height: .5 };
  const localized = [{ x: .2, y: .3 }, { x: .6, y: .35 }, { x: .6, y: .5 }, { x: .2, y: .45 }];
  const result = await detectPlates('full-image', 'test', async (_, options) => {
    const request = JSON.parse(options.body); assert.equal(request.model, 'gpt-4.1');
    assert.match(request.messages[1].content[0].image_url.url, new RegExp(calls ? 'crop-image' : 'full-image'));
    return ++calls === 1 ? visionResponse('located', [samplePlate]) : visionResponse('located', [localized]);
  }, () => crop, (_, quad) => Math.abs(quad[0].x - .18) < 1e-10);
  assert.equal(calls, 2); assert.equal(result.plateVerified, true);
  assert.ok(Math.abs(result.plates[0][0].x - .18) < 1e-10);
  assert.ok(Math.abs(result.plates[0][0].y - .45) < 1e-10);
});
test('unconfirmed or visually implausible crop cannot be marked automatically masked', async () => {
  let calls = 0;
  const failedCrop = await detectPlates('image', 'test', async () => ++calls === 1 ? visionResponse('located', [samplePlate]) : visionResponse('uncertain', []), () => ({ base64: 'crop', left: 0, top: 0, width: 1, height: 1 }), () => true);
  assert.equal(failedCrop.plateVerified, false);
  const bumper = await detectPlates('image', 'test', async () => visionResponse('located', [samplePlate]), () => ({ base64: 'crop', left: 0, top: 0, width: 1, height: 1 }), () => false);
  assert.equal(bumper.plateVerified, false); assert.deepEqual(bumper.plates, []);
});
test('every detected visible plate is refined independently and retained', async () => {
  const second = samplePlate.map(p => ({ x: p.x + .25, y: p.y })); let calls = 0, crops = 0;
  const result = await detectPlates('image', 'test', async () => ++calls === 1 ? visionResponse('located', [samplePlate, second]) : visionResponse('located', [samplePlate]), () => ({ base64: 'crop', left: crops++ * .25, top: 0, width: 1, height: 1 }), () => true);
  assert.equal(result.plateVerified, true); assert.equal(result.plates.length, 2); assert.equal(crops, 2);
});
test('pixel check rejects a smooth bumper, crop bounds stay in the original coordinate space', () => {
  const image = { width: 320, height: 200, data: new Uint8Array(320 * 200 * 4).fill(220) };
  const base64 = Buffer.from(jpeg.encode(image, 95).data).toString('base64');
  assert.equal(checkPlateRegion(base64, samplePlate), false);
  const crop = cropPlateRegion(base64, samplePlate);
  assert.ok(crop.left >= 0 && crop.top >= 0 && crop.left + crop.width <= 1 && crop.top + crop.height <= 1);
  assert.ok(crop.left < samplePlate[0].x && crop.top < samplePlate[0].y);
});
test('old masks need automatic migration and cannot be exported as approved', () => {
  const old = { ready: true, approved: true, plateVerified: true };
  assert.equal(needsPlateUpdate(old), true); assert.equal(canExportPhoto(old), false);
  assert.equal(needsPlateUpdate({ ...old, maskVersion: 2 }), false);
  assert.equal(canExportPhoto({ ...old, maskVersion: 2 }), true);
});

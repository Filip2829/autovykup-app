import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoto, reflectionMode, exportName, backgrounds, backgroundReference, needsPlateUpdate, canExportPhoto } from './model.js';
import { validatePlates, paintPlateLogos, makePlateLogo } from './plates.js';
import { detectPlates } from '../../supabase/functions/vehicle-photo-studio/plateDetection.js';
import { makeZip } from './zip.js';
import { createPhotoStudioHandler } from '../../supabase/functions/vehicle-photo-studio/handler.js';
import { checkPlateRegion, cropPlateRegion, renderMaskedJpeg, composeOriginalVehicle } from '../../supabase/functions/vehicle-photo-studio/imageCodec.js';
import { PNG } from 'pngjs';
import { canUseStandaloneStudio } from './access.js';
import jpeg from 'jpeg-js';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

test('upload rejects unsupported and oversized images', () => {
  assert.throws(() => validatePhoto({ type: 'image/heic', size: 100 }));
  assert.throws(() => validatePhoto({ type: 'image/jpeg', size: 13 * 1024 * 1024 }));
  assert.doesNotThrow(() => validatePhoto({ type: 'image/jpeg', size: 100 }));
});
test('catalogue rejects arbitrary views and produces stable export names', () => {
  assert.throws(() => backgroundReference('invent a vehicle', 'gray'));
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
function fixture({ authenticated = true, staff = true, sales = false, userId = 'staff-id', objects: sharedObjects, failAi = false, failBackground = false, failRemove = false, failRenderOnce = false, detection = 'located', actualRender = false, actualComposite = false, exteriorCheck = true, cleanupPlan = {status:'none',confidence:1,regions:[]}, cleanupCheck = true, sceneResult = {scene:'exterior',backgroundVisible:true,conditionEvidence:false,confidence:1}, interiorCheck = true, windowResult = { status: 'none', confidence: 1, regions: [] }, imageBytes = new TextEncoder().encode('image bytes') } = {}) {
  const objects = sharedObjects || new Map(); let calls = 0, carReads = 0, removeFailure = failRemove; const composites = [], backgroundRequests = [], renders = [];
  const bucket = {
    upload: async (path, data, options = {}) => {
      if (objects.has(path) && !options.upsert) return { error: new Error('duplicate') };
      objects.set(path, data instanceof Blob ? data : new Blob([data])); return { data: {} };
    },
    download: async path => objects.has(path) ? { data: objects.get(path) } : { error: Object.assign(new Error('missing'), { statusCode: '404' }) },
    remove: async paths => { if (removeFailure && !paths.every(p => p.endsWith('-lock'))) return { error: new Error('storage unavailable') }; paths.forEach(p => objects.delete(p)); return { data: {} }; },
    list: async (folder, { search = '' } = {}) => ({ data: [...objects.keys()].filter(p => p.startsWith(`${folder}/`) && !p.slice(folder.length + 1).includes('/') && p.slice(folder.length + 1).startsWith(search)).map(p => ({ name: p.slice(folder.length + 1) })) }),
    getPublicUrl: path => ({ data: { publicUrl: `https://test.example/${path}` } }),
  };
  const db = { storage: { from: () => bucket }, auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId, app_metadata: { photo_studio_access: sales } } : null } }) }, from: table => { if (table === 'cars') carReads++; return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'cars' ? { id: 1 } : staff ? { user_id: userId } : null }) }) }) }; } };
  const handler = createPhotoStudioHandler({ db, apiKey: 'test',
    cleanInteriorJpeg: async bytes => bytes,
    composeOriginalVehicle: async (source, mask, background, backgroundName, options) => { calls++; composites.push({ source, mask, background, backgroundName, options }); if (failAi) throw new Error('compositing unavailable'); return actualComposite ? composeOriginalVehicle(source, mask, background, backgroundName, options) : imageBytes; },
    fetchBackground: async url => { backgroundRequests.push(url); const data = url.endsWith('opportunity-logo.png') ? readFileSync(new URL('../../public/photo-studio/opportunity-logo.png', import.meta.url)) : PNG.sync.write(Object.assign(new PNG({ width: 32, height: 32 }), { data: Buffer.alloc(32 * 32 * 4, 255) })); return new Response(new Blob([data], { type: 'image/png' }), { status: failBackground ? 404 : 200 }); },
    fetchVision: async (_, options) => { const name = JSON.parse(options.body).response_format.json_schema.name; const content = name === 'exterior_integrity_check' ? {vehicleUnchanged:exteriorCheck,surroundingsReplaced:exteriorCheck} : name === 'exterior_surroundings' ? {status:'located',confidence:1,regions:[{polygon:[{x:0,y:0},{x:.2,y:0},{x:.2,y:1},{x:0,y:1}],protect:[]}]} : name === 'studio_scene' ? sceneResult : name === 'loose_interior_dirt' ? cleanupPlan : name === 'interior_cleanup_check' ? {controlsUnchanged:cleanupCheck,materialsUnchanged:cleanupCheck,wearPreserved:cleanupCheck,onlyLooseDirtRemoved:cleanupCheck} : name === 'interior_exterior_views' ? windowResult : name === 'interior_view_check' ? { cabinUnchanged: interiorCheck, exteriorHidden: interiorCheck } : { status: detection, plates: detection === 'located' ? [samplePlate] : [] }; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] })); },
    cropPlateRegion: base64 => ({ base64, left: 0, top: 0, width: 1, height: 1 }),
    checkPlateRegion: () => true,
    renderMaskedJpeg: (bytes, plates, logo) => { renders.push({ bytes, plates }); if (failRenderOnce && renders.length === 1) throw new Error('temporary render failure'); return actualRender ? renderMaskedJpeg(bytes, plates, logo) : new TextEncoder().encode('masked result'); },
  });
  return { objects, composites, backgroundRequests, renders, calls: () => calls, carReads: () => carReads, allowRemove: () => { removeFailure = false; }, async request(action, values = {}) {
    const form = new FormData(); form.set('carId', '1'); form.set('action', action);
    if (action === 'upload' && !values.omitSubject) { form.set('source', new File(['source'], 'source.png', { type: 'image/png' })); form.set('vehicleMask', new File(['mask'], 'mask.png', { type: 'image/png' })); }
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return handler(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: form }));
  } };
}
test('authentication and staff membership are checked before any storage operation', async () => {
  for (const [config, status] of [[{ authenticated: false }, 401], [{ staff: false }, 403]]) {
    const f = fixture(config); assert.equal((await f.request('list')).status, status); assert.equal(f.objects.size, 0);
  }
});

test('missing protected input fails closed without a generative fallback or stored upload', async () => {
  const f = fixture();
  const response = await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'gray', omitSubject: true });
  assert.equal(response.status, 400);
  assert.equal(f.calls(), 0);
  assert.equal(f.objects.size, 0);
});

test('interior verification failure never persists or approves an altered cabin', async () => {
  const f = fixture({ interiorCheck: false });
  const { item } = await (await f.request('upload', { file: new File(['original-cabin'], 'interior.jpg', { type: 'image/jpeg' }), angle: 'interior', background: 'opportunityShowroom' })).json();
  const result = await f.request('process', { id: item.id });
  assert.equal(result.status, 422);
  assert.equal(await f.objects.get(`photo-studio/1-${item.id}-original`).text(), 'original-cabin');
  assert.equal(f.objects.has(`photo-studio/1-${item.id}-base.jpg`), false);
  assert.equal(f.objects.has(`photo-studio/1-${item.id}-result.jpg`), false);
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 400);
});

test('uncertain interior window geometry stops before compositing', async () => {
  const f = fixture({ windowResult: { status: 'uncertain', confidence: .4, regions: [] } });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'cabin.jpg', { type: 'image/jpeg' }), angle: 'interior', background: 'opportunityShowroom' })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 422);
  assert.equal(f.calls(), 0);
});

test('actual interior detail overrides the selected exterior view and runs safe cleaning checks', async () => {
  const f = fixture();
  const inspection = { scene: 'interior_detail', backgroundVisible: true, conditionEvidence: false, confidence: .99 };
  const { item } = await (await f.request('upload', { file: new File(['door switches with gravel at edge'], 'door.jpg', { type: 'image/jpeg' }), angle: 'frontLeft', background: 'opportunityShowroom', inspection: JSON.stringify(inspection) })).json();
  const response = await f.request('process', { id: item.id });
  assert.equal(response.status, 200);
  const updated = (await response.json()).item;
  assert.equal(updated.scene, 'interior_detail');
  assert.equal(updated.interiorCleaningChecked, true);
  assert.equal(f.composites[0].mask, null);
  assert.equal(f.composites[0].options.angle, 'interior');
});

test('background is replaced in an exterior detail without moving or shrinking the cropped vehicle', async () => {
  const f = fixture();
  const inspection = { scene: 'exterior_detail', backgroundVisible: true, conditionEvidence: false, confidence: .99 };
  const { item } = await (await f.request('upload', { file: new File(['headlight and outdoor gravel'], 'headlight.jpg', { type: 'image/jpeg' }), angle: 'detail', background: 'opportunityShowroom', inspection: JSON.stringify(inspection) })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 200);
  assert.ok(f.composites[0].background);
  assert.equal(f.composites[0].mask, null);
  assert.equal(f.composites[0].options.surroundings.length, 1);
  assert.equal(f.composites[0].options.preserveFraming, true);
});

test('a failed cleanup verification blocks storage and export', async () => {
  const polygon = [{x:.1,y:.1},{x:.4,y:.1},{x:.4,y:.4},{x:.1,y:.4}];
  const f = fixture({ cleanupCheck: false, cleanupPlan: { status: 'located', confidence: .99, regions: [{ method: 'specks', polygon, protect: [], reference: polygon }] } });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'cabin.jpg', { type: 'image/jpeg' }), angle: 'interior', background: 'opportunityShowroom' })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 422);
  assert.equal(f.objects.has(`photo-studio/1-${item.id}-base.jpg`), false);
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 400);
});

test('scene inspection is authenticated, read-only and includes no storage writes', async () => {
  const f = fixture({ sceneResult: { scene: 'interior_detail', backgroundVisible: true, conditionEvidence: false, confidence: .99 } });
  const response = await f.request('inspect', { source: new File(['png'], 'source.png', { type: 'image/png' }), angle: 'detail' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).inspection.scene, 'interior_detail');
  assert.equal(f.objects.size, 0);
});

test('failed exterior integrity check cannot save or approve a cut-away car', async () => {
  const f = fixture({ exteriorCheck: false });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', {type:'image/jpeg'}), angle: 'front', background: 'opportunityShowroom' })).json();
  assert.equal((await f.request('process', {id:item.id})).status, 422);
  assert.equal(f.objects.has(`photo-studio/1-${item.id}-base.jpg`), false);
  assert.equal((await f.request('approve', {id:item.id,approved:'true'})).status, 400);
});

test('real source PNG and mask survive upload, composition, physical plate masking and export approval', async () => {
  const source = new PNG({ width: 320, height: 200 }), mask = new PNG({ width: 320, height: 200 });
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
    const i = (y * 320 + x) * 4, car = x >= 50 && x < 270 && y >= 40 && y < 170;
    source.data.set(car ? [180, 40, 40, 255] : [10, 100, 10, 255], i);
    mask.data.set(car ? [255, 255, 255, 255] : [0, 0, 0, 255], i);
  }
  const f = fixture({ actualComposite: true, actualRender: true });
  const file = new File(['original-upload-untouched'], 'car.jpg', { type: 'image/jpeg' });
  const { item } = await (await f.request('upload', { file, angle: 'front', background: 'white', source: new File([PNG.sync.write(source)], 'source.png', { type: 'image/png' }), vehicleMask: new File([PNG.sync.write(mask)], 'mask.png', { type: 'image/png' }) })).json();
  const response = await f.request('process', { id: item.id });
  assert.equal(response.status, 200);
  const result = (await response.json()).item;
  assert.equal(result.subjectVersion, 1); assert.equal(result.plateRendered, true);
  const base = jpeg.decode(new Uint8Array(await f.objects.get(`photo-studio/1-${item.id}-base.jpg`).arrayBuffer()), { useTArray: true });
  assert.equal(base.width, 320); assert.equal(base.height, 200);
  const i = (80 * 320 + 160) * 4;
  assert.ok(Math.abs(base.data[i] - 180) < 5); assert.ok(base.data[0] > 245);
  assert.equal(await f.objects.get(`photo-studio/1-${item.id}-original`).text(), 'original-upload-untouched');
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 200);
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

test('staged exterior separates composition and plate rendering; intermediate output cannot be approved', async () => {
  const f = fixture();
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'frontLeft', background: 'opportunityTurntable' })).json();
  const first = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(first.continueProcessing, true);
  assert.equal(first.item.ready, false);
  assert.equal(f.renders.length, 0);
  assert.equal((await f.request('approve', { id: item.id, approved: 'true' })).status, 400);
  const finished = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(finished.item.ready, true);
  assert.equal(finished.item.background, 'opportunityTurntable');
  assert.equal(f.calls(), 1);
  assert.equal(f.renders.length, 1);
});

test('staged interior resumes verified draft then base without repeating composition', async () => {
  const f = fixture();
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'interior', background: 'opportunityTurntable' })).json();
  const one = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(one.item.processingStage, 'clean');
  assert.equal(one.item.ready, false);
  const two = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(two.item.interiorCleaningChecked, true);
  assert.equal(two.continueProcessing, true);
  const three = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(three.item.ready, true);
  assert.equal(f.calls(), 1);
});

test('reprocessing an existing interior with a new environment never reuses its previous base or approval', async () => {
  const f = fixture();
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'interior', background: 'opportunityShowroom' })).json();
  await f.request('process', { id: item.id });
  await f.request('approve', { id: item.id, approved: 'true' });
  const restart = await (await f.request('reprocess', { id: item.id, background: 'opportunityTurntable' })).json();
  assert.equal(restart.item.approved, false);
  assert.equal(restart.item.ready, false);
  const first = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(first.item.processingStage, 'clean');
  const second = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(second.continueProcessing, true);
  assert.equal(second.item.processingStage, 'plate');
  const third = await (await f.request('process', { id: item.id, staged: 'true' })).json();
  assert.equal(third.item.ready, true);
  assert.equal(third.item.background, 'opportunityTurntable');
  assert.equal(f.calls(), 2);
  assert.equal(await f.objects.get(`photo-studio/1-${item.id}-original`).text(), 'original');
});
test('presets composite the original source; interiors need no mask or background', async () => {
  assert.equal(Object.keys(backgrounds).length, 2);
  for (const [angle, background, count] of [['frontLeft', 'opportunityGraphite', 2], ['frontLeft', 'opportunityWorkshop', 2], ['front', 'opportunityDarkTiles', 2], ['interior', 'opportunityWhite', 2], ['detail', 'opportunityShowroom', 1], ['front', 'gray', 2]]) {
    const f = fixture();
    const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle, background })).json();
    assert.equal((await f.request('process', { id: item.id })).status, 200);
    assert.equal(Boolean(f.composites[0].background), count === 2);
    assert.equal(Boolean(f.composites[0].mask), !['interior', 'detail'].includes(angle));
    assert.equal(new TextDecoder().decode(f.composites[0].source), 'source');
    assert.equal(f.backgroundRequests.filter(url => !url.endsWith('opportunity-logo.png')).length, count - 1);
    assert.equal(f.composites[0].backgroundName, 'opportunityShowroom');
  }
  assert.equal(backgroundReference('front', 'opportunityWhite'), '/photo-studio/opportunity-showroom.png');
  assert.equal(backgroundReference('interior', 'opportunityWhite'), null);
  assert.throws(() => backgroundReference('front', 'https://evil.test/image.png'));
  assert.equal(backgroundReference('frontLeft', 'opportunityWorkshop'), '/photo-studio/opportunity-showroom.png');
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
test('compositing failure retains original and releases lock for retry', async () => {
  const f = fixture({ failAi: true });
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.png', { type: 'image/png' }), angle: 'detail', background: 'white' })).json();
  assert.equal((await f.request('process', { id: item.id })).status, 500);
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

test('standalone access uses administrator-managed claims, never editable user metadata', () => {
  assert.equal(canUseStandaloneStudio({ id: 'sales', app_metadata: { photo_studio_access: true } }, false), true);
  assert.equal(canUseStandaloneStudio({ id: 'sales', user_metadata: { photo_studio_access: true } }, false), false);
  assert.equal(canUseStandaloneStudio({ id: 'sales', is_anonymous: true, app_metadata: { photo_studio_access: true } }, false), false);
  assert.equal(canUseStandaloneStudio({ id: 'staff' }, true), true);
});
test('approved salesperson can create, reload and process an independent photo set without reading cars', async () => {
  const f = fixture({ staff: false, sales: true, userId: 'sales-a' });
  const created = await f.request('createSession', { scope: 'standalone', label: '  Renault Austral · 123  ' });
  assert.equal(created.status, 200); const { session } = await created.json();
  assert.equal(session.label, 'Renault Austral · 123');
  const { sessions } = await (await f.request('sessions', { scope: 'standalone' })).json();
  assert.equal(sessions.length, 1); assert.equal(sessions[0].id, session.id);
  const scope = { scope: 'standalone', sessionId: session.id };
  const upload = await f.request('upload', { ...scope, file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'opportunityDarkTiles' });
  assert.equal(upload.status, 200); const { item } = await upload.json();
  assert.equal((await f.request('process', { ...scope, id: item.id })).status, 200);
  assert.equal((await f.request('approve', { ...scope, id: item.id, approved: 'true' })).status, 200);
  const { items } = await (await f.request('list', scope)).json();
  assert.equal(items.length, 1); assert.equal(items[0].approved, true);
  assert.equal(items[0].plateRendered, true);
  assert.ok(f.objects.has(`photo-studio-sales/sales-a/${session.id}/${item.id}-original`));
  assert.equal(f.carReads(), 0);
});
test('standalone grant never allows access to vehicle-linked studio or another owner sets', async () => {
  const f = fixture({ staff: false, sales: true, userId: 'sales-a' });
  assert.equal((await f.request('list')).status, 403);
  const { session } = await (await f.request('createSession', { scope: 'standalone', label: 'Moje sada' })).json();
  const other = fixture({ staff: false, sales: true, userId: 'sales-b', objects: f.objects });
  const list = await (await other.request('sessions', { scope: 'standalone' })).json(); assert.deepEqual(list.sessions, []);
  assert.equal((await other.request('list', { scope: 'standalone', sessionId: session.id, userId: 'sales-a' })).status, 404);
  assert.equal((await other.request('deleteSession', { scope: 'standalone', sessionId: session.id })).status, 404);
  assert.ok(f.objects.has(`photo-studio-sales/sales-a/sessions/${session.id}.json`));
});
test('unapproved accounts and invalid set identifiers cannot start a standalone session', async () => {
  const denied = fixture({ staff: false });
  assert.equal((await denied.request('createSession', { scope: 'standalone', label: 'Denied' })).status, 403);
  const f = fixture({ staff: false, sales: true });
  assert.equal((await f.request('createSession', { scope: 'standalone', label: ' ' })).status, 400);
  assert.equal((await f.request('list', { scope: 'standalone', sessionId: '../other' })).status, 400);
});
test('session deletion requires an empty photo set and preserves other sessions', async () => {
  const f = fixture({ staff: false, sales: true });
  const { session } = await (await f.request('createSession', { scope: 'standalone', label: 'První' })).json();
  const { session: second } = await (await f.request('createSession', { scope: 'standalone', label: 'Druhá' })).json();
  const scope = { scope: 'standalone', sessionId: session.id };
  const { item } = await (await f.request('upload', { ...scope, file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'gray' })).json();
  assert.equal((await f.request('deleteSession', scope)).status, 409);
  assert.equal((await f.request('delete', { ...scope, id: item.id })).status, 200);
  assert.equal((await f.request('deleteSession', scope)).status, 200);
  const { sessions } = await (await f.request('sessions', { scope: 'standalone' })).json();
  assert.equal(sessions.length, 1); assert.equal(sessions[0].id, second.id);
  assert.ok(![...f.objects.keys()].some(path => path.endsWith('-lock')));
});

test('legacy reflection modes cannot alter the vehicle surface', () => {
  for (const angle of ['frontLeft', 'interior', 'detail']) assert.equal(reflectionMode(angle, 'gentle'), 'off');
  assert.throws(() => reflectionMode('front', 'aggressive'));
});

test('old reflection mode is ignored to keep all source vehicle pixels unchanged', async () => {
  const f = fixture();
  const { item } = await (await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'gray', reflectionReduction: 'gentle' })).json();
  assert.equal(item.reflectionReduction, 'off');
  assert.equal((await f.request('process', { id: item.id })).status, 200);
  assert.equal(f.composites.length, 1);
  assert.equal(item.subjectVersion, 1);
  const { items } = await (await f.request('list')).json();
  assert.equal(items[0].reflectionReduction, 'off');
});
test('unsupported reflection modes are rejected before upload or paid AI request', async () => {
  const f = fixture();
  const response = await f.request('upload', { file: new File(['original'], 'car.jpg', { type: 'image/jpeg' }), angle: 'front', background: 'gray', reflectionReduction: 'remove-all-damage' });
  assert.equal(response.status, 400); assert.equal(f.objects.size, 0); assert.equal(f.calls(), 0);
  const { item } = await (await f.request('upload', { file: new File(['original'], 'detail.jpg', { type: 'image/jpeg' }), angle: 'detail', background: 'gray', reflectionReduction: 'gentle' })).json();
  assert.equal(item.reflectionReduction, 'off');
});

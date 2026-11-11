import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLooseInteriorDirt, validateCleanupPlan } from './surfaceCleanup.js';
import { inspectStudioScene, validateScene } from '../../supabase/functions/vehicle-photo-studio/sceneInspection.js';
import { locateLooseDirt, verifyInteriorCleanup } from '../../supabase/functions/vehicle-photo-studio/interiorCleanup.js';
import { neutralizeInteriorViews } from '../../supabase/functions/vehicle-photo-studio/interiorWindows.js';
import { composeOriginalVehicle } from '../../supabase/functions/vehicle-photo-studio/imageCodec.js';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const rectangle = (l, t, r, b) => [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }];
const image = (width = 100, height = 80, color = [50, 50, 50, 255]) => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(color, i);
  return { width, height, data };
};
const pixel = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const plan = (method = 'specks') => ({ status: 'located', confidence: .99, regions: [{ method, polygon: rectangle(.25, .2, .8, .8), reference: rectangle(.05, .05, .2, .2), protect: [rectangle(.5, .3, .65, .5)] }] });

test('dust cleanup removes isolated light lint while preserving printed symbols, dark scratches and pixels outside its region', () => {
  const original = image();
  original.data.set([200, 205, 210, 255], (30 * 100 + 30) * 4); // lint
  original.data.set([240, 240, 240, 255], (30 * 100 + 55) * 4); // protected button symbol
  original.data.set([15, 15, 15, 255], (40 * 100 + 35) * 4); // dark scratch
  original.data.set([220, 220, 220, 255], (10 * 100 + 90) * 4); // outside region
  const cleaned = cleanLooseInteriorDirt(original, validateCleanupPlan(plan()));
  assert.deepEqual(pixel(cleaned, 30, 30), [50, 50, 50, 255]);
  assert.deepEqual(pixel(cleaned, 55, 30), pixel(original, 55, 30));
  assert.deepEqual(pixel(cleaned, 35, 40), pixel(original, 35, 40));
  assert.deepEqual(pixel(cleaned, 90, 10), pixel(original, 90, 10));
  assert.deepEqual(pixel(original, 30, 30), [200, 205, 210, 255]);
});

test('dusty rubber mat film is reduced without inventing texture or painting protected grooves', () => {
  const original = image();
  for (let y = 15; y < 68; y++) for (let x = 23; x < 82; x++) {
    const value = 100 + (x % 2 ? 3 : -3);
    original.data.set([value, value, value, 255], (y * 100 + x) * 4);
  }
  const cleaned = cleanLooseInteriorDirt(original, validateCleanupPlan(plan('surface_film')));
  assert.ok(pixel(cleaned, 40, 50)[0] < pixel(original, 40, 50)[0] - 20);
  assert.ok(pixel(cleaned, 41, 50)[0] > pixel(cleaned, 40, 50)[0]); // original grain survives
  assert.deepEqual(pixel(cleaned, 55, 30), pixel(original, 55, 30));
  assert.deepEqual(pixel(cleaned, 10, 10), pixel(original, 10, 10));
  assert.throws(() => validateCleanupPlan({ ...plan(), confidence: .6 }));
  assert.throws(() => validateCleanupPlan({ ...plan(), regions: [{ ...plan().regions[0], method: 'restore-leather' }] }));
});

test('an exterior close-up keeps the exact crop instead of being shrunk into a complete-car composition', () => {
  const source = new PNG({ width: 100, height: 80 }), mask = new PNG({ width: 100, height: 80 });
  for (let y = 0; y < 80; y++) for (let x = 0; x < 100; x++) {
    const foreground = x >= 30;
    source.data.set(foreground ? (x > 60 && x < 72 ? [15, 70, 15, 255] : [180, 30, 30, 255]) : [15, 70, 15, 255], (y * 100 + x) * 4);
    mask.data.set(foreground ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 100 + x) * 4);
  }
  const room = new PNG({width:100,height:80}); room.data.fill(255);
  const output = jpeg.decode(composeOriginalVehicle(PNG.sync.write(source), null, PNG.sync.write(room), 'opportunityShowroom', { preserveFraming: true, surroundings: [{polygon:rectangle(0,0,.3,1),protect:[]}] }), { useTArray: true });
  assert.ok(pixel(output, 90, 5)[0] > 170 && pixel(output, 90, 5)[1] < 40);
  assert.ok(pixel(output, 10, 20)[0] > 245); // surroundings replaced
  assert.ok(pixel(output, 66, 20)[0] < 30 && pixel(output, 66, 20)[1] > 55); // background-like reflection ON paint remains
  assert.equal(output.width, 100); assert.equal(output.height, 80);
});

test('showroom replaces even a narrow outdoor strip without painting nearby door controls', () => {
  const original = image(), room = image(100, 80, [180, 170, 160, 255]);
  const result = neutralizeInteriorViews(original, [{ polygon: rectangle(0, .9, 1, 1), protect: [] }], room);
  assert.deepEqual(pixel(result, 50, 76), [180, 170, 160, 255]);
  assert.deepEqual(pixel(result, 50, 50), [50, 50, 50, 255]);
});

test('scene and cleaning contracts include interior close-ups and reject uncertain or destructive analysis', async () => {
  const response = value => async () => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
  const scene = { scene: 'interior_detail', backgroundVisible: true, conditionEvidence: false, confidence: .99 };
  assert.deepEqual(await inspectStudioScene('png', 'test', response(scene)), scene);
  assert.throws(() => validateScene({ ...scene, confidence: .5 }));
  assert.deepEqual(await locateLooseDirt('jpg', 'test', response(plan())), plan().regions);
  const accepted = { controlsUnchanged: true, materialsUnchanged: true, wearPreserved: true, onlyLooseDirtRemoved: true };
  await verifyInteriorCleanup('before', 'after', 'test', response(accepted));
  await assert.rejects(verifyInteriorCleanup('before', 'after', 'test', response({ ...accepted, controlsUnchanged: false })));
  await assert.rejects(verifyInteriorCleanup('before', 'after', 'test', response({ ...accepted, wearPreserved: false })));
});

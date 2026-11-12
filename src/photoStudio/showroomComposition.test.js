import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { backgroundOptions, backgroundReference, normalizeBackground } from './model.js';
import { vehiclePlacement, placeOriginalVehicle, floorContactShadow } from './vehiclePlacement.js';
import { validateInteriorWindows, neutralizeInteriorViews, locateInteriorWindows, verifyInteriorViews } from '../../supabase/functions/vehicle-photo-studio/interiorWindows.js';

test('Atelier and Showroom are offered and legacy presets resolve without arbitrary remote URLs', () => {
  assert.deepEqual(Object.keys(backgroundOptions), ['opportunityTurntable', 'opportunityShowroom']);
  assert.equal(backgroundReference('front', 'opportunityTurntable'), '/photo-studio/opportunity-turntable.png');
  for (const key of ['gray', 'white', 'opportunityWorkshop', 'opportunityDarkTiles']) {
    assert.equal(normalizeBackground(key), 'opportunityShowroom');
    assert.equal(backgroundReference('front', key), '/photo-studio/opportunity-showroom.png');
  }
  assert.throws(() => normalizeBackground('https://untrusted.example/room.png'));
});

test('different source views receive uniform placement and a floor shadow, without recoloring protected source pixels', () => {
  const width = 180, height = 120;
  for (const bounds of [[10, 10, 170, 100], [45, 5, 135, 115], [15, 35, 165, 90]]) {
    const mask = new Uint8Array(width * height), source = new Uint8Array(width * height * 4).fill(255);
    for (let y = bounds[1]; y < bounds[3]; y++) for (let x = bounds[0]; x < bounds[2]; x++) {
      mask[y * width + x] = 255; source.set([72, 83, 94, 255], (y * width + x) * 4);
    }
    const placed = placeOriginalVehicle(source, mask, width, height), layout = vehiclePlacement(mask, width, height);
    assert.ok(layout.scale > 0 && layout.scale <= 1);
    assert.ok(Math.abs(layout.offsetY + (layout.bounds.bottom + 1) * layout.scale - height * .89) < .001);
    const pixels = [...placed.mask.keys()].filter(i => placed.mask[i]);
    assert.ok(pixels.length > 0);
    for (const i of pixels) assert.deepEqual([...placed.pixels.subarray(i * 4, i * 4 + 4)], [72, 83, 94, 255]);
    const background = new Uint8Array(source.length).fill(220), shadow = floorContactShadow(background, placed.profile, width, height);
    assert.ok(shadow.some((value, i) => i % 4 !== 3 && value < background[i]));
    assert.deepEqual([...shadow.subarray(0, width * 4 * 50)], [...background.subarray(0, width * 4 * 50)]);
  }
});

const rectangle = (left, top, right, bottom) => [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
const windows = { status: 'located', confidence: .99, regions: [{ polygon: rectangle(.1, .1, .9, .5), protect: [rectangle(.4, .15, .6, .3)] }] };

test('opaque window replacement preserves dashboard and protected mirror pixels exactly', () => {
  const width = 100, height = 80, data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([20, 60, 130, 255], i);
  const result = neutralizeInteriorViews({ width, height, data }, validateInteriorWindows(windows));
  const pixel = (x, y) => [...result.data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
  assert.ok(pixel(20, 20)[0] > 230); // outside view is opaque, not a blur
  assert.deepEqual(pixel(50, 15), [20, 60, 130, 255]); // rear-view mirror
  assert.deepEqual(pixel(50, 60), [20, 60, 130, 255]); // dashboard
  assert.deepEqual(pixel(0, 0), [20, 60, 130, 255]); // headliner
  assert.deepEqual([...data.subarray(0, 4)], [20, 60, 130, 255]);
  assert.throws(() => validateInteriorWindows({ ...windows, confidence: .7 }));
  assert.throws(() => validateInteriorWindows({ ...windows, regions: [{ polygon: rectangle(0, 0, 1, 1), protect: [] }] }));
  assert.throws(() => validateInteriorWindows({ status: 'uncertain', regions: [] }));
});

test('interior detection uses PNG input and independent before/after verification fails closed', async () => {
  const reply = content => async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'gpt-4.1');
    assert.match(request.messages[1].content[0].image_url.url, /^data:image\/png;base64,/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  };
  assert.deepEqual(await locateInteriorWindows('original', 'test', reply(windows)), windows.regions);
  await verifyInteriorViews('original', 'result', 'test', reply({ cabinUnchanged: true, exteriorHidden: true }));
  await assert.rejects(verifyInteriorViews('original', 'result', 'test', reply({ cabinUnchanged: false, exteriorHidden: true })));
  await assert.rejects(verifyInteriorViews('original', 'result', 'test', reply({ cabinUnchanged: true, exteriorHidden: false })));
});

test('showroom sign remains complete below the top crop shown by the user', () => {
  const plate = PNG.sync.read(readFileSync(new URL('../../public/photo-studio/opportunity-showroom.png', import.meta.url)));
  let dark = 0, oldDark = 0;
  for (let y = Math.floor(plate.height * .26); y < plate.height * .35; y++) for (let x = Math.floor(plate.width * .08); x < plate.width * .25; x++) {
    const i = (y * plate.width + x) * 4;
    if (plate.data[i] < 80 && plate.data[i + 1] < 80 && plate.data[i + 2] < 80) dark++;
  }
  for (let y = Math.floor(plate.height * .12); y < plate.height * .21; y++) for (let x = Math.floor(plate.width * .08); x < plate.width * .25; x++) {
    const i = (y * plate.width + x) * 4;
    if (plate.data[i] < 80 && plate.data[i + 1] < 80 && plate.data[i + 2] < 80) oldDark++;
  }
  assert.ok(dark > 5000); assert.ok(oldDark < 500);
});

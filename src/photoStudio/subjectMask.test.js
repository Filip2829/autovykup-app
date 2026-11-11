import test from 'node:test';
import assert from 'node:assert/strict';
import { compositeSourcePixels, protectSubjectMask } from './subjectMask.js';
import { composeOriginalVehicle } from '../../supabase/functions/vehicle-photo-studio/imageCodec.js';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

test('compositing keeps every protected source pixel even if a new background is entirely different', () => {
  const source = Uint8Array.from([12, 33, 54, 255, 99, 120, 5, 255, 4, 50, 200, 255]);
  const background = new Uint8Array(12).fill(250);
  const result = compositeSourcePixels(source, background, Uint8Array.from([255, 0, 255]));
  assert.deepEqual([...result], [12, 33, 54, 255, 250, 250, 250, 250, 4, 50, 200, 255]);
  assert.deepEqual([...source], [12, 33, 54, 255, 99, 120, 5, 255, 4, 50, 200, 255]);
});

test('mask preserves enclosed glass and faint edge details and rejects missing/whole-scene masks', () => {
  const width = 60, height = 40, values = new Uint8Array(width * height);
  for (let y = 10; y < 30; y++) for (let x = 12; x < 48; x++) values[y * width + x] = 255;
  values[18 * width + 20] = 0; // An incorrectly transparent window must retain the source glass.
  values[9 * width + 25] = 40; // A faint antenna must not be discarded.
  const protectedMask = protectSubjectMask(values, width, height);
  assert.equal(protectedMask[18 * width + 20], 255);
  assert.equal(protectedMask[9 * width + 25], 255);
  assert.equal(protectedMask[0], 0);
  assert.throws(() => protectSubjectMask(new Uint8Array(width * height), width, height));
  assert.throws(() => protectSubjectMask(new Uint8Array(width * height).fill(255), width, height));
});

test('JPEG output retains portrait aspect ratio, source colors and geometry; only exterior background changes', () => {
  const source = new PNG({ width: 40, height: 80 }), mask = new PNG({ width: 40, height: 80 });
  for (let y = 0; y < 80; y++) for (let x = 0; x < 40; x++) {
    const i = (y * 40 + x) * 4, car = x >= 8 && x < 32 && y >= 16 && y < 64;
    source.data.set(car ? [180, 25, 45, 255] : [20, 120, 20, 255], i);
    mask.data.set(car ? [255, 255, 255, 255] : [0, 0, 0, 255], i);
  }
  const sourceBytes = PNG.sync.write(source), maskBytes = PNG.sync.write(mask);
  const output = jpeg.decode(composeOriginalVehicle(sourceBytes, maskBytes, null, 'white'), { useTArray: true });
  assert.equal(output.width, 40); assert.equal(output.height, 80);
  const center = (40 * 40 + 20) * 4;
  assert.ok(Math.abs(output.data[center] - 180) < 5);
  assert.ok(Math.abs(output.data[center + 1] - 25) < 5);
  assert.ok(output.data[0] > 245 && output.data[1] > 245);
  const interior = jpeg.decode(composeOriginalVehicle(sourceBytes, null, null, 'white'), { useTArray: true });
  assert.ok(interior.data[1] > 100 && interior.data[0] < 35);
  assert.throws(() => composeOriginalVehicle(sourceBytes, PNG.sync.write(new PNG({ width: 10, height: 10 })), null, 'white'));
});

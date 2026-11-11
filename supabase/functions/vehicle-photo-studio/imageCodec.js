import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { Buffer } from 'node:buffer';
import { makePlateLogo, paintPlateLogos, validatePlates } from '../../../src/photoStudio/plates.js';
import { compositeSourcePixels } from '../../../src/photoStudio/subjectMask.js';
import { floorContactShadow, placeOriginalVehicle } from '../../../src/photoStudio/vehiclePlacement.js';
import { neutralizeInteriorViews } from './interiorWindows.js';

function decodeStudioPng(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Neplatný PNG podklad.');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  if (!width || !height || width * height > 4000000) throw new Error('Příliš velký PNG podklad.');
  return PNG.sync.read(buffer);
}

// No generated pixels are ever used on the protected vehicle.
export function composeOriginalVehicle(sourceBytes, maskBytes, backgroundBytes, backgroundName, options = {}) {
  const source = decodeStudioPng(sourceBytes), { width, height } = source;
  const background = new Uint8Array(width * height * 4);
  if (maskBytes) {
    if (backgroundBytes) {
      const plate = decodeStudioPng(backgroundBytes);
      const scale = Math.max(width / plate.width, height / plate.height);
      const offsetX = (plate.width * scale - width) / 2, offsetY = (plate.height * scale - height) / 2;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const sx = Math.min(plate.width - 1, Math.floor((x + offsetX) / scale)), sy = Math.min(plate.height - 1, Math.floor((y + offsetY) / scale));
        background.set(plate.data.subarray((sy * plate.width + sx) * 4, (sy * plate.width + sx) * 4 + 4), (y * width + x) * 4);
      }
    } else {
      if (!['white', 'gray'].includes(backgroundName)) throw new Error('Chybí vybrané pozadí.');
      for (let y = 0; y < height; y++) {
        const level = backgroundName === 'white' ? (y < height * .58 ? 255 : 246) : (y < height * .58 ? 235 : 222);
        for (let x = 0; x < width; x++) background.set([level, level, level, 255], (y * width + x) * 4);
      }
    }
    const decodedMask = decodeStudioPng(maskBytes);
    if (decodedMask.width !== width || decodedMask.height !== height) throw new Error('Rozměry masky nesouhlasí.');
    const mask = new Uint8Array(width * height); let count = 0;
    for (let i = 0; i < mask.length; i++) { mask[i] = decodedMask.data[i * 4] >= 128 ? 255 : 0; if (mask[i]) count++; }
    if (count < mask.length * .03 || count > mask.length * .95) throw new Error('Neplatný rozsah masky vozu.');
    const placed = placeOriginalVehicle(source.data, mask, width, height);
    const shadow = floorContactShadow(background, placed.profile, width, height);
    source.data = compositeSourcePixels(placed.pixels, shadow, placed.mask);
  } else if (options.angle === 'interior') {
    source.data = neutralizeInteriorViews(source, options.windows || []).data;
  }
  // Uniform input dimensions and perspective are retained. JPEG introduces only
  // the usual encoding differences; vehicle appearance is not synthesized.
  return new Uint8Array(jpeg.encode(source, 95).data);
}

export function renderMaskedJpeg(bytes, plates, logoPng) {
  validatePlates(plates);
  if (!plates.length) return bytes;
  const image = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 4, maxMemoryUsageInMB: 128 });
  const source = PNG.sync.read(Buffer.from(logoPng));
  if (source.width < 142 || source.height < 52 || source.width > 1024 || source.height > 1024) throw new Error('Neplatná předloha loga.');
  paintPlateLogos(image, makePlateLogo(source), plates);
  return new Uint8Array(jpeg.encode(image, 95).data);
}

export function cropPlateRegion(base64, quad) {
  validatePlates([quad]);
  const image = jpeg.decode(Buffer.from(base64, 'base64'), { useTArray: true, maxResolutionInMP: 4, maxMemoryUsageInMB: 128 });
  const xs = quad.map(p => p.x * image.width), ys = quad.map(p => p.y * image.height);
  const boxWidth = Math.max(...xs) - Math.min(...xs), boxHeight = Math.max(...ys) - Math.min(...ys);
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2, centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const halfWidth = Math.max(80, boxWidth * 1.6), halfHeight = Math.max(60, boxHeight * 1.5, boxWidth * .8);
  const left = Math.max(0, Math.floor(centerX - halfWidth)), top = Math.max(0, Math.floor(centerY - halfHeight));
  const width = Math.min(image.width, Math.ceil(centerX + halfWidth)) - left, height = Math.min(image.height, Math.ceil(centerY + halfHeight)) - top;
  const crop = { width, height, data: new Uint8Array(width * height * 4) };
  for (let y = 0; y < height; y++) crop.data.set(image.data.subarray(((top + y) * image.width + left) * 4, ((top + y) * image.width + left + width) * 4), y * width * 4);
  return { base64: Buffer.from(jpeg.encode(crop, 92).data).toString('base64'), left: left / image.width, top: top / image.height, width: width / image.width, height: height / image.height };
}

export function checkPlateRegion(base64, quad) {
  validatePlates([quad]);
  const image = jpeg.decode(Buffer.from(base64, 'base64'), { useTArray: true, maxResolutionInMP: 4, maxMemoryUsageInMB: 128 });
  let light = 0, dark = 0, transitions = 0;
  const bins = Array.from({ length: 8 }, () => ({ light: 0, dark: 0 }));
  for (let row = 0; row < 7; row++) {
    const v = .2 + row * .1; let previous = null, changes = 0;
    for (let column = 0; column < 64; column++) {
      const u = (column + .5) / 64;
      const x = (1 - v) * ((1 - u) * quad[0].x + u * quad[1].x) + v * ((1 - u) * quad[3].x + u * quad[2].x);
      const y = (1 - v) * ((1 - u) * quad[0].y + u * quad[1].y) + v * ((1 - u) * quad[3].y + u * quad[2].y);
      const i = (Math.min(image.height - 1, Math.floor(y * image.height)) * image.width + Math.min(image.width - 1, Math.floor(x * image.width))) * 4;
      const value = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
      if (value > 150) { light++; bins[Math.floor(column / 8)].light++; }
      if (value < 105) { dark++; bins[Math.floor(column / 8)].dark++; }
      const current = value > 150 ? 1 : value < 105 ? 0 : null;
      if (current !== null) { if (previous !== null && previous !== current) changes++; previous = current; }
    }
    transitions = Math.max(transitions, changes);
  }
  const mixed = bin => bin.light >= 5 && bin.dark >= 5;
  return light >= 36 && dark >= 36 && transitions >= 5 && bins.filter(mixed).length >= 5 && bins.slice(2, 6).filter(mixed).length >= 2;
}

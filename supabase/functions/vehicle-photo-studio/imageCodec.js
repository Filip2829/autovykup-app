import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { Buffer } from 'node:buffer';
import { paintPlateLogos, validatePlates } from '../../../src/photoStudio/plates.js';

export function renderMaskedJpeg(bytes, plates, logoPng) {
  validatePlates(plates);
  if (!plates.length) return bytes;
  const image = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 4, maxMemoryUsageInMB: 128 });
  const source = PNG.sync.read(Buffer.from(logoPng));
  if (source.width < 142 || source.height < 52 || source.width > 1024 || source.height > 1024) throw new Error('Neplatná předloha loga.');
  const logo = { width: 520, height: 110, data: new Uint8Array(520 * 110 * 4) };
  for (let y = 0; y < 110; y++) for (let x = 0; x < 520; x++) {
    const target = (y * 520 + x) * 4;
    logo.data.set([37, 35, 36, 255], target);
    if (x >= 78 && x < 444) {
      const offset = (Math.floor(12 + y * 40 / 110) * source.width + Math.floor(9 + (x - 78) * 133 / 366)) * 4;
      const alpha = source.data[offset + 3] / 255;
      for (let c = 0; c < 3; c++) logo.data[target + c] = Math.round(source.data[offset + c] * alpha + logo.data[target + c] * (1 - alpha));
    }
  }
  paintPlateLogos(image, logo, plates);
  return new Uint8Array(jpeg.encode(image, 95).data);
}

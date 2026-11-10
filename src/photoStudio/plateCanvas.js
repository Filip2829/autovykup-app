import { paintPlateLogos } from './plates.js';
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image); image.onerror = () => reject(new Error('Fotografii nebo logo nelze načíst.'));
    image.src = url;
  });
}
let logoPromise;
async function logoPixels() {
  if (!logoPromise) logoPromise = loadImage('/photo-studio/opportunity-logo.png').then(image => {
    const canvas = document.createElement('canvas'); canvas.width = 520; canvas.height = 110;
    const context = canvas.getContext('2d'); context.fillStyle = '#252324'; context.fillRect(0, 0, 520, 110);
    // Use the supplied original logo, excluding the white screenshot margins.
    context.drawImage(image, 9, 12, 133, 40, 78, 0, 366, 110);
    return context.getImageData(0, 0, 520, 110);
  }).catch(error => { logoPromise = null; throw error; });
  return logoPromise;
}
export async function drawPlatePhoto(canvas, url, plates) {
  const image = await loadImage(url);
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
  if (plates.length) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    context.putImageData(paintPlateLogos(pixels, await logoPixels(), plates), 0, 0);
  }
}
export async function platePhotoBlob(url, plates) {
  const canvas = document.createElement('canvas');
  await drawPlatePhoto(canvas, url, plates);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
  if (!blob) throw new Error('Export zakryté fotografie se nezdařil.');
  return blob;
}

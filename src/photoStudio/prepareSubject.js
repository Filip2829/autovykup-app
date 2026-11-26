import { protectSubjectMask } from './subjectMask.js';
import { centerCaptureCrop, isInteriorShot } from './captureStandard.js';

export function drawCaptureFrame(canvas, image, width, height, guided = true) {
  const crop = guided ? centerCaptureCrop(width, height) : { x: 0, y: 0, width, height };
  const scale = Math.min(1, 1280 / Math.max(crop.width, crop.height));
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  canvas.getContext('2d').drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
}

let worker;
function automaticMask(source, onProgress) {
  worker ||= new Worker(new URL('./subject.worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const active = worker;
    const cleanup = () => { clearTimeout(timer); active.onmessage = null; active.onerror = null; };
    const fail = cause => { cleanup(); active.terminate(); worker = null; reject(new Error('Automatické oddělení vozu se nezdařilo. Originál nebyl upraven. Zkuste fotografii znovu.', { cause })); };
    const timer = setTimeout(fail, 240000);
    active.onerror = fail;
    active.onmessage = ({ data }) => {
      if (data.error) return fail(new Error(data.error));
      if (data.values) { cleanup(); resolve(data); }
      else if (data.phase === 'inference') onProgress?.('Odděluji vůz od pozadí; tvar a barvu zachovám…');
      else if (data.progress !== undefined) onProgress?.(`Načítám model pro oddělení vozu: ${data.progress} %…`);
    };
    active.postMessage({ source });
  });
}

export async function prepareStudioSubject(file, angle, onProgress, inspect, guided = false) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas');
    drawCaptureFrame(canvas, bitmap, bitmap.width, bitmap.height, guided);
    const context = canvas.getContext('2d');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Fotografii se nepodařilo připravit.');
    const source = new File([blob], 'source.png', { type: 'image/png' });
    onProgress?.('Rozpoznávám obsah snímku a viditelné okolí…');
    const inspection = inspect ? await inspect(source) : { scene: isInteriorShot(angle) ? 'interior' : angle === 'detail' ? 'exterior_detail' : 'exterior', backgroundVisible: !isInteriorShot(angle) && angle !== 'detail', conditionEvidence: angle === 'detail', confidence: 1 };
    if (!inspection || !['exterior', 'exterior_detail', 'interior', 'interior_detail'].includes(inspection.scene) || typeof inspection.backgroundVisible !== 'boolean') throw new Error('Obsah fotografie se nepodařilo rozpoznat. Zkuste ji nahrát znovu.');
    const prepared = { source, inspection: JSON.stringify(inspection) };
    if (inspection.scene !== 'exterior' || !inspection.backgroundVisible) return prepared;
    onProgress?.('Automaticky odděluji původní vůz od pozadí…');
    const result = await automaticMask(blob, onProgress);
    if (result.width !== canvas.width || result.height !== canvas.height) throw new Error('Rozměry masky vozu nesouhlasí.');
    const mask = protectSubjectMask(result.values, result.width, result.height);
    const image = context.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < mask.length; i++) image.data.set([mask[i], mask[i], mask[i], 255], i * 4);
    context.putImageData(image, 0, 0);
    const maskBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!maskBlob) throw new Error('Masku vozu se nepodařilo uložit.');
    return { ...prepared, vehicleMask: new File([maskBlob], 'vehicle-mask.png', { type: 'image/png' }) };
  } finally { bitmap.close(); }
}

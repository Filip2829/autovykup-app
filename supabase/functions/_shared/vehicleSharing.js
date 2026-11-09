import { shots } from './onlineValuation.js';

const buckets = new Set(['car-photos', 'vehicle-documents', 'valuation-photos']);
const tpShots = new Set(['registration_front', 'registration_back']);
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const value = (...values) => values.map(text).find(Boolean) || '';
const yesNo = v => v === true || v === 'yes' ? 'yes' : v === false || v === 'no' ? 'no' : 'unknown';
const unsafePath = path => path.includes('\\') || [...path].some(c => c.charCodeAt(0) < 32) || path.split('/').some(p => !p || p === '.' || p === '..');
function normalizedDate(raw) {
  const input = text(raw);
  const czech = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const date = czech ? `${czech[3]}-${czech[2].padStart(2,'0')}-${czech[1].padStart(2,'0')}` : input;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date ? date : '';
}

export function storageRef(raw, projectUrl) {
  if (typeof raw !== 'string') throw new Error('Neplatný odkaz na soubor.');
  const url = new URL(raw);
  if (url.origin !== new URL(projectUrl).origin) throw new Error('Soubor musí být uložen v AutoVýkupu.');
  const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!match || !buckets.has(match[1])) throw new Error('Nepodporované úložiště souboru.');
  const path = decodeURIComponent(match[2]);
  if (unsafePath(path)) throw new Error('Neplatná cesta souboru.');
  return { bucket: match[1], path };
}

export function buildShareSource({ car, request, photos = [], documents = [], attachments = [] }, projectUrl) {
  const technical = car?.technical_params || {};
  const d = request?.data || technical.onlineValuation || {};
  const assets = new Map();
  const add = (ref, kind, title, mime = '') => {
    if (!buckets.has(ref.bucket) || !ref.path || unsafePath(ref.path)) throw new Error('Neplatný podklad vozidla.');
    const key = `${ref.bucket}:${ref.path}`;
    const prior = assets.get(key);
    // A document must never reappear as a vehicle photo through a legacy array.
    if (prior && prior.kind !== 'photo') return;
    assets.set(key, { ...ref, kind, title, mime });
  };
  const addUrls = (urls, kind, title) => list(urls).forEach((url, i) => add(storageRef(url, projectUrl), kind, `${title} ${i + 1}`));
  addUrls(car?.photos, 'photo', 'Fotografie vozu');
  addUrls(car?.technical_card_photos, 'tp', 'Technický průkaz');
  addUrls(car?.cebia_files, 'cebia', 'Výpis CEBIA');
  for (const doc of documents) {
    const kind = doc.category === 'Technický průkaz' || /^Technický průkaz/.test(doc.title || '') ? 'tp' : doc.category === 'CEBIA' ? 'cebia' : null;
    if (kind && doc.file_path) add({ bucket: 'vehicle-documents', path: doc.file_path }, kind, doc.title || doc.file_name || 'Dokument', doc.mime_type);
  }
  for (const photo of photos.filter(p => !p.removed)) {
    if (!request || photo.request_id !== request.id || !photo.path.startsWith(`${request.id}/`) || !Object.hasOwn(shots, photo.shot)) throw new Error('Fotografie nepatří k poptávce.');
    const kind = tpShots.has(photo.shot) ? 'tp' : 'photo';
    // Converted photos already exist under a deterministic destination; share once.
    const copiedPath = kind === 'tp' ? `${car?.id}/online-valuation-${photo.id}.jpg` : `vehicle-photos/${car?.id}-online-valuation-${photo.id}.jpg`;
    if (car && (documents.some(doc => doc.id === photo.id) || assets.has(`car-photos:${copiedPath}`))) continue;
    add({ bucket: 'valuation-photos', path: photo.path }, kind, shots[photo.shot], 'image/jpeg');
  }
  for (const file of attachments) {
    if (!['tp','cebia'].includes(file.kind) || !((car && String(file.car_id) === String(car.id)) || (request && file.request_id === request.id))) throw new Error('Dokument nepatří k tomuto záznamu.');
    add({ bucket: 'vehicle-documents', path: file.object_path }, file.kind, file.title, file.mime_type);
  }
  const files = [...assets.values()].map(asset => ({ ...asset, id: `${asset.bucket}:${asset.path}` }));
  if (files.length > 250) throw new Error('Nabídka má více než 250 podkladů. Zkontrolujte soubory před sdílením.');
  const vehicle = {
    name: value(car?.name, `${value(technical.brand, d.brand)} ${value(technical.model, d.model)}`),
    brand: value(technical.brand, d.brand), model: value(technical.model, d.model),
    vin: value(car?.vin, d.vin), spz: value(car?.spz, d.spz), year: value(car?.year, d.year),
    km: value(car?.km, d.km), fuel: value(technical.fuel, d.fuel), engine: value(technical.engine, d.engine),
    transmission: value(technical.transmission, d.transmission), drive: value(technical.drive, d.drive),
    powerKw: text(technical.powerKw), color: text(technical.color),
    stkValidUntil: normalizedDate(technical.stkValidUntil), stkDeclared: yesNo(d.stk),
    vat: yesNo(technical.vatDeductible ?? d.vat),
  };
  return { vehicle, files };
}

export function buildSharedSnapshot(source, options) {
  const selected = new Set(list(options.fileIds));
  if (!selected.size || [...selected].some(id => !source.files.some(f => f.id === id))) throw new Error('Vyberte dostupné podklady ke sdílení.');
  if (!['aaa', 'buyer'].includes(options.audience)) throw new Error('Vyberte účel nabídky.');
  if (!['yes', 'no', 'unknown'].includes(options.vat)) throw new Error('Zkontrolujte údaj o DPH.');
  const date = text(options.stkValidUntil);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Zkontrolujte datum platnosti STK.');
  const message = text(options.message);
  if (message.length > 2000) throw new Error('Zpráva může mít nejvýše 2000 znaků.');
  return {
    vehicle: { ...source.vehicle, stkValidUntil: date, vat: options.vat },
    files: source.files.filter(f => selected.has(f.id)),
    audience: options.audience, message,
  };
}

export function shareCompleteness(snapshot) {
  const kinds = new Set(snapshot.files.map(f => f.kind));
  return [!kinds.has('photo') && 'Fotografie vozu', snapshot.audience !== 'buyer' && !kinds.has('tp') && 'Technický průkaz',
    snapshot.audience !== 'buyer' && !kinds.has('cebia') && 'Výpis CEBIA', !snapshot.vehicle.stkValidUntil && 'Datum platnosti STK',
    snapshot.vehicle.vat === 'unknown' && 'Odpočet DPH'].filter(Boolean);
}

export async function loadShareSource(db, type, id, projectUrl) {
  if (!['car', 'request'].includes(type) || (type === 'car' ? !/^\d+$/.test(String(id)) : !/^[\da-f-]{36}$/i.test(String(id)))) throw new Error('Neplatný záznam.');
  const checked = async query => { const { data, error } = await query; if (error) throw error; return data; };
  let car = null, request;
  if (type === 'car') {
    car = await checked(db.from('cars').select('*').eq('id', id).single());
    request = await checked(db.from('valuation_requests').select('id,is_test,status,data,converted_car_id').eq('converted_car_id', id).maybeSingle());
  } else {
    request = await checked(db.from('valuation_requests').select('id,is_test,status,data,converted_car_id').eq('id', id).single());
    if (request.converted_car_id) car = await checked(db.from('cars').select('*').eq('id', request.converted_car_id).single());
  }
  if (request && (request.is_test || request.status === 'draft')) throw new Error('Testovací nebo neodeslanou poptávku nelze sdílet.');
  const [photos, documents, carAttachments, requestAttachments] = await Promise.all([
    request ? checked(db.from('valuation_photos').select('id,request_id,path,shot,removed').eq('request_id', request.id).eq('removed', false).order('created_at')) : [],
    car ? checked(db.from('vehicle_documents').select('id,title,category,file_path,file_name,mime_type').eq('car_id', car.id).order('created_at')) : [],
    car ? checked(db.from('vehicle_share_attachments').select('*').eq('car_id', car.id).order('created_at')) : [],
    request ? checked(db.from('vehicle_share_attachments').select('*').eq('request_id', request.id).order('created_at')) : [],
  ]);
  return buildShareSource({ car, request, photos, documents, attachments: [...carAttachments, ...requestAttachments] }, projectUrl);
}

export function validateShareUpload(bytes, mime, kind) {
  if (!['tp', 'cebia'].includes(kind) || !bytes.length || bytes.length > 10485760) throw new Error('Vyberte TP nebo CEBIA do 10 MB.');
  const match = mime === 'application/pdf' ? [37,80,68,70,45].every((b,i) => bytes[i] === b)
    : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === 'image/png' ? [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)
    : mime === 'image/webp' ? String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP' : false;
  if (!match) throw new Error('Podporované soubory: PDF, JPEG, PNG a WebP.');
}

export async function signShareFiles(db, snapshot, expiresAt, strict = false) {
  const remaining = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
  if (remaining <= 0) throw new Error('Platnost odkazu skončila.');
  const ttl = Math.min(300, remaining);
  const files = await Promise.all(snapshot.files.map(async file => {
    const { data, error } = await db.storage.from(file.bucket).createSignedUrl(file.path, ttl);
    if ((error || !data?.signedUrl) && strict) throw new Error('Některý podklad již není dostupný. Obraťte se na prodejce.');
    return { id: file.id, kind: file.kind, title: file.title, mime: file.mime || '', url: error ? null : data?.signedUrl || null };
  }));
  return { vehicle: snapshot.vehicle, audience: snapshot.audience, message: snapshot.message || '', files,
    missing: [...shareCompleteness(snapshot), ...files.filter(f => !f.url).map(f => `Nedostupný soubor: ${f.title}`)], expiresAt };
}

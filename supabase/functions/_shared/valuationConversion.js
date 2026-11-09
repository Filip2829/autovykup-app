import { priceFields, priceLabel, questions, shots } from './onlineValuation.js';

const documentShots = new Set(['registration_front', 'registration_back']);
const present = value => value !== null && value !== undefined && value !== '';
const array = value => Array.isArray(value) ? value : [];
const answer = value => ({ yes: 'Ano', no: 'Ne', unknown: 'Nevím', true: 'Ano', false: 'Ne' })[String(value)] ?? String(value);
const labels = {
  owner: 'Majitel', last_service: 'Poslední servis', equipment_description: 'Výbava',
  additional: 'Další informace', accident_description: 'Popis havárie',
  damage_description: 'Popis poškození', faults_description: 'Popis závad',
  service_history: 'Doplněná servisní historie', supplement: 'Doplněné informace',
  preferred_contact: 'Preferovaný kontakt', marketing_consent: 'Marketingový souhlas',
  privacy_version: 'Verze informací GDPR',
};

export function mediaDestination(photo, carId, requestId) {
  if (!/^[\da-f-]{36}$/i.test(photo.id) || !/^\d+$/.test(String(carId)) || !Object.hasOwn(shots, photo.shot)
    || photo.path !== `${requestId}/${photo.path?.split('/')[1]}` || !/^[\da-f-]{36}\.jpg$/i.test(photo.path?.split('/')[1] || '')) {
    throw new Error('Neplatná vazba fotografie na poptávku.');
  }
  const document = documentShots.has(photo.shot);
  return {
    document,
    bucket: document ? 'vehicle-documents' : 'car-photos',
    path: document ? `${carId}/online-valuation-${photo.id}.jpg` : `vehicle-photos/${carId}-online-valuation-${photo.id}.jpg`,
    title: shots[photo.shot] || 'Fotografie z poptávky',
  };
}

// Add missing fields; never replace an existing colleague's work on a linked card.
export function buildConversionPatch(car, request, notes, authors, media, username, now) {
  const d = request.data || {};
  const p = request.pricing || {};
  const technical = { ...(car.technical_params || {}) };
  for (const key of ['brand', 'model', 'fuel', 'engine', 'transmission', 'drive', 'vin', 'spz']) {
    if (!present(technical[key]) && present(d[key])) technical[key] = d[key];
  }
  if (!present(technical.firstRegistration) && present(d.year)) technical.firstRegistration = String(d.year);
  technical.onlineValuation = d;
  technical.onlineValuationPricing = p;
  technical.onlineValuationTransfer = {
    version: 1, requestId: request.id, revision: request.revision, completedAt: now,
    photoIds: media.map(m => m.id), noteIds: notes.map(n => n.id),
  };
  const prefix = `Poptávka ${request.number}`;
  const customerLines = Object.entries({ ...questions, ...labels })
    .filter(([key]) => present(d[key]))
    .map(([key, label]) => `${label}: ${answer(d[key])}`);
  const importedNotes = [
    customerLines.length ? `${prefix} · údaje zákazníka\n${customerLines.join('\n')}` : '',
    ...notes.map(n => `${prefix} · ${authors[n.author] || n.author} · ${n.updated_at}\n${n.body}`),
    [p.comment ? `Interní komentář: ${p.comment}` : '', ...Object.entries(priceFields)
      .filter(([key]) => present(p[key])).map(([key, label]) => `${label}: ${priceLabel(p[key])}`)]
      .filter(Boolean).join('\n'),
  ].filter(Boolean);
  const customer = { ...(car.customer_info || {}) };
  for (const [key, value] of Object.entries({ firstName: d.full_name, phone: d.phone, email: d.email })) {
    if (!present(customer[key]) && present(value)) customer[key] = value;
  }
  // Keep the full name exactly as supplied; the form has no separate surname field.
  customer.fullName = d.full_name || customer.fullName || '';
  customer.preferredContact = d.preferred_contact || customer.preferredContact || '';
  const damage = { ...(car.damage_report || {}) };
  for (const [key, value] of Object.entries({ exterior: d.damage_description, technical: d.faults_description, otherDamage: d.accident_description, repairCostEstimate: p.preparation_cost })) {
    if (!present(damage[key]) && present(value)) damage[key] = value;
  }
  const patch = {
    technical_params: technical, customer_info: customer, damage_report: damage,
    notes: [...new Set([...array(car.notes), ...importedNotes])],
    photos: [...new Set([...array(car.photos), ...media.filter(m => !m.document).map(m => m.url)])],
    updated_by: username, updated_at: now,
  };
  for (const key of ['buy_estimate', 'buy_estimate_max', 'approved_price', 'approved_price_max', 'sale_estimate']) {
    if (!present(car[key]) && present(p[key])) patch[key] = p[key];
  }
  if (!present(car.customer_expected_price) && present(d.customer_expected_price)) patch.customer_expected_price = d.customer_expected_price;
  return patch;
}

async function checked(result) {
  const { data, error } = await result;
  if (error) throw error;
  return data;
}

// Storage and Postgres cannot share a transaction. Deterministic IDs plus a final
// compare-and-swap make an interrupted transfer resumable without duplicate cards/files.
export async function convertValuation(db, { id, actor, username, revision }, now = () => new Date().toISOString()) {
  let request = await checked(db.from('valuation_requests').select('*').eq('id', id).single());
  if (request.is_test || request.status === 'draft') throw new Error('Převádět lze pouze skutečně odeslané poptávky.');
  if (revision == null || request.revision !== revision) throw new Error('Poptávku mezitím někdo změnil. Obnovte detail před převodem.');
  const result = await checked(db.rpc('valuation_action', { p_action: 'convert', p_id: id, p_actor: actor, p_hash: '', p: { username } }));
  const carId = result.car_id;
  request = await checked(db.from('valuation_requests').select('*').eq('id', id).eq('converted_car_id', carId).single());
  let car = await checked(db.from('cars').select('*').eq('id', carId).single());
  if (car.technical_params?.onlineValuationTransfer?.requestId === id && car.technical_params.onlineValuationTransfer.version === 1) {
    return { ...result, transfer_complete: true };
  }
  const [photos, notes, staff] = await Promise.all([
    checked(db.from('valuation_photos').select('*').eq('request_id', id).eq('removed', false).order('created_at')),
    checked(db.from('valuation_notes').select('*').eq('request_id', id).order('created_at')),
    checked(db.from('valuation_staff').select('user_id,label')),
  ]);
  const media = [];
  for (const photo of photos) {
    const destination = mediaDestination(photo, carId, id);
    const source = await checked(db.storage.from('valuation-photos').download(photo.path));
    const { error } = await db.storage.from(destination.bucket).upload(destination.path, source, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      // Storage versions use different duplicate error codes. Accept a retry only
      // when the destination can be read and its bytes match the original exactly.
      const { data: existing, error: readError } = await db.storage.from(destination.bucket).download(destination.path);
      if (readError || !existing) throw error;
      const [a, b] = await Promise.all([source.arrayBuffer(), existing.arrayBuffer()]);
      const bytes = new Uint8Array(a);
      const existingBytes = new Uint8Array(b);
      if (a.byteLength !== b.byteLength || bytes.some((v, i) => v !== existingBytes[i])) throw new Error('Cílový soubor již existuje s jiným obsahem.');
    }
    if (destination.document) {
      const doc = {
        id: photo.id, car_id: carId, title: destination.title, category: 'Technický průkaz',
        description: `Z poptávky ${request.number}`, file_path: destination.path,
        file_name: `${photo.shot}.jpg`, file_size: source.size, mime_type: 'image/jpeg',
        uploaded_by: username, is_visible_to_customer: false,
      };
      await checked(db.from('vehicle_documents').upsert(doc, { onConflict: 'id', ignoreDuplicates: true }));
      const saved = await checked(db.from('vehicle_documents').select('car_id,file_path').eq('id', photo.id).single());
      if (String(saved.car_id) !== String(carId) || saved.file_path !== destination.path) throw new Error('Dokument je navázán na jiný vůz.');
    }
    const url = destination.document ? null : db.storage.from(destination.bucket).getPublicUrl(destination.path).data.publicUrl;
    media.push({ ...destination, id: photo.id, url });
  }
  const currentRequest = await checked(db.from('valuation_requests').select('revision,converted_car_id').eq('id', id).single());
  if (currentRequest.revision !== request.revision || String(currentRequest.converted_car_id) !== String(carId)) {
    throw new Error('Poptávka se během přenosu změnila. Obnovte detail a zopakujte dokončení přenosu.');
  }
  // Retry against the latest card if a colleague edited it while files were copying.
  for (let attempt = 0; attempt < 3; attempt++) {
    car = await checked(db.from('cars').select('*').eq('id', carId).single());
    if (car.technical_params?.onlineValuationTransfer?.requestId === id && car.technical_params.onlineValuationTransfer.version === 1) return { ...result, transfer_complete: true };
    const patch = buildConversionPatch(car, request, notes, Object.fromEntries(staff.map(s => [s.user_id, s.label])), media, username, now());
    let update = db.from('cars').update(patch).eq('id', carId);
    for (const key of ['updated_at', 'technical_params', 'customer_info', 'damage_report', 'notes', 'photos']) {
      update = car[key] == null ? update.is(key, null) : update.eq(key, typeof car[key] === 'object' ? JSON.stringify(car[key]) : car[key]);
    }
    const saved = await checked(update.select('id').maybeSingle());
    if (saved) return { ...result, transfer_complete: true };
  }
  throw new Error('Kartu mezitím měnil kolega. Obnovte detail a zopakujte dokončení přenosu.');
}

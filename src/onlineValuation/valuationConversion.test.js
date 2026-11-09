import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConversionPatch, convertValuation, mediaDestination } from '../../supabase/functions/_shared/valuationConversion.js';

const id = '11111111-1111-4111-8111-111111111111';
const photoId = '22222222-2222-4222-8222-222222222222';
const tpId = '33333333-3333-4333-8333-333333333333';
const now = '2026-11-09T12:00:00.000Z';
const request = { id, number: 'ON-2026-TEST', is_test: false, status: 'in_progress', revision: 2, converted_car_id: null,
  data: { brand: 'Renault', model: 'Clio', full_name: 'Jan Novák', phone: '+420777123456', email: 'jan@example.invalid',
    drive: 'přední', fuel: 'Benzín', year: 2020, equipment_description: 'Tempomat', keys: 'yes', financed: 'unknown',
    accident_description: 'Opravený nárazník', damage_description: 'Oděrka', faults_description: 'Hlučné ložisko',
    preferred_contact: 'email', marketing_consent: false, customer_expected_price: 200000, supplement: 'Doplněno zákazníkem' },
  pricing: { buy_estimate: 180000, buy_estimate_max: 190000, approved_price: 185000, approved_price_max: 187000,
    sale_estimate: 220000, preparation_cost: 12000, comment: 'Volat v pátek' } };
const notes = [{ id: 'note-1', request_id: id, author: 'staff-1', updated_at: now, body: 'Zkontrolovat servis.' }];
const photo = { id: photoId, request_id: id, shot: 'front', path: `${id}/${photoId}.jpg`, removed: false };
const tp = { id: tpId, request_id: id, shot: 'registration_front', path: `${id}/${tpId}.jpg`, removed: false };

function fakeDb({ failUploadOnce = false, race = false, testRequest = false, failAttachOnce = false } = {}) {
  const tables = { valuation_requests: [{ ...structuredClone(request), is_test: testRequest }], cars: [],
    valuation_photos: [structuredClone(photo), structuredClone(tp), { ...photo, id: 'removed', removed: true }],
    valuation_notes: structuredClone(notes), valuation_staff: [{ user_id: 'staff-1', label: 'Kolega' }], vehicle_documents: [] };
  const files = new Map([[`valuation-photos/${photo.path}`, new Blob(['car'])], [`valuation-photos/${tp.path}`, new Blob(['private TP'])]]);
  let creates = 0;
  const db = { tables, files, get creates() { return creates; },
    async rpc(name, args) {
      assert.equal(name, 'valuation_action'); assert.equal(args.p_action, 'convert');
      const r = tables.valuation_requests[0];
      if (!r.converted_car_id) { r.converted_car_id = 42; r.revision++; creates++;
        tables.cars.push({ id: 42, name: 'Renault Clio', updated_at: now, technical_params: {}, customer_info: {}, damage_report: null, notes: [], photos: [] }); }
      return { data: { car_id: 42, number: r.number }, error: null };
    },
    storage: { from(bucket) { return {
      async download(path) { const data = files.get(`${bucket}/${path}`); return { data, error: data ? null : new Error('Missing source') }; },
      async upload(path, blob, options) {
        assert.equal(options.upsert, false);
        if (failUploadOnce && bucket === 'vehicle-documents') { failUploadOnce = false; return { error: new Error('Storage offline') }; }
        const key = `${bucket}/${path}`;
        if (files.has(key)) return { error: { statusCode: 'Duplicate', status: 400 } };
        files.set(key, blob); return { error: null };
      },
      getPublicUrl(path) { return { data: { publicUrl: `https://storage.example/${bucket}/${path}` } }; },
    }; } },
    from(table) {
      let mode = 'read', payload, single = false; const filters = [];
      const q = {
        select() { return q; }, order() { return q; },
        eq(k, v) { filters.push(r => typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) === v : r[k] === v); return q; },
        is(k, v) { filters.push(r => r[k] === v); return q; },
        single() { single = true; return q; }, maybeSingle() { single = true; return q; },
        update(p) { mode = 'update'; payload = p; return q; },
        upsert(p) { mode = 'upsert'; payload = p; return q; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          if (mode === 'upsert') { if (!tables[table].some(r => r.id === payload.id)) tables[table].push(structuredClone(payload)); return { data: null, error: null }; }
          if (mode === 'update' && failAttachOnce) { failAttachOnce = false; return { data: null, error: new Error('Database offline') }; }
          if (mode === 'update' && race) { race = false; Object.assign(tables.cars[0], { notes: ['Poznámka kolegy'], updated_at: '2026-11-09T12:01:00Z', technical_params: { drive: 'Ověřeno kolegou' } }); }
          const rows = tables[table].filter(r => filters.every(f => f(r)));
          if (mode === 'update') rows.forEach(r => Object.assign(r, structuredClone(payload)));
          return { data: structuredClone(single ? rows[0] || null : rows), error: null };
        }).then(resolve, reject); },
      }; return q;
    },
  }; return db;
}
const args = db => ({ id, actor: 'staff-1', username: 'kralik', revision: db.tables.valuation_requests[0].revision });

test('complete conversion routes car photos and private TP, prices, customer details and staff notes', async () => {
  const db = fakeDb(); const result = await convertValuation(db, args(db), () => now);
  assert.equal(result.transfer_complete, true); assert.equal(db.creates, 1);
  const car = db.tables.cars[0];
  assert.equal(car.photos.length, 1); assert.ok(car.photos[0].includes('car-photos/vehicle-photos/42-'));
  assert.equal(db.tables.vehicle_documents.length, 1);
  const doc = db.tables.vehicle_documents[0];
  assert.equal(doc.category, 'Technický průkaz'); assert.equal(doc.is_visible_to_customer, false); assert.ok(db.files.has(`vehicle-documents/${doc.file_path}`));
  assert.equal(car.customer_info.email, request.data.email); assert.equal(car.technical_params.drive, 'přední');
  assert.deepEqual(car.technical_params.onlineValuation, request.data);
  assert.deepEqual(car.technical_params.onlineValuationPricing, request.pricing);
  assert.equal(car.buy_estimate_max, 190000); assert.equal(car.approved_price_max, 187000); assert.equal(car.sale_estimate, 220000);
  assert.equal(car.customer_expected_price, 200000); assert.equal(car.damage_report.technical, 'Hlučné ložisko'); assert.equal(car.damage_report.repairCostEstimate, 12000);
  assert.ok(car.notes.some(n => n.includes('Kolega') && n.includes('Zkontrolovat servis.')));
  assert.ok(car.notes.some(n => n.includes('Volat v pátek'))); assert.ok(car.notes.some(n => n.includes('Doplněno zákazníkem') && n.includes('Marketingový souhlas: Ne')));
  assert.equal([...db.files.keys()].filter(p => p.startsWith('car-photos/')).length, 1);
});

test('retry after a partial storage failure reuses the same car and files and preserves originals', async () => {
  const db = fakeDb({ failUploadOnce: true }); await assert.rejects(convertValuation(db, args(db)), /Storage offline/);
  assert.equal(db.tables.cars[0].technical_params.onlineValuationTransfer, undefined);
  await convertValuation(db, args(db)); const snapshot = structuredClone(db.tables.cars[0]);
  await convertValuation(db, args(db));
  assert.equal(db.creates, 1); assert.equal(db.tables.vehicle_documents.length, 1); assert.deepEqual(db.tables.cars[0], snapshot);
  assert.equal([...db.files.keys()].filter(p => p.startsWith('valuation-photos/')).length, 2);
});

test('retry after a database failure does not duplicate documents or photographs', async () => {
  const db = fakeDb({ failAttachOnce: true }); await assert.rejects(convertValuation(db, args(db)), /Database offline/);
  await convertValuation(db, args(db));
  assert.equal(db.creates, 1); assert.equal(db.tables.vehicle_documents.length, 1); assert.equal(db.tables.cars[0].photos.length, 1);
});

test('concurrent card edit is preserved when the attachment write retries', async () => {
  const db = fakeDb({ race: true }); await convertValuation(db, args(db));
  assert.equal(db.tables.cars[0].technical_params.drive, 'Ověřeno kolegou');
  assert.ok(db.tables.cars[0].notes.includes('Poznámka kolegy'));
});

test('test requests and stale revisions never create cars or upload media', async () => {
  for (const db of [fakeDb({ testRequest: true }), fakeDb()]) {
    await assert.rejects(convertValuation(db, { ...args(db), revision: -1 })); assert.equal(db.creates, 0); assert.equal(db.files.size, 2);
  }
});

test('unsafe photo paths and unrecognized categories are rejected', () => {
  for (const path of [`another/${photoId}.jpg`, `${id}/../secret.jpg`, `${id}/${photoId}.jpg/extra`]) assert.throws(() => mediaDestination({ ...photo, path }, 42, id));
  assert.throws(() => mediaDestination({ ...photo, shot: 'unknown' }, 42, id));
  assert.equal(mediaDestination(tp, 42, id).document, true);
});

test('legacy linked cards keep existing prices, notes, photos and manual technical data', () => {
  const car = { technical_params: { drive: '4x4', custom: 'keep' }, customer_info: { phone: 'new phone' }, notes: ['Ručně'], photos: ['existing.jpg'], approved_price: '999', damage_report: { exterior: 'Ručně popsané' } };
  const p = buildConversionPatch(car, request, notes, { 'staff-1': 'Kolega' }, [], 'kralik', now);
  assert.equal(p.approved_price, undefined); assert.equal(p.customer_info.phone, 'new phone'); assert.equal(p.technical_params.drive, '4x4'); assert.equal(p.damage_report.exterior, 'Ručně popsané');
  assert.deepEqual(p.photos, ['existing.jpg']); assert.ok(p.notes.includes('Ručně'));
});

test('a mismatched existing target cannot silently replace the source photo', async () => {
  const db = fakeDb();
  db.files.set(`car-photos/${mediaDestination(photo, 42, id).path}`, new Blob(['wrong contents']));
  await assert.rejects(convertValuation(db, args(db)), /jiným obsahem/);
  assert.equal(db.tables.cars[0].technical_params.onlineValuationTransfer, undefined);
});

test('missing originals fail explicitly and never mark an incomplete transfer as finished', async () => {
  const db = fakeDb(); db.files.delete(`valuation-photos/${tp.path}`);
  await assert.rejects(convertValuation(db, args(db)), /Missing source/);
  assert.equal(db.tables.cars[0].technical_params.onlineValuationTransfer, undefined);
});

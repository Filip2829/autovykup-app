import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFormPatch, buildMarketPayload, buildNewInspection, changedFormFields, readInspectionForm, validateInspectionForm } from './inspectionModel.js';
import { createInspectionService, DuplicateInspectionError } from './inspectionService.js';
import { readInspectionDraft, reconcileSavedForm, writeInspectionDraft } from './inspectionDraft.js';

const fixture = () => ({ ...readInspectionForm(), brand: 'Renault', model: 'Clio', spz: '1AB 2345', vin: 'VF1FL000272669224', year: '2020', km: '50000', fuel: 'Benzín', customerName: 'Testovací zákazník' });
const uuid = '11111111-1111-4111-8111-111111111111';
const instant = '2026-11-09T14:00:00.000Z';

function fakeClient() {
  const tables = { cars: [], vehicle_documents: [] }, objects = new Map(), calls = [];
  const state = { loseInsertResponse: false, loseUpdateResponse: false, rejectUpdate: false, rejectDocument: false, functionError: null };
  let sequence = 0;
  const client = { tables, objects, calls, state,
    functions: { async invoke(name, { body }) { calls.push({ name, body }); return state.functionError ? { error: new Error(state.functionError) } : { data: { technicalParams: { fuel: 'Benzín', powerKw: '66' }, report: 'Výpis registru' }, error: null }; } },
    storage: { from(bucket) { return {
      async upload(path, file) { const key = `${bucket}/${path}`; if (objects.has(key)) return { error: new Error('exists') }; objects.set(key, file); return { error: null }; },
      async download(path) { const data = objects.get(`${bucket}/${path}`); return { data, error: data ? null : new Error('not found') }; },
      async remove(paths) { calls.push({ removed: paths }); paths.forEach(path => objects.delete(`${bucket}/${path}`)); return { error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` } }; },
      async createSignedUrl(path) { return { data: { signedUrl: `https://test.supabase.co/signed/${bucket}/${path}` }, error: null }; },
    }; } },
    from(table) {
      let mode = 'read', payload, single = false; const filters = [];
      const q = {
        select() { return q; }, order() { return q; }, limit() { return q; },
        eq(k,v) { filters.push(row => String(row[k]) === String(v)); return q; },
        is(k,v) { filters.push(row => row[k] === v); return q; },
        contains(k,v) { filters.push(row => row[k]?.mobileInspection?.version === v.mobileInspection.version); return q; },
        single() { single = true; return q; }, maybeSingle() { single = true; return q; },
        insert(p) { mode = 'insert'; payload = p; return q; }, update(p) { mode = 'update'; payload = p; return q; },
        then(resolve,reject) { return Promise.resolve().then(() => {
          if (mode === 'insert' && table === 'vehicle_documents' && state.rejectDocument) return { data: null, error: new Error('document offline') };
          if (mode === 'update' && state.rejectUpdate) return { data: null, error: new Error('update offline') };
          let rows = tables[table].filter(row => filters.every(fn => fn(row)));
          if (mode === 'insert') { const row = { id: ++sequence, ...structuredClone(payload) }; tables[table].push(row); rows = [row]; }
          if (mode === 'update') rows.forEach(row => Object.assign(row, structuredClone(payload)));
          if (mode === 'insert' && table === 'cars' && state.loseInsertResponse) { state.loseInsertResponse = false; return { data: null, error: new Error('response lost') }; }
          if (mode === 'update' && state.loseUpdateResponse) { state.loseUpdateResponse = false; return { data: null, error: new Error('response lost') }; }
          return { data: structuredClone(single ? rows[0] || null : rows), error: null };
        }).then(resolve,reject); },
      }; return q;
    },
  }; return client;
}
const makeService = client => createInspectionService({ client, username: 'test', now: () => instant, uuid: () => uuid, snapshots: { async findFresh() { return null; }, async save(_id,_payload,output) { return { output }; } } });
const photo = () => new File([new Uint8Array([255,216,255,1,2,3])], 'test.jpg', { type: 'image/jpeg' });

test('new inspection creates the ordinary vehicle immediately and retains contact and prices', () => {
  const form = { ...fixture(), buyEstimate: '100000', buyEstimateMax: '110000' };
  const car = buildNewInspection(form, { username: 'test', creationKey: uuid, now: instant });
  assert.equal(car.status, 'valuation'); assert.equal(car.name, 'Renault Clio'); assert.equal(car.buy_estimate_max, 110000);
  assert.equal(car.customer_info.firstName, 'Testovací zákazník'); assert.equal(car.technical_params.mobileInspection.creationKey, uuid);
});

test('creation requires identity; invalid VIN, price ranges and numeric values are rejected', () => {
  for (const patch of [{ vin: '', spz: '' }, { vin: 'III' }, { km: '-1' }, { year: '1800' }, { buyEstimate: '20', buyEstimateMax: '10' }, { approvedPriceMax: '10' }, { customerEmail: 'invalid' }]) assert.ok(validateInspectionForm({ ...fixture(), ...patch }, { creating: true }));
});

test('patch saves only changed fields, preserving other technical data, customer data and notes', () => {
  const car = { ...buildNewInspection(fixture(), { username: 'test', creationKey: uuid }), technical_params: { brand: 'Renault', model: 'Clio', fuel: 'Benzín', custom: 'keep' }, customer_info: { firstName: 'Jan', lastName: 'Novák', company: 'keep' }, notes: ['keep'] };
  const baseline = readInspectionForm(car), form = { ...baseline, powerKw: '66', customerPhone: '777123456' };
  const patch = buildFormPatch(car, changedFormFields(form, baseline), baseline);
  assert.equal(patch.technical_params.custom, 'keep'); assert.equal(patch.customer_info.company, 'keep'); assert.equal(patch.customer_info.lastName, 'Novák'); assert.equal(patch.notes, undefined);
});

test('conflicting colleague edits fail instead of being overwritten; identical retries are accepted', () => {
  const car = buildNewInspection(fixture(), { username: 'test', creationKey: uuid });
  const baseline = readInspectionForm(car); car.km = 70000;
  assert.throws(() => buildFormPatch(car, { km: '60000' }, baseline), /kolega/);
  assert.equal(buildFormPatch(car, { km: '70000' }, baseline).km, 70000);
});

test('a lost creation response can be retried with the same key without a duplicate car', async () => {
  const client = fakeClient(), service = makeService(client); client.state.loseInsertResponse = true;
  await assert.rejects(service.create(fixture(), uuid), /response lost/);
  const recovered = await service.create(fixture(), uuid);
  assert.equal(client.tables.cars.length, 1); assert.equal(recovered.id, client.tables.cars[0].id);
});

test('duplicate VIN or formatted SPZ resolves to the existing card', async () => {
  const client = fakeClient(), service = makeService(client); await service.create(fixture(), uuid);
  await assert.rejects(service.create({ ...fixture(), spz: '1ab2345' }, 'another-key'), DuplicateInspectionError);
  assert.equal(client.tables.cars.length, 1);
});

test('notes are idempotent after a lost response and retain existing notes', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  client.tables.cars[0].notes.push('Původní poznámka'); client.state.loseUpdateResponse = true;
  await assert.rejects(service.addNote(car.id, 'Nová poznámka', 'stable-note-key'), /response lost/);
  const saved = await service.addNote(car.id, 'Nová poznámka', 'stable-note-key');
  assert.equal(saved.notes.length, 2); assert.equal(saved.notes[0], 'Původní poznámka');
});

test('TP uploads privately into documents; a retry never duplicates it', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  await service.upload(car.id, photo(), { kind: 'tp', attachmentId: uuid });
  await service.upload(car.id, photo(), { kind: 'tp', attachmentId: uuid });
  assert.equal(client.tables.vehicle_documents.length, 1); assert.equal(client.tables.vehicle_documents[0].category, 'Technický průkaz');
  assert.equal(client.objects.size, 1); assert.ok([...client.objects.keys()][0].startsWith('vehicle-documents/'));
  assert.equal(client.tables.cars[0].photos.length, 0);
});

test('damage upload preserves descriptions and connects the same photo to the regular gallery', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  client.tables.cars[0].damage_report = { exterior: 'Původní oděrka', technical: 'keep' };
  const options = { kind: 'damage', area: 'exterior', description: 'Levé dveře', attachmentId: uuid };
  await service.upload(car.id, photo(), options); const saved = await service.upload(car.id, photo(), options);
  assert.equal(saved.photos.length, 1); assert.equal(saved.damage_report.inspectionPhotos.length, 1); assert.equal(saved.damage_report.technical, 'keep');
  assert.ok(saved.damage_report.exterior.includes('Původní oděrka')); assert.ok(saved.damage_report.exterior.includes('Levé dveře'));
});

test('a lost attachment response never deletes a successfully attached file', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid); client.state.loseUpdateResponse = true;
  const saved = await service.upload(car.id, photo(), { kind: 'vehicle', attachmentId: uuid });
  assert.equal(saved.photos.length, 1); assert.equal(client.objects.size, 1); assert.ok(!client.calls.some(c => c.removed));
});

test('failed TP attachment keeps its stable object for retry; successful retry attaches exactly once', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid); client.state.rejectDocument = true;
  await assert.rejects(service.upload(car.id, photo(), { kind: 'tp', attachmentId: uuid }), /offline/);
  assert.equal(client.objects.size, 1); client.state.rejectDocument = false;
  await service.upload(car.id, photo(), { kind: 'tp', attachmentId: uuid });
  assert.equal(client.objects.size, 1); assert.equal(client.tables.vehicle_documents.length, 1);
});

test('unsupported files and undescribed damage never start an upload', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  await assert.rejects(service.upload(car.id, new File(['bad'], 'bad.svg', { type: 'image/svg+xml' }), { kind: 'vehicle' }));
  await assert.rejects(service.upload(car.id, photo(), { kind: 'damage' }));
  assert.equal(client.objects.size, 0);
});

test('registry output is a proposal; accepting it fills blanks without overwriting manual data', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  const result = await service.extract(car.id, 'registry'); assert.equal(client.tables.cars[0].technical_params.powerKw, '');
  const saved = await service.applyExtraction(car.id, { ...result, technicalParams: { ...result.technicalParams, fuel: 'Nafta' } });
  assert.equal(saved.technical_params.fuel, 'Benzín'); assert.equal(saved.technical_params.powerKw, '66');
});

test('market requests use saved technical data and costs, while cached results do not modify saved prices', async () => {
  const client = fakeClient(), cached = { output: { purchasePriceLow: 100000 } };
  const service = createInspectionService({ client, username: 'test', snapshots: { async findFresh() { return cached; } } });
  const car = await service.create({ ...fixture(), preparationCosts: '7000' }, uuid);
  const payload = buildMarketPayload(car); assert.equal(payload.vehicle.mileage, 50000); assert.equal(payload.preparationCosts, 7000);
  const result = await service.estimate(car.id); assert.equal(result.cached, true); assert.equal(client.tables.cars[0].buy_estimate, null); assert.equal(client.calls.length, 0);
});

test('draft storage recovers text and baseline; quota and malformed data fail safely', () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key,v) => values.set(key,v) };
  const draft = { creationKey: uuid, carId: 1, form: fixture(), baseline: readInspectionForm(), note: 'Rozepsaná poznámka' };
  assert.equal(writeInspectionDraft(storage, 'user', draft), true); assert.equal(readInspectionDraft(storage, 'user').note, draft.note);
  values.set('bad','{'); assert.equal(readInspectionDraft(storage,'bad'), null);
  assert.equal(writeInspectionDraft({ setItem() { throw Error('quota'); } }, 'user', draft), false);
});

test('typing while a save is in flight survives reconciliation with the server response', () => {
  const submitted = fixture(), current = { ...submitted, engine: 'Nově dopsaná motorizace' }, saved = { ...submitted, powerKw: '66' };
  const form = reconcileSavedForm(current, submitted, saved);
  assert.equal(form.engine, current.engine); assert.equal(form.powerKw, '66');
});

test('completing an inspection keeps the ordinary vehicle workflow and all unrelated fields', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  const saved = await service.complete(car.id);
  assert.equal(saved.status, 'valuation'); assert.ok(saved.technical_params.mobileInspection.completedAt); assert.equal(saved.customer_info.firstName, fixture().customerName);
});

test('pricing a legacy card also saves the displayed valuation date when it was missing', async () => {
  const client = fakeClient(), service = makeService(client), car = await service.create(fixture(), uuid);
  client.tables.cars[0].valuation_date = null;
  const baseline = readInspectionForm({ ...car, valuation_date: null });
  const saved = await service.saveForm(car.id, { ...baseline, buyEstimate: '150000' }, baseline);
  assert.equal(saved.valuation_date, baseline.valuationDate); assert.equal(saved.buy_estimate, 150000);
});

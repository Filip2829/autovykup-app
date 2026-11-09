import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareSource, buildSharedSnapshot, shareCompleteness, storageRef, signShareFiles, validateShareUpload } from '../../supabase/functions/_shared/vehicleSharing.js';
import { createSharingHandler } from '../../supabase/functions/_shared/vehicleSharingHandler.js';

const project = 'https://example.supabase.co';
const original = `${project}/storage/v1/object/public/car-photos/vehicle-photos/7-a.jpg`;
const requestId = '11111111-1111-4111-8111-111111111111';
const photoId = '22222222-2222-4222-8222-222222222222';
const tpId = '33333333-3333-4333-8333-333333333333';
const car = { id: 7, name: 'Renault Clio', vin: 'VF1FL000272669224', spz: '1A10001', year: '2020', km: 0,
  photos: [original], technical_params: { fuel: 'Benzín', stkValidUntil: '2027-10-01', onlineValuation: { vat: 'yes', full_name: 'SECRET CUSTOMER', phone: 'PRIVATE PHONE', additional: 'PRIVATE NOTE' } },
  buy_estimate: 123456, notes: ['SECRET INTERNAL'], customer_info: { email: 'private@example.invalid' } };
const docs = [
  { id: 'doc-tp', car_id: 7, category: 'Technický průkaz', title: 'TP', file_path: '7/tp.jpg', mime_type: 'image/jpeg' },
  { id: 'doc-cebia', car_id: 7, category: 'CEBIA', title: 'Výpis CEBIA', file_path: '7/cebia.pdf', mime_type: 'application/pdf' },
  { id: 'doc-invoice', car_id: 7, category: 'Faktura', title: 'INTERNAL INVOICE', file_path: '7/invoice.pdf', mime_type: 'application/pdf' },
];
const fixture = () => buildShareSource({ car: structuredClone(car), documents: structuredClone(docs) }, project);
const opts = source => ({ fileIds: source.files.map(f => f.id), audience: 'aaa', vat: 'yes', stkValidUntil: '2027-10-01', message: '' });

test('external snapshot allows only vehicle facts and selected attachments, excluding customer and internal details', () => {
  const source = fixture(), snapshot = buildSharedSnapshot(source, { ...opts(source), buy_estimate: 123456, notes: 'SECRET' });
  const json = JSON.stringify(snapshot);
  for (const secret of ['SECRET', 'PRIVATE', 'private@example', '123456', 'INTERNAL INVOICE', 'invoice.pdf']) assert.ok(!json.includes(secret), secret);
  assert.equal(snapshot.vehicle.km, '0'); assert.equal(snapshot.files.length, 3); assert.deepEqual(shareCompleteness(snapshot), []);
});

test('legacy signed URLs are parsed without forwarding stored signatures; other hosts and buckets fail closed', () => {
  assert.deepEqual(storageRef(`${project}/storage/v1/object/sign/vehicle-documents/7/test.pdf?token=old-secret`, project), { bucket: 'vehicle-documents', path: '7/test.pdf' });
  for (const url of ['https://evil.invalid/p.pdf', `${project}/storage/v1/object/public/tire-photos/a.jpg`, `${project}/storage/v1/object/public/car-photos/a/%2E%2E%2Fsecret`, 'javascript:alert(1)']) assert.throws(() => storageRef(url, project));
});

test('unconverted form request provides photos and TP without requiring a vehicle card', () => {
  const request = { id: requestId, data: { brand: 'Dacia', model: 'Logan', stk: 'yes', vat: 'unknown', phone: 'SECRET' } };
  const source = buildShareSource({ request, photos: [
    { id: photoId, request_id: requestId, shot: 'front', path: `${requestId}/${photoId}.jpg`, removed: false },
    { id: tpId, request_id: requestId, shot: 'registration_front', path: `${requestId}/${tpId}.jpg`, removed: false },
  ] }, project);
  assert.equal(source.vehicle.name, 'Dacia Logan'); assert.equal(source.files.filter(f => f.kind === 'tp').length, 1);
  assert.equal(source.vehicle.stkValidUntil, ''); assert.equal(source.vehicle.stkDeclared, 'yes');
  assert.ok(shareCompleteness(source).includes('Datum platnosti STK')); assert.ok(!JSON.stringify(source).includes('SECRET'));
});

test('copied conversion files do not duplicate the originals in a share', () => {
  const copied = `${project}/storage/v1/object/public/car-photos/vehicle-photos/7-online-valuation-${photoId}.jpg`;
  const source = buildShareSource({ car: { ...car, photos: [copied] }, request: { id: requestId, data: {} }, documents: [{ ...docs[0], id: tpId }], photos: [
    { id: photoId, request_id: requestId, path: `${requestId}/${photoId}.jpg`, shot: 'front' },
    { id: tpId, request_id: requestId, path: `${requestId}/${tpId}.jpg`, shot: 'registration_back' },
  ] }, project);
  assert.equal(source.files.length, 2); assert.equal(source.files.filter(f => f.kind === 'photo').length, 1);
});

test('stable selections survive newly inserted files; unselected TP never enters the snapshot', () => {
  const source = fixture(), photoIds = source.files.filter(f => f.kind === 'photo').map(f => f.id);
  const shifted = buildShareSource({ car, documents: [{ ...docs[1], id: 'another', file_path: '7/new.pdf' }, ...docs] }, project);
  const snapshot = buildSharedSnapshot(shifted, { ...opts(shifted), fileIds: photoIds, audience: 'buyer' });
  assert.equal(snapshot.files.length, 1); assert.equal(snapshot.files[0].kind, 'photo');
  assert.throws(() => buildSharedSnapshot(source, { ...opts(source), fileIds: ['forged'] }));
});

test('invalid dates and VAT fail validation; unknown values remain unknown', () => {
  const source = fixture();
  for (const date of ['2026-02-30', '2026-13-01', 'tomorrow']) assert.throws(() => buildSharedSnapshot(source, { ...opts(source), stkValidUntil: date }));
  assert.throws(() => buildSharedSnapshot(source, { ...opts(source), vat: 'probably' }));
  const snapshot = buildSharedSnapshot(source, { ...opts(source), vat: 'unknown', stkValidUntil: '' });
  assert.equal(snapshot.vehicle.vat, 'unknown'); assert.ok(shareCompleteness(snapshot).includes('Odpočet DPH'));
});

test('uploads validate actual file signatures, allowed kinds and sizes', () => {
  validateShareUpload(new Uint8Array([37,80,68,70,45]), 'application/pdf', 'cebia');
  validateShareUpload(new Uint8Array([255,216,255]), 'image/jpeg', 'tp');
  for (const mime of ['text/html', 'image/jpeg', 'application/pdf']) assert.throws(() => validateShareUpload(new TextEncoder().encode('<script>'), mime, 'tp'));
  assert.throws(() => validateShareUpload(new Uint8Array(10485761), 'application/pdf', 'cebia'));
});

function database() {
  const tables = { cars: [structuredClone(car)], valuation_requests: [], valuation_photos: [], vehicle_documents: structuredClone(docs), vehicle_share_attachments: [], vehicle_share_links: [], valuation_staff: [{ user_id: 'staff' }] };
  const signed = [], uploads = [];
  let allowed = true, missingFile = false;
  const db = { tables, signed, uploads, set allowed(v) { allowed = v; }, set missingFile(v) { missingFile = v; },
    auth: { async getUser(token) { return { data: { user: token === 'valid-session' ? { id: 'staff' } : null }, error: null }; } },
    storage: { from(bucket) { return {
      async createSignedUrl(path, ttl) { signed.push({ bucket, path, ttl }); return missingFile ? { error: new Error('not found') } : { data: { signedUrl: `${project}/signed/${bucket}/${path}?ttl=${ttl}` }, error: null }; },
      async upload(path, bytes) { uploads.push({ bucket, path, bytes: bytes.length }); return { data: {}, error: null }; },
      async remove() { return { data: {}, error: null }; },
    }; } },
    from(table) {
      const filters = []; let mode = 'read', payload, single = false;
      const q = {
        select() { return q; }, order() { return q; }, limit() { return q; },
        eq(k,v) { filters.push(row => String(row[k]) === String(v)); return q; },
        is(k,v) { filters.push(row => row[k] === v); return q; },
        single() { single = true; return q; }, maybeSingle() { single = true; return q; },
        insert(p) { mode = 'insert'; payload = p; return q; }, update(p) { mode = 'update'; payload = p; return q; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          let rows = tables[table].filter(r => filters.every(f => f(r)));
          if (table === 'valuation_staff' && !allowed) rows = [];
          if (mode === 'insert') { const row = { id: crypto.randomUUID(), revoked_at: null, created_at: new Date().toISOString(), ...structuredClone(payload) }; tables[table].push(row); rows = [row]; }
          if (mode === 'update') rows.forEach(row => Object.assign(row, structuredClone(payload)));
          return { data: structuredClone(single ? rows[0] || null : rows), error: null };
        }).then(resolve,reject); },
      }; return q;
    },
  }; return db;
}

async function call(handler, body, authenticated = true, origin = 'https://autovykup-app.vercel.app') {
  const response = await handler(new Request('https://api.example/functions/v1/vehicle-sharing', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(authenticated ? { Authorization: 'Bearer valid-session' } : {}) }, body: JSON.stringify(body) }));
  return { status: response.status, data: await response.json(), headers: response.headers };
}
const context = { sourceType: 'car', sourceId: 7 };

test('whole share flow: preview, create, anonymous view, revoke and deny further views', async () => {
  const db = database(), handler = createSharingHandler({ db, projectUrl: project });
  const preview = await call(handler, { action: 'preview', ...context }); assert.equal(preview.status, 200);
  const created = await call(handler, { action: 'create', ...context, ...opts(fixture()), days: 14, confirm: true }); assert.equal(created.status, 200);
  const row = db.tables.vehicle_share_links[0]; assert.notEqual(row.token_hash, created.data.token); assert.ok(!JSON.stringify(row).includes(created.data.token));
  const view = await call(handler, { action: 'view', token: created.data.token }, false); assert.equal(view.status, 200); assert.equal(view.data.files.length, 3);
  assert.ok(!JSON.stringify(view.data).includes('SECRET')); assert.equal(view.headers.get('cache-control'), 'no-store');
  assert.ok(db.signed.every(s => s.ttl <= 300));
  assert.equal((await call(handler, { action: 'revoke', linkId: created.data.id })).status, 200);
  const signedBefore = db.signed.length;
  assert.equal((await call(handler, { action: 'view', token: created.data.token }, false)).status, 404);
  assert.equal(db.signed.length, signedBefore);
});

test('management requires a verified staff session; caller-supplied identities cannot grant access', async () => {
  const db = database(), handler = createSharingHandler({ db, projectUrl: project });
  for (const action of ['preview', 'create', 'revoke', 'list', 'upload']) assert.equal((await call(handler, { action, ...context, user_id: 'staff' }, false)).status, 401);
  db.allowed = false;
  assert.equal((await call(handler, { action: 'preview', ...context })).status, 403);
  assert.equal(db.tables.vehicle_share_links.length, 0);
});

test('expired, malformed and unknown tokens do not produce signed file URLs', async () => {
  const db = database(), handler = createSharingHandler({ db, projectUrl: project });
  const result = await call(handler, { action: 'create', ...context, ...opts(fixture()), days: 1, confirm: true });
  db.tables.vehicle_share_links[0].expires_at = new Date(Date.now() - 1000).toISOString();
  const before = db.signed.length;
  for (const token of [result.data.token, 'bad', 'a'.repeat(64)]) assert.equal((await call(handler, { action: 'view', token }, false)).status, 404);
  assert.equal(db.signed.length, before);
});

test('creating incomplete packages requires confirmation and never signs attacker-supplied paths', async () => {
  const db = database(), handler = createSharingHandler({ db, projectUrl: project });
  const options = { ...opts(fixture()), fileIds: fixture().files.filter(f => f.kind === 'photo').map(f => f.id), days: 7, confirm: true };
  assert.equal((await call(handler, { action: 'create', ...context, ...options })).status, 400);
  assert.equal((await call(handler, { action: 'create', ...context, ...options, allowIncomplete: true })).status, 200);
  assert.equal(db.tables.vehicle_share_links[0].payload.files.length, 1);
  assert.equal((await call(handler, { action: 'create', ...context, ...options, fileIds: ['vehicle-documents:OTHER-CUSTOMER.pdf'], allowIncomplete: true })).status, 400);
});

test('missing Storage files cannot produce a falsely complete share', async () => {
  const db = database(); db.missingFile = true;
  const handler = createSharingHandler({ db, projectUrl: project });
  const preview = await call(handler, { action: 'preview', ...context }); assert.ok(preview.data.files.every(f => f.url === null));
  assert.equal((await call(handler, { action: 'create', ...context, ...opts(fixture()), days: 14, confirm: true })).status, 400);
  assert.equal(db.tables.vehicle_share_links.length, 0);
});

test('a new CEBIA can be uploaded privately and then selected without converting the source', async () => {
  const db = database(); db.tables.valuation_requests.push({ id: requestId, is_test: false, status: 'new', data: { brand: 'Renault', model: 'Clio' }, converted_car_id: null });
  const handler = createSharingHandler({ db, projectUrl: project });
  const ctx = { sourceType: 'request', sourceId: requestId };
  const result = await call(handler, { action: 'upload', ...ctx, kind: 'cebia', title: 'CEBIA.pdf', mime: 'application/pdf', base64: btoa('%PDF-') });
  assert.equal(result.status, 200); assert.equal(db.uploads[0].bucket, 'vehicle-documents');
  assert.equal(db.tables.vehicle_share_attachments[0].request_id, requestId);
  const preview = await call(handler, { action: 'preview', ...ctx }); assert.equal(preview.data.files[0].kind, 'cebia');
  assert.equal(db.tables.cars.length, 1);
});

test('unapproved origins, unknown actions, invalid expiry and absent confirmation are rejected', async () => {
  const db = database(), handler = createSharingHandler({ db, projectUrl: project });
  assert.equal((await call(handler, { action: 'preview', ...context }, true, 'https://attacker.invalid')).status, 403);
  for (const extra of [{ days: 365 }, { confirm: false }, { action: 'delete_everything' }]) assert.equal((await call(handler, { action: 'create', ...context, ...opts(fixture()), days: 14, confirm: true, ...extra })).status, 400);
  assert.equal(db.tables.vehicle_share_links.length, 0);
});

test('file signing never exceeds the remaining link lifetime', async () => {
  const db = database(); await signShareFiles(db, { ...fixture(), audience: 'aaa' }, new Date(Date.now() + 90000).toISOString());
  assert.ok(db.signed.every(s => s.ttl <= 90 && s.ttl > 0));
});

test('Czech STK dates normalize to an actual date rather than disappearing from the date editor', () => {
  const source = buildShareSource({ car: { ...car, technical_params: { stkValidUntil: '1.12.2027' } } }, project);
  assert.equal(source.vehicle.stkValidUntil, '2027-12-01');
  const invalid = buildShareSource({ car: { ...car, technical_params: { stkValidUntil: '31.2.2027' } } }, project);
  assert.equal(invalid.vehicle.stkValidUntil, '');
});

test('buyer offers do not require deliberately unshared TP and CEBIA', () => {
  const source = fixture();
  const snapshot = buildSharedSnapshot(source, { ...opts(source), audience: 'buyer', fileIds: source.files.filter(f => f.kind === 'photo').map(f => f.id) });
  assert.deepEqual(shareCompleteness(snapshot), []);
});

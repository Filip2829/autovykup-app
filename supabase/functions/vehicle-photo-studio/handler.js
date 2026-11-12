import { backgroundReference, normalizeBackground, reflectionMode, validatePhoto } from '../../../src/photoStudio/model.js';
import { validatePlates } from '../../../src/photoStudio/plates.js';
import { detectPlates } from './plateDetection.js';
import { Buffer } from 'node:buffer';
import { canUseStandaloneStudio, standaloneStudioRoot } from '../../../src/photoStudio/access.js';
import { locateInteriorWindows, verifyInteriorViews } from './interiorWindows.js';
import { inspectStudioScene, legacyScene, validateScene } from './sceneInspection.js';
import { locateLooseDirt, verifyInteriorCleanup } from './interiorCleanup.js';
import { locateExteriorSurroundings, verifyExteriorPhoto } from './exteriorSurroundings.js';
import { acquireProcessingLock } from './processingLock.js';

export function createPhotoStudioHandler({ db, apiKey, fetchBackground = fetch, fetchVision = fetch, renderMaskedJpeg, cropPlateRegion, checkPlateRegion, decodePlateImage, composeOriginalVehicle, cleanInteriorJpeg }) {
  const bucket = db.storage.from('car-photos');
  const checked = async (promise) => { const { data, error } = await promise; if (error) throw error; return data; };
  const locatePlates = base64 => detectPlates(base64, apiKey, fetchVision, cropPlateRegion, checkPlateRegion, decodePlateImage);
  let logoBytes;
  async function getLogo() {
    if (!logoBytes) {
      const response = await fetchBackground('https://autovykup-app.vercel.app/photo-studio/opportunity-logo.png', { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) throw new Error('Logo nelze načíst.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 1024 * 1024) throw new Error('Logo je příliš velké.');
      logoBytes = bytes;
    }
    return logoBytes;
  }
  return async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply({ error: 'Použijte POST.' }, 405);
    try {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (!token) return reply({ error: 'Přihlaste se.' }, 401);
      const auth = await db.auth.getUser(token);
      if (auth.error || !auth.data?.user) return reply({ error: 'Přihlaste se znovu.' }, 401);
      const staff = await checked(db.from('valuation_staff').select('user_id').eq('user_id', auth.data.user.id).maybeSingle());
      // Bound the stream before parsing multipart data.
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: 'Chybí data.' }, 400);
      const chunks = []; let length = 0;
      while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 32 * 1024 * 1024) { await reader.cancel(); return reply({ error: 'Soubor je příliš velký.' }, 413); } chunks.push(value); }
      const form = await new Response(new Blob(chunks), { headers: { 'Content-Type': req.headers.get('content-type') || '' } }).formData();
      const carId = form.get('carId'), action = form.get('action');
      const standalone = form.get('scope') === 'standalone';
      const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '');
      if (standalone ? !canUseStandaloneStudio(auth.data.user, staff) : !staff) return reply({ error: 'K tomuto fotostudiu nemáte přístup. Správce může prodejci povolit samostatné Fotostudio.' }, 403);
      if (form.get('scope') && !standalone) return reply({ error: 'Neplatný režim fotostudia.' }, 400);
      const ownerRoot = standaloneStudioRoot(auth.data.user.id);
      const sessionsFolder = `${ownerRoot}/sessions`;
      const sessionPath = id => `${sessionsFolder}/${id}.json`;
      const readSession = async id => {
        const result = await bucket.download(sessionPath(id));
        if (result.error && (String(result.error.statusCode) === '404' || result.error.code === 'NoSuchKey')) return null;
        if (result.error) throw result.error;
        return JSON.parse(await result.data.text());
      };
      if (standalone && action === 'sessions') {
        const files = await checked(bucket.list(sessionsFolder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }));
        const sessions = await Promise.all(files.filter(file => uuid(file.name.replace(/\.json$/, ''))).map(file => readSession(file.name.slice(0, -5))));
        return reply({ sessions: sessions.filter(Boolean) });
      }
      if (standalone && action === 'createSession') {
        const label = String(form.get('label') || '').trim();
        if (!label || label.length > 100) return reply({ error: 'Zadejte název sady do 100 znaků.' }, 400);
        const existing = await checked(bucket.list(sessionsFolder, { limit: 100 }));
        if (existing.length >= 100) return reply({ error: 'Nejprve odstraňte některou prázdnou sadu. Limit je 100 sad.' }, 400);
        const session = { id: crypto.randomUUID(), label, createdAt: new Date().toISOString() };
        await checked(bucket.upload(sessionPath(session.id), new Blob([JSON.stringify(session)], { type: 'application/json' }), { contentType: 'application/json', cacheControl: '0', upsert: false }));
        return reply({ session });
      }
      const sessionId = form.get('sessionId');
      if (standalone) {
        if (!uuid(sessionId)) return reply({ error: 'Neplatná sada fotografií.' }, 400);
        const session = await readSession(sessionId);
        if (!session || session.id !== sessionId) return reply({ error: 'Sada není dostupná.' }, 404);
      } else {
        if (!/^\d+$/.test(carId || '')) return reply({ error: 'Neplatné ID vozu.' }, 400);
        const car = await checked(db.from('cars').select('id').eq('id', carId).maybeSingle());
        if (!car) return reply({ error: 'Vůz neexistuje.' }, 404);
      }
      const photoFolder = standalone ? `${ownerRoot}/${sessionId}` : 'photo-studio';
      const photoSearch = standalone ? '' : `${carId}-`;
      const prefix = standalone ? `${photoFolder}/` : `photo-studio/${carId}-`;
      async function withSessionLock(work) {
        if (!standalone) return await work();
        const lockPath = `${photoFolder}/session-lock`;
        const release = await acquireProcessingLock(bucket, lockPath);
        if (!release) return reply({ error: 'Se sadou se právě pracuje. Zkuste akci znovu.' }, 409);
        try { if (!await readSession(sessionId)) return reply({ error: 'Sada není dostupná.' }, 404); return await work(); }
        finally { await release(); }
      }
      if (standalone && action === 'deleteSession') {
        return await withSessionLock(async () => {
        const files = (await checked(bucket.list(photoFolder, { limit: 1000 }))).filter(file => file.name !== 'session-lock');
        if (files.some(file => file.name.endsWith('-meta.json') || file.name.endsWith('-lock'))) return reply({ error: 'Nejprve smažte fotografie v sadě a počkejte na dokončení úprav.' }, 409);
        if (files.length) await checked(bucket.remove(files.map(file => `${photoFolder}/${file.name}`)));
        await checked(bucket.remove([sessionPath(sessionId)]));
        return reply({ deletedSessionId: sessionId });
        });
      }
      const pathFor = (id, suffix) => `${prefix}${id}-${suffix}`;
      const readItem = async (id) => JSON.parse(await (await checked(bucket.download(pathFor(id, 'meta.json')))).text());
      const saveItem = async (item) => checked(bucket.upload(pathFor(item.id, 'meta.json'), new Blob([JSON.stringify(item)], { type: 'application/json' }), { contentType: 'application/json', cacheControl: '0', upsert: true }));
      const resultUrl = (item) => `${bucket.getPublicUrl(pathFor(item.id, 'result.jpg')).data.publicUrl}?v=${item.resultVersion || '1'}`;
      const decorate = (item) => ({ ...item, originalUrl: bucket.getPublicUrl(pathFor(item.id, 'original')).data.publicUrl, resultUrl: item.ready ? resultUrl(item) : null, baseUrl: item.ready ? (item.hasBase ? bucket.getPublicUrl(pathFor(item.id, 'base.jpg')).data.publicUrl : resultUrl(item)) : null });
      async function loadBase(item) {
        const base = await bucket.download(pathFor(item.id, 'base.jpg'));
        if (!base.error && base.data?.size) return new Uint8Array(await base.data.arrayBuffer());
        if (item.hasBase) throw base.error || new Error('Chybí základ fotografie.');
        const previous = await checked(bucket.download(pathFor(item.id, 'result.jpg')));
        const bytes = new Uint8Array(await previous.arrayBuffer());
        await checked(bucket.upload(pathFor(item.id, 'base.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
        return bytes;
      }
      async function finishPhoto(item, bytes, detection) {
        const rendered = detection.plates.length ? await renderMaskedJpeg(bytes, detection.plates, await getLogo()) : bytes;
        await checked(bucket.upload(pathFor(item.id, 'result.jpg'), rendered, { contentType: 'image/jpeg', cacheControl: '0', upsert: true }));
        Object.assign(item, detection, { hasBase: true, plateRendered: detection.plateVerified, maskVersion: 2, resultVersion: crypto.randomUUID(), ready: true, approved: false, processingStage: 'complete' });
        await saveItem(item);
        return reply({ item: decorate(item) });
      }
      if (action === 'list') {
        const entries = await checked(bucket.list(photoFolder, { search: photoSearch, limit: 1000 }));
        const items = await Promise.all(entries.filter(e => e.name.endsWith('-meta.json')).map(e => readItem(e.name.slice(standalone ? 0 : String(carId).length + 1, -10))));
        return reply({ items: items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(decorate) });
      }
      if (action === 'inspect') {
        const source = form.get('source');
        if (!source || typeof source === 'string' || source.type !== 'image/png' || !source.size || source.size > 16 * 1024 * 1024) return reply({ error: 'Chybí podklad k rozpoznání fotografie.' }, 400);
        if (!apiKey) return reply({ error: 'AI není nakonfigurovaná.' }, 503);
        return reply({ inspection: await inspectStudioScene(Buffer.from(await source.arrayBuffer()).toString('base64'), apiKey, fetchVision) });
      }
      if (action === 'upload') {
        return await withSessionLock(async () => {
        const file = form.get('file'), angle = form.get('angle'), background = normalizeBackground(form.get('background'));
        if (!file || typeof file === 'string') return reply({ error: 'Vyberte fotografii.' }, 400);
        reflectionMode(angle, form.get('reflectionReduction') || 'off');
        const reflectionReduction = 'off';
        validatePhoto(file); backgroundReference(angle, background);
        const source = form.get('source'), vehicleMask = form.get('vehicleMask');
        const inspection = form.get('inspection') ? validateScene(JSON.parse(form.get('inspection'))) : legacyScene(angle);
        const exterior = inspection.scene === 'exterior' && inspection.backgroundVisible;
        const validPng = (value, max) => value && typeof value !== 'string' && value.type === 'image/png' && value.size > 0 && value.size <= max * 1024 * 1024;
        if (!validPng(source, 16) || exterior && !validPng(vehicleMask, 2)) return reply({ error: 'Chybí chráněný podklad vozu. Obnovte aplikaci a nahrajte fotografii znovu.' }, 400);
        const existing = await checked(bucket.list(photoFolder, { search: photoSearch, limit: 1000 }));
        if (existing.filter(e => e.name.endsWith('-meta.json')).length >= 40) return reply({ error: 'Pro jeden vůz lze uložit nejvýše 40 fotografií.' }, 400);
        const id = crypto.randomUUID();
        const item = { id, angle, background, reflectionReduction, mime: file.type, subjectVersion: 1, compositionVersion: 3, photoRulesVersion: 3, ...inspection, ready: false, approved: false, createdAt: new Date().toISOString() };
        await checked(bucket.upload(pathFor(id, 'original'), file, { contentType: file.type }));
        try {
          await checked(bucket.upload(pathFor(id, 'source.png'), source, { contentType: 'image/png' }));
          if (exterior) await checked(bucket.upload(pathFor(id, 'vehicle-mask.png'), vehicleMask, { contentType: 'image/png' }));
          await saveItem(item);
        } catch (e) { await bucket.remove(['original', 'source.png', 'vehicle-mask.png'].map(suffix => pathFor(id, suffix))); throw e; }
        return reply({ item: decorate(item) });
        });
      }
      const id = form.get('id');
      if (!/^[a-f0-9-]{36}$/.test(id || '')) return reply({ error: 'Neplatná fotografie.' }, 400);
      if (!['delete', 'plate', 'autoPlate', 'approve', 'process', 'reprocess'].includes(action)) return reply({ error: 'Neznámá operace.' }, 400);
      // All mutations share a lock: deleting in another tab cannot resurrect a completed job.
      const lockPath = pathFor(id, 'lock');
      const release = await acquireProcessingLock(bucket, lockPath);
      if (!release) return reply({ error: 'S fotografií se právě pracuje. Pokud předchozí běh selhal, lze jej zopakovat nejpozději za 10 minut.' }, 409);
      try {
      if (action === 'delete') {
        // Keep the manifest until asset removal succeeds, so failures remain retryable.
        await checked(bucket.remove(['original', 'source.png', 'vehicle-mask.png', 'draft.jpg', 'base.jpg', 'result.jpg'].map(suffix => pathFor(id, suffix))));
        await checked(bucket.remove([pathFor(id, 'meta.json')]));
        return reply({ deletedId: id });
      }
      const item = await readItem(id);
      if (action === 'reprocess') {
        if (item.subjectVersion !== 1) return reply({ error: 'Nahrajte původní fotografii znovu; u této starší úpravy chybí podklad vozu.' }, 409);
        Object.assign(item, { background: normalizeBackground(form.get('background')), ready: false, approved: false, processingStage: 'restart', plateVerified: false });
        await saveItem(item);
        return reply({ item: decorate(item), continueProcessing: true });
      }
      if (action === 'plate') {
        if (!item.ready) return reply({ error: 'Nejprve upravte fotografii.' }, 400);
        let plates;
        try { plates = validatePlates(JSON.parse(form.get('plates') || 'null')); }
        catch { return reply({ error: 'Označte správně čtyři rohy SPZ.' }, 400); }
        return await finishPhoto(item, await loadBase(item), { plates, plateVerified: true, plateStatus: 'verified' });
      }
      if (action === 'approve') {
        if (!item.ready) return reply({ error: 'Nejprve upravte fotografii.' }, 400);
        if (form.get('approved') === 'true' && !item.plateVerified) return reply({ error: 'Nejprve zkontrolujte a potvrďte zakrytí SPZ.' }, 400);
        if (form.get('approved') === 'true' && item.maskVersion !== 2) return reply({ error: 'Fotografie potřebuje nové automatické zaměření SPZ. Obnovte seznam.' }, 400);
        item.approved = form.get('approved') === 'true'; await saveItem(item);
        return reply({ item: decorate(item) });
      }
      if (action === 'process' && item.ready) return reply({ item: decorate(item) });
      const staged = form.get('staged') === 'true';
      if (!apiKey) return reply({ error: 'AI není nakonfigurovaná. Správce musí nastavit OPENAI_API_KEY.' }, 503);
      if (action === 'autoPlate') {
        if (!item.ready) return reply({ error: 'Nejprve upravte fotografii.' }, 400);
        const base = await loadBase(item);
        return await finishPhoto(item, base, await locatePlates(Buffer.from(base).toString('base64')));
      }
        const rebuilding = ['restart', 'clean'].includes(item.processingStage);
        const recoveredBase = rebuilding ? { error: true } : await bucket.download(pathFor(id, 'base.jpg'));
        const recovered = rebuilding ? recoveredBase : recoveredBase.error ? await bucket.download(pathFor(id, 'result.jpg')) : recoveredBase;
        if (!recovered.error && recovered.data?.size) {
          const bytes = new Uint8Array(await recovered.data.arrayBuffer());
          if (recoveredBase.error) await checked(bucket.upload(pathFor(id, 'base.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
          return await finishPhoto(item, bytes, await locatePlates(Buffer.from(bytes).toString('base64')));
        }
        if (item.subjectVersion !== 1) return reply({ error: 'Tato fotografie čeká na starší AI úpravu. Nahrajte originál znovu pro zachování původního vozu.' }, 409);
        const source = await checked(bucket.download(pathFor(id, 'source.png')));
        const inspection = item.scene ? item : legacyScene(item.angle);
        const interior = inspection.scene.startsWith('interior');
        const exterior = !interior && inspection.backgroundVisible;
        const mask = inspection.scene === 'exterior' && inspection.backgroundVisible ? await checked(bucket.download(pathFor(id, 'vehicle-mask.png'))) : null;
        let backgroundBytes = null;
        const reference = exterior || interior ? backgroundReference('front', item.background) : null;
        if (reference) {
          // Only server-controlled preset paths are fetched, never URLs from the request.
          const backdrop = await fetchBackground(`https://autovykup-app.vercel.app${reference}`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
          if (!backdrop.ok || !backdrop.headers.get('content-type')?.startsWith('image/png')) return reply({ error: 'Předlohu pozadí se nepodařilo načíst. Zkuste úpravu znovu za chvíli.' }, 502);
          const image = await backdrop.blob();
          if (image.size > 12 * 1024 * 1024) throw new Error('Předloha je příliš velká.');
          backgroundBytes = new Uint8Array(await image.arrayBuffer());
        }
        const sourceBytes = new Uint8Array(await source.arrayBuffer());
        const sourceBase64 = Buffer.from(sourceBytes).toString('base64');
        const draft = staged && item.processingStage === 'clean' ? await bucket.download(pathFor(id, 'draft.jpg')) : null;
        let bytes;
        if (draft && !draft.error) bytes = new Uint8Array(await draft.data.arrayBuffer());
        else {
          const windows = interior ? await locateInteriorWindows(sourceBase64, apiKey, fetchVision) : [];
          const surroundings = exterior && inspection.scene === 'exterior_detail' ? await locateExteriorSurroundings(sourceBase64, apiKey, fetchVision) : [];
          bytes = await composeOriginalVehicle(sourceBytes, mask ? new Uint8Array(await mask.arrayBuffer()) : null, backgroundBytes, item.background, { angle: interior ? 'interior' : item.angle, windows, surroundings, preserveFraming: inspection.scene !== 'exterior' });
          if (exterior) await verifyExteriorPhoto(sourceBase64, Buffer.from(bytes).toString('base64'), Buffer.from(backgroundBytes).toString('base64'), inspection.scene !== 'exterior', apiKey, fetchVision);
          if (interior) await verifyInteriorViews(sourceBase64, Buffer.from(bytes).toString('base64'), apiKey, fetchVision, backgroundBytes ? Buffer.from(backgroundBytes).toString('base64') : '');
          if (staged && interior && !inspection.conditionEvidence) {
            await checked(bucket.upload(pathFor(id, 'draft.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
            item.processingStage = 'clean'; await saveItem(item);
            return reply({ item: decorate(item), continueProcessing: true });
          }
        }
        if (interior) {
          if (!inspection.conditionEvidence) {
            const before = Buffer.from(bytes).toString('base64');
            const cleanup = await locateLooseDirt(before, apiKey, fetchVision);
            if (cleanup.length) {
              bytes = await cleanInteriorJpeg(bytes, cleanup);
              await verifyInteriorCleanup(before, Buffer.from(bytes).toString('base64'), apiKey, fetchVision);
            }
            item.interiorCleaningChecked = true;
            item.cleanedRegions = cleanup.length;
          }
        }
        item.background = normalizeBackground(item.background);
        item.compositionVersion = 3;
        item.interiorViewsNeutralized = interior;
        // Persist the source-pixel composite before plate masking for retries.
        await checked(bucket.upload(pathFor(id, 'base.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
        item.processingStage = 'plate';
        await saveItem(item);
        if (staged) return reply({ item: decorate(item), continueProcessing: true });
        return await finishPhoto(item, bytes, await locatePlates(Buffer.from(bytes).toString('base64')));
      } finally { await release(); }
    } catch (error) {
      const known = /Použijte JPG|Fotografie může|Neplatný pohled|Neplatné pozadí|Neplatný režim redukce/.test(error.message || '');
      const interiorError = /výhled|interiéru|nečistot|čištění|rozpozn|okolí|zachování vozu/i.test(error.message || '');
      return reply({ error: known || interiorError ? error.message : 'Operace se nepodařila. Obnovte seznam a zkuste ji znovu.' }, known ? 400 : interiorError ? 422 : 500);
    }
  };
}

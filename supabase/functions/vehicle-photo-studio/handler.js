import { backgroundReference, editPrompt, validatePhoto } from '../../../src/photoStudio/model.js';
import { validatePlates } from '../../../src/photoStudio/plates.js';
import { detectPlates } from './plateDetection.js';
import { Buffer } from 'node:buffer';
import { canUseStandaloneStudio, standaloneStudioRoot } from '../../../src/photoStudio/access.js';

export function createPhotoStudioHandler({ db, apiKey, fetchImage = fetch, fetchBackground = fetch, fetchVision = fetch, renderMaskedJpeg, cropPlateRegion, checkPlateRegion }) {
  const bucket = db.storage.from('car-photos');
  const checked = async (promise) => { const { data, error } = await promise; if (error) throw error; return data; };
  const locatePlates = base64 => detectPlates(base64, apiKey, fetchVision, cropPlateRegion, checkPlateRegion);
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
      while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 13 * 1024 * 1024) { await reader.cancel(); return reply({ error: 'Soubor je příliš velký.' }, 413); } chunks.push(value); }
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
        const lock = await bucket.upload(lockPath, new Blob(['session mutation']), { upsert: false });
        if (lock.error) return reply({ error: 'Se sadou se právě pracuje. Zkuste akci znovu.' }, 409);
        try { if (!await readSession(sessionId)) return reply({ error: 'Sada není dostupná.' }, 404); return await work(); }
        finally { await bucket.remove([lockPath]); }
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
        Object.assign(item, detection, { hasBase: true, plateRendered: detection.plateVerified, maskVersion: 2, resultVersion: crypto.randomUUID(), ready: true, approved: false });
        await saveItem(item);
        return reply({ item: decorate(item) });
      }
      if (action === 'list') {
        const entries = await checked(bucket.list(photoFolder, { search: photoSearch, limit: 1000 }));
        const items = await Promise.all(entries.filter(e => e.name.endsWith('-meta.json')).map(e => readItem(e.name.slice(standalone ? 0 : String(carId).length + 1, -10))));
        return reply({ items: items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(decorate) });
      }
      if (action === 'upload') {
        return await withSessionLock(async () => {
        const file = form.get('file'), angle = form.get('angle'), background = form.get('background');
        if (!file || typeof file === 'string') return reply({ error: 'Vyberte fotografii.' }, 400);
        validatePhoto(file); editPrompt(angle, background);
        const existing = await checked(bucket.list(photoFolder, { search: photoSearch, limit: 1000 }));
        if (existing.filter(e => e.name.endsWith('-meta.json')).length >= 40) return reply({ error: 'Pro jeden vůz lze uložit nejvýše 40 fotografií.' }, 400);
        const id = crypto.randomUUID();
        const item = { id, angle, background, mime: file.type, ready: false, approved: false, createdAt: new Date().toISOString() };
        await checked(bucket.upload(pathFor(id, 'original'), file, { contentType: file.type }));
        try { await saveItem(item); } catch (e) { await bucket.remove([pathFor(id, 'original')]); throw e; }
        return reply({ item: decorate(item) });
        });
      }
      const id = form.get('id');
      if (!/^[a-f0-9-]{36}$/.test(id || '')) return reply({ error: 'Neplatná fotografie.' }, 400);
      if (!['delete', 'plate', 'autoPlate', 'approve', 'process'].includes(action)) return reply({ error: 'Neznámá operace.' }, 400);
      // All mutations share a lock: deleting in another tab cannot resurrect a completed job.
      const lockPath = pathFor(id, 'lock');
      const lock = await bucket.upload(lockPath, new Blob(['processing']), { upsert: false });
      if (lock.error) return reply({ error: 'S fotografií se právě pracuje. Za chvíli obnovte seznam.' }, 409);
      try {
      if (action === 'delete') {
        // Keep the manifest until asset removal succeeds, so failures remain retryable.
        await checked(bucket.remove(['original', 'base.jpg', 'result.jpg'].map(suffix => pathFor(id, suffix))));
        await checked(bucket.remove([pathFor(id, 'meta.json')]));
        return reply({ deletedId: id });
      }
      const item = await readItem(id);
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
      if (!apiKey) return reply({ error: 'AI není nakonfigurovaná. Správce musí nastavit OPENAI_API_KEY.' }, 503);
      if (action === 'autoPlate') {
        if (!item.ready) return reply({ error: 'Nejprve upravte fotografii.' }, 400);
        const base = await loadBase(item);
        return await finishPhoto(item, base, await locatePlates(Buffer.from(base).toString('base64')));
      }
        const recoveredBase = await bucket.download(pathFor(id, 'base.jpg'));
        const recovered = recoveredBase.error ? await bucket.download(pathFor(id, 'result.jpg')) : recoveredBase;
        if (!recovered.error && recovered.data?.size) {
          const bytes = new Uint8Array(await recovered.data.arrayBuffer());
          if (recoveredBase.error) await checked(bucket.upload(pathFor(id, 'base.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
          return await finishPhoto(item, bytes, await locatePlates(Buffer.from(bytes).toString('base64')));
        }
        const original = await checked(bucket.download(pathFor(id, 'original')));
        const editingDeadline = AbortSignal.timeout(100000);
        const aiForm = new FormData();
        aiForm.set('model', 'gpt-image-1.5'); aiForm.set('image[]', original, `original.${item.mime === 'image/png' ? 'png' : item.mime === 'image/webp' ? 'webp' : 'jpg'}`);
        const reference = backgroundReference(item.angle, item.background);
        if (reference) {
          // Only server-controlled preset paths are fetched, never URLs from the request.
          const backdrop = await fetchBackground(`https://autovykup-app.vercel.app${reference}`, { signal: AbortSignal.any([editingDeadline, AbortSignal.timeout(15000)]), redirect: 'error' });
          if (!backdrop.ok || !backdrop.headers.get('content-type')?.startsWith('image/png')) return reply({ error: 'Předlohu pozadí se nepodařilo načíst. Zkuste úpravu znovu za chvíli.' }, 502);
          const image = await backdrop.blob();
          if (image.size > 12 * 1024 * 1024) throw new Error('Předloha je příliš velká.');
          aiForm.append('image[]', image, 'background.png');
        }
        aiForm.set('prompt', editPrompt(item.angle, item.background)); aiForm.set('input_fidelity', 'high'); aiForm.set('quality', 'medium'); aiForm.set('size', '1536x1024'); aiForm.set('output_format', 'jpeg');
        const response = await fetchImage('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: aiForm, signal: editingDeadline });
        if (!response.ok) return reply({ error: response.status === 429 ? 'AI je vytížená nebo je vyčerpaný kredit. Zkuste to později.' : 'AI úprava se nezdařila. Ověřte přístup k obrazovému modelu a kredit OpenAI.' }, 502);
        const result = await response.json();
        if (!result.data?.[0]?.b64_json) throw new Error('AI nevrátila fotografii.');
        const bytes = Uint8Array.from(atob(result.data[0].b64_json), c => c.charCodeAt(0));
        // Persist the generated base before masking, so retries never pay for generation twice.
        await checked(bucket.upload(pathFor(id, 'base.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
        return await finishPhoto(item, bytes, await locatePlates(result.data[0].b64_json));
      } finally { await bucket.remove([lockPath]); }
    } catch (error) {
      const known = /Použijte JPG|Fotografie může|Neplatný pohled/.test(error.message || '');
      return reply({ error: known ? error.message : 'Operace se nepodařila. Obnovte seznam a zkuste ji znovu.' }, known ? 400 : 500);
    }
  };
}

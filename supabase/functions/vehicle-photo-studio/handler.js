import { backgroundReference, editPrompt, validatePhoto } from '../../../src/photoStudio/model.js';
import { validatePlates } from '../../../src/photoStudio/plates.js';
import { detectPlates } from './plateDetection.js';

export function createPhotoStudioHandler({ db, apiKey, fetchImage = fetch, fetchBackground = fetch, fetchVision = fetch }) {
  const bucket = db.storage.from('car-photos');
  const checked = async (promise) => { const { data, error } = await promise; if (error) throw error; return data; };
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
      if (!staff) return reply({ error: 'Fotostudio je dostupné pouze pracovníkům výkupu.' }, 403);
      // Bound the stream before parsing multipart data.
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: 'Chybí data.' }, 400);
      const chunks = []; let length = 0;
      while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 13 * 1024 * 1024) { await reader.cancel(); return reply({ error: 'Soubor je příliš velký.' }, 413); } chunks.push(value); }
      const form = await new Response(new Blob(chunks), { headers: { 'Content-Type': req.headers.get('content-type') || '' } }).formData();
      const carId = form.get('carId'), action = form.get('action');
      if (!/^\d+$/.test(carId || '')) return reply({ error: 'Neplatné ID vozu.' }, 400);
      const car = await checked(db.from('cars').select('id').eq('id', carId).maybeSingle());
      if (!car) return reply({ error: 'Vůz neexistuje.' }, 404);
      const prefix = `photo-studio/${carId}-`;
      const pathFor = (id, suffix) => `${prefix}${id}-${suffix}`;
      const readItem = async (id) => JSON.parse(await (await checked(bucket.download(pathFor(id, 'meta.json')))).text());
      const saveItem = async (item) => checked(bucket.upload(pathFor(item.id, 'meta.json'), new Blob([JSON.stringify(item)], { type: 'application/json' }), { contentType: 'application/json', upsert: true }));
      const decorate = (item) => ({ ...item, originalUrl: bucket.getPublicUrl(pathFor(item.id, 'original')).data.publicUrl, resultUrl: item.ready ? bucket.getPublicUrl(pathFor(item.id, 'result.jpg')).data.publicUrl : null });
      if (action === 'list') {
        const entries = await checked(bucket.list('photo-studio', { search: `${carId}-`, limit: 1000 }));
        const items = await Promise.all(entries.filter(e => e.name.endsWith('-meta.json')).map(e => readItem(e.name.slice(String(carId).length + 1, -10))));
        return reply({ items: items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(decorate) });
      }
      if (action === 'upload') {
        const file = form.get('file'), angle = form.get('angle'), background = form.get('background');
        if (!file || typeof file === 'string') return reply({ error: 'Vyberte fotografii.' }, 400);
        validatePhoto(file); editPrompt(angle, background);
        const existing = await checked(bucket.list('photo-studio', { search: `${carId}-`, limit: 1000 }));
        if (existing.filter(e => e.name.endsWith('-meta.json')).length >= 40) return reply({ error: 'Pro jeden vůz lze uložit nejvýše 40 fotografií.' }, 400);
        const id = crypto.randomUUID();
        const item = { id, angle, background, mime: file.type, ready: false, approved: false, createdAt: new Date().toISOString() };
        await checked(bucket.upload(pathFor(id, 'original'), file, { contentType: file.type }));
        try { await saveItem(item); } catch (e) { await bucket.remove([pathFor(id, 'original')]); throw e; }
        return reply({ item: decorate(item) });
      }
      const id = form.get('id');
      if (!/^[a-f0-9-]{36}$/.test(id || '')) return reply({ error: 'Neplatná fotografie.' }, 400);
      const item = await readItem(id);
      if (action === 'plate') {
        if (!item.ready) return reply({ error: 'Nejprve upravte fotografii.' }, 400);
        let plates;
        try { plates = validatePlates(JSON.parse(form.get('plates') || 'null')); }
        catch { return reply({ error: 'Označte správně čtyři rohy SPZ.' }, 400); }
        item.plates = plates; item.plateVerified = true; item.plateStatus = 'verified'; item.approved = false;
        await saveItem(item); return reply({ item: decorate(item) });
      }
      if (action === 'approve') {
        if (!item.ready) return reply({ error: 'Nejprve upravte fotografii.' }, 400);
        if (form.get('approved') === 'true' && !item.plateVerified) return reply({ error: 'Nejprve zkontrolujte a potvrďte zakrytí SPZ.' }, 400);
        item.approved = form.get('approved') === 'true'; await saveItem(item);
        return reply({ item: decorate(item) });
      }
      if (action !== 'process') return reply({ error: 'Neznámá operace.' }, 400);
      if (item.ready) return reply({ item: decorate(item) });
      if (!apiKey) return reply({ error: 'AI není nakonfigurovaná. Správce musí nastavit OPENAI_API_KEY.' }, 503);
      // Atomic storage insert prevents a retry or another tab paying for the same image twice.
      const lockPath = pathFor(id, 'lock');
      const lock = await bucket.upload(lockPath, new Blob(['processing']), { upsert: false });
      if (lock.error) return reply({ error: 'Fotografie se již zpracovává. Za chvíli obnovte seznam.' }, 409);
      try {
        const latest = await readItem(id);
        if (latest.ready) return reply({ item: decorate(latest) });
        const recovered = await bucket.download(pathFor(id, 'result.jpg'));
        if (!recovered.error && recovered.data?.size) {
          item.ready = true; await saveItem(item); return reply({ item: decorate(item) });
        }
        const original = await checked(bucket.download(pathFor(id, 'original')));
        const editingDeadline = AbortSignal.timeout(125000);
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
        Object.assign(item, await detectPlates(result.data[0].b64_json, apiKey, fetchVision));
        await checked(bucket.upload(pathFor(id, 'result.jpg'), bytes, { contentType: 'image/jpeg', upsert: true }));
        item.ready = true; item.approved = false; await saveItem(item);
        return reply({ item: decorate(item) });
      } finally { await bucket.remove([lockPath]); }
    } catch (error) {
      const known = /Použijte JPG|Fotografie může|Neplatný pohled/.test(error.message || '');
      return reply({ error: known ? error.message : 'Operace se nepodařila. Obnovte seznam; originály zůstávají uložené.' }, known ? 400 : 500);
    }
  };
}

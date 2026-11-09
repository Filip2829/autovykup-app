import { buildSharedSnapshot, loadShareSource, shareCompleteness, signShareFiles, validateShareUpload } from './vehicleSharing.js';

export function createSharingHandler({ db, projectUrl, now = () => Date.now() }) {
const origins = new Set(['https://autovykup-app.vercel.app', 'https://autovykup-app-filip-s-projects24.vercel.app', 'https://autovykup-app-git-main-filip-s-projects24.vercel.app']);
const hash = async (token) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
const checked = async (q) => { const { data, error } = await q; if (error) throw error; return data; };

return async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Origin',
    ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin)) return reply({ error: 'Nepovolený původ požadavku.' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Použijte POST.' }, 405);
  try {
    const reader = req.body?.getReader(); if (!reader) return reply({ error: 'Chybí data.' }, 400);
    const chunks = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 14500000) { await reader.cancel(); return reply({ error: 'Požadavek je příliš velký.' }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (b.action === 'view') {
      if (!/^[a-f0-9]{64}$/.test(b.token || '')) return reply({ error: 'Odkaz není dostupný nebo jeho platnost skončila.' }, 404);
      const link = await checked(db.from('vehicle_share_links').select('payload,expires_at,revoked_at').eq('token_hash', await hash(b.token)).maybeSingle());
      if (!link || link.revoked_at || Date.parse(link.expires_at) <= now()) return reply({ error: 'Odkaz není dostupný nebo jeho platnost skončila.' }, 404);
      return reply(await signShareFiles(db, link.payload, link.expires_at));
    }
    if (!['preview', 'create', 'list', 'revoke', 'upload'].includes(b.action)) return reply({ error: 'Neznámá operace.' }, 400);
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return reply({ error: 'Přihlaste se.' }, 401);
    const staff = await checked(db.from('valuation_staff').select('user_id').eq('user_id', user.id).maybeSingle());
    if (!staff) return reply({ error: 'Ke sdílení podkladů nemáte oprávnění.' }, 403);
    if (b.action === 'revoke') {
      if (!/^[\da-f-]{36}$/i.test(b.linkId || '')) return reply({ error: 'Neplatný odkaz.' }, 400);
      const rows = await checked(db.from('vehicle_share_links').update({ revoked_at: new Date(now()).toISOString() }).eq('id', b.linkId).is('revoked_at', null).select('id'));
      return reply({ revoked: rows.length > 0 });
    }
    const source = await loadShareSource(db, b.sourceType, b.sourceId, projectUrl);
    if (b.action === 'upload') {
      if (typeof b.base64 !== 'string' || b.base64.length > 13981016) return reply({ error: 'Soubor může mít nejvýše 10 MB.' }, 400);
      const file = Uint8Array.from(atob(b.base64), c => c.charCodeAt(0));
      validateShareUpload(file, b.mime, b.kind);
      const id = crypto.randomUUID();
      const ext = ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[b.mime];
      const path = b.sourceType === 'car' ? `${b.sourceId}/offer-${id}.${ext}` : `offer-requests/${b.sourceId}/${id}.${ext}`;
      const bucket = db.storage.from('vehicle-documents');
      await checked(bucket.upload(path, file, { contentType: b.mime, upsert: false }));
      try {
        await checked(db.from('vehicle_share_attachments').insert({ id, [b.sourceType === 'car' ? 'car_id' : 'request_id']: b.sourceId,
          created_by: user.id, kind: b.kind, title: String(b.title || (b.kind === 'tp' ? 'Technický průkaz' : 'Výpis CEBIA')).slice(0,150), object_path: path, mime_type: b.mime }));
      } catch (e) { await bucket.remove([path]); throw e; }
      return reply({ uploaded: true });
    }
    if (b.action === 'preview') {
      const preview = await signShareFiles(db, { ...source, audience: 'aaa' }, new Date(now() + 300000).toISOString());
      return reply(preview);
    }
    const column = b.sourceType === 'car' ? 'car_id' : 'request_id';
    if (b.action === 'list') return reply({ links: await checked(db.from('vehicle_share_links').select('id,audience,created_at,expires_at,revoked_at').eq(column, b.sourceId).order('created_at', { ascending: false }).limit(50)) });
    if (b.confirm !== true) return reply({ error: 'Potvrďte sdílení vybraných podkladů.' }, 400);
    const days = Number(b.days); if (![1, 7, 14, 30].includes(days)) return reply({ error: 'Vyberte platnost odkazu.' }, 400);
    const snapshot = buildSharedSnapshot(source, b);
    const missing = shareCompleteness(snapshot);
    if (missing.length && b.allowIncomplete !== true) return reply({ error: `Chybí podklady: ${missing.join(', ')}. Potvrďte vytvoření neúplné nabídky.` }, 400);
    // Sign once before saving to catch missing Storage objects. Persist only safe snapshot and file references.
    const expiresAt = new Date(now() + days * 86400000).toISOString();
    await signShareFiles(db, snapshot, expiresAt, true);
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v => v.toString(16).padStart(2, '0')).join('');
    const link = await checked(db.from('vehicle_share_links').insert({ [column]: b.sourceId, created_by: user.id, audience: b.audience, token_hash: await hash(secret), payload: snapshot, expires_at: expiresAt }).select('id,expires_at').single());
    return reply({ ...link, token: secret });
  } catch {
    return reply({ error: 'Podklady se nepodařilo zpracovat. Zkontrolujte dostupnost souborů a zkuste to znovu.' }, 400);
  }
};
}

// Longer than the platform's maximum request lifetime. Never steal a live job.
export const lockLifetimeMs = 10 * 60 * 1000;

export async function acquireProcessingLock(bucket, path, now = Date.now()) {
  const token = crypto.randomUUID();
  const body = JSON.stringify({ token, createdAt: now });
  const create = () => bucket.upload(path, new Blob([body], { type: 'application/json' }), { upsert: false, cacheControl: '0' });
  let result = await create();
  if (result.error) {
    const old = await bucket.download(path);
    if (old.error) throw result.error;
    const previous = await old.data.text();
    let createdAt;
    try { createdAt = JSON.parse(previous).createdAt; } catch { /* Legacy plain-text lock. */ }
    if (!Number.isFinite(createdAt)) {
      const slash = path.lastIndexOf('/');
      const entries = await bucket.list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 100 });
      if (entries.error) throw entries.error;
      createdAt = Date.parse(entries.data.find(entry => entry.name === path.slice(slash + 1))?.created_at);
    }
    if (!Number.isFinite(createdAt) || now - createdAt <= lockLifetimeMs) return null;
    // All contenders for THIS expired generation share one recovery guard.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${previous}:${createdAt}`));
    const generation = Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('').slice(0, 24);
    const guard = `${path}-recovery-${generation}`;
    const recovery = await bucket.upload(guard, new Blob([body]), { upsert: false });
    if (recovery.error) return null;
    try {
      const current = await bucket.download(path);
      if (current.error || await current.data.text() !== previous) return null;
      const removed = await bucket.remove([path]);
      if (removed.error) throw removed.error;
      result = await create();
      if (result.error) return null;
    } finally { await bucket.remove([guard]); }
  }
  return async () => {
    const current = await bucket.download(path);
    if (!current.error && await current.data.text() === body) await bucket.remove([path]);
  };
}

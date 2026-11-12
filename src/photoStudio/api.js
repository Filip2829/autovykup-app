import { supabase } from '../supabase';
async function requestOnce(carId, action, values = {}) {
  const body = new FormData();
  if (typeof carId === 'string' && carId.startsWith('session:')) {
    body.set('scope', 'standalone'); body.set('sessionId', carId.slice(8));
  } else body.set('carId', String(carId));
  body.set('action', action);
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  const { data, error } = await supabase.functions.invoke('vehicle-photo-studio', { body });
  if (error) {
    if (error.context?.status === 546) throw new Error('Server přerušil náročnou úpravu. Originál zůstal zachovaný; obnovte seznam a úpravu zopakujte.');
    let message;
    try { message = (await error.context.json()).error; } catch { /* Network errors have no response. */ }
    throw new Error(message || 'Fotostudio není dostupné. Obnovte seznam a zkuste to znovu.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function studioRequest(carId, action, values = {}) {
  let data = await requestOnce(carId, action, ['process', 'reprocess'].includes(action) ? { ...values, staged: 'true' } : values);
  // Each CPU-heavy step gets a separate server invocation; drafts cannot be exported.
  for (let step = 0; data.continueProcessing && step < 3; step++) {
    data = await requestOnce(carId, 'process', { id: values.id, staged: 'true' });
  }
  if (data.continueProcessing) throw new Error('Úprava není dokončená. Obnovte seznam a pokračujte tlačítkem Upravit.');
  return data;
}

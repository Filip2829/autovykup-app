import { supabase } from '../supabase';
export async function studioRequest(carId, action, values = {}) {
  const body = new FormData();
  body.set('carId', String(carId)); body.set('action', action);
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  const { data, error } = await supabase.functions.invoke('vehicle-photo-studio', { body });
  if (error) {
    let message;
    try { message = (await error.context.json()).error; } catch { /* Network errors have no response. */ }
    throw new Error(message || 'Fotostudio není dostupné. Obnovte seznam a zkuste to znovu.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

import { supabase } from '../supabase.js';

export async function sharingApi(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('vehicle-sharing', { body: { action, ...payload } });
  if (error) {
    let message = 'Sdílení se nepodařilo zpracovat.';
    try { message = (await error.context.json()).error || message; } catch { /* No JSON response on a network failure. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function shareUrl(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Neplatný odkaz.');
  return `${window.location.origin}/nabidka-vozu#${token}`;
}

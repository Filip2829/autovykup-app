import { supabase } from '../supabase.js';
import { valuationScope } from './valuationScope.js';
export async function valuationApi(action, payload = {}, { isTest = import.meta.env.MODE === 'valuation-test' } = {}) {
 const { functionName } = valuationScope(isTest);
 const { data, error } = await supabase.functions.invoke(functionName, { body: { action, ...payload } });
 if (error) { let message = error.message; try { message = (await error.context.json()).error || message; } catch { /* Network error has no response. */ } throw new Error(message); }
 if (data?.error) throw new Error(data.error);
 return data;
}
export async function optimizePhoto(file) {
 if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 20000000) throw new Error('Vyberte JPEG, PNG nebo WebP do 20 MB. HEIC nejprve převeďte do JPEG.');
 const bitmap = await createImageBitmap(file);
 if (bitmap.width * bitmap.height > 60000000) { bitmap.close(); throw new Error('Fotografie má příliš vysoké rozlišení.'); }
 const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
 const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
 canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
 const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.82));
 if (!blob || blob.size > 3145728) throw new Error('Fotografii se nepodařilo zmenšit pod 3 MB.');
 return { blob, base64: await new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob); }) };
}
export async function loadRequest(id, { isTest = import.meta.env.MODE === 'valuation-test' } = {}) {
 const tables = ['valuation_requests','valuation_photos','valuation_notes','valuation_events','valuation_mail'];
 const results = await Promise.all(tables.map((table,index) => {let q=supabase.from(table).select('*'); return index===0?q.eq('id',id).eq('is_test',isTest).single():q.eq('request_id',id).order('created_at',{ascending:false});}));
 for(const r of results) if(r.error) throw new Error(r.error.message);
 const [request, photos, notes, events, mail] = results.map(r=>r.data);
 const signed = await Promise.all(photos.filter(p=>!p.removed).map(async p => {const {data,error}=await supabase.storage.from('valuation-photos').createSignedUrl(p.path,600);return {...p,url:error?null:data.signedUrl};}));
 return { ...request, photos:signed, notes, events, mail };
}

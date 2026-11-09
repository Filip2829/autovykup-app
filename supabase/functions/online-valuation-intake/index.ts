import { createClient } from 'npm:@supabase/supabase-js@2.106.1';
import { cleanPricing, cleanSubmission, shots, textValue, validateVehicle } from '../_shared/onlineValuation.js';
import { convertValuation } from '../_shared/valuationConversion.js';
import { manualValuationAccess } from '../_shared/manualValuationAccess.js';

// Live manual intake. Email operations are absent from this endpoint.
const allowedOrigins = new Set([
 'https://autovykup-app.vercel.app',
 'https://autovykup-app-filip-s-projects24.vercel.app',
 'https://autovykup-app-git-main-filip-s-projects24.vercel.app',
]);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const bucket = db.storage.from('valuation-photos');
const encoder = new TextEncoder();
const hash = async(value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function rpc(name: string,args = {}) {const {data,error}=await db.rpc(name,args);if(error)throw new Error(error.message);return data;}
async function action(name: string,id: string,actor: string|null,h: string,p = {}) {return rpc('valuation_action',{p_action:name,p_id:id,p_actor:actor,p_hash:h,p});}
async function boundedJson(req: Request) {
 const limit=4500000;if(Number(req.headers.get('content-length'))>limit)throw new Error('Požadavek je příliš velký.');
 const reader=req.body?.getReader();if(!reader)throw new Error('Chybí data.');let size=0;const parts: Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Požadavek je příliš velký.');}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
Deno.serve(async(req: Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Vary':'Origin','Cache-Control':'no-store','Referrer-Policy':'no-referrer',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const reply=(body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowedOrigins.has(origin))return reply({error:'Nepovolený původ požadavku.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Použijte POST.'},405);
 try{
  const b=await boundedJson(req);const name=b.action;const access=manualValuationAccess(name);
  if(!access.allowed)return reply({error:'Tato operace není v ručním zpracování dostupná.'},403);
  let actor: string|null=null;let username='';
  if(access.requiresStaff){
   const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
   const {data:{user},error}=await db.auth.getUser(bearer);
   if(error||!user)return reply({error:'Přihlaste se.'},401);
   const {data:staff,error:staffError}=await db.from('valuation_staff').select('user_id').eq('user_id',user.id).maybeSingle();
   if(staffError||!staff)return reply({error:'Nemáte oprávnění k poptávkám.'},403);
   actor=user.id;username=(user.email||'').replace('@autovykup.local','');
  }
  if(!access.internal){
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
   const ok=await rpc('valuation_rate_limit',{p_key:await hash('manual:'+ip+':'+(name==='begin'?'begin':'request')),p_max:name==='begin'?10:200});
   if(!ok)return reply({error:'Příliš mnoho požadavků. Zkuste to později.'},429);
  }
  if(name==='begin'){
   if(b.honeypot)return reply({error:'Podání nelze přijmout.'},400);
   // If Turnstile is configured, validate it. Honeypot and database limits always apply.
   const captchaSecret=Deno.env.get('TURNSTILE_SECRET');
   if(captchaSecret){
    const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:captchaSecret,response:b.captcha||''})}).then(r=>r.json());
    if(!verification.success)return reply({error:'Potvrďte kontrolu proti spamu.'},400);
   }
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const id=crypto.randomUUID();
   await action('begin',id,null,'',{token_id:crypto.randomUUID(),hash:await hash(token),is_test:false});
   return reply({id,token});
  }
  if(!/^[\da-f-]{36}$/i.test(b.id||''))throw new Error('Neplatná poptávka.');
  const {data:target,error:targetError}=await db.from('valuation_requests').select('is_test').eq('id',b.id).maybeSingle();
  if(targetError||!target||target.is_test!==false)return reply({error:'Poptávka není dostupná.'},403);
  const h=access.internal?'':await hash(textValue(b.token,150));
  if(name==='upload'){
   await action('authorize_upload',b.id,null,h);
   if(!Object.hasOwn(shots,b.shot)||typeof b.base64!=='string'||b.base64.length>4194304)throw new Error('Neplatná fotografie.');
   const bytes=Uint8Array.from(atob(b.base64),x=>x.charCodeAt(0));
   if(bytes.length>3145728||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error('Povoleny jsou fotografie JPEG do 3 MB.');
   const path=b.id+'/'+crypto.randomUUID()+'.jpg';
   const {error}=await bucket.upload(path,bytes,{contentType:'image/jpeg',upsert:false});if(error)throw error;
   try{return reply(await action('photo',b.id,null,h,{path,shot:b.shot}));}catch(e){await bucket.remove([path]);throw e;}
  }
  if(name==='remove_photo'){
   const result=await action('remove_photo',b.id,null,h,{photo_id:b.photo_id});
   if(result.path){const {error}=await bucket.remove([result.path]);if(error)throw error;await db.from('valuation_photos').delete().eq('request_id',b.id).eq('path',result.path).eq('removed',true);}
   return reply({removed:true});
  }
  if(name==='submit'){
   const errors=validateVehicle(b.data||{},true);if(errors.length)throw new Error(errors.join(' '));
   return reply(await rpc('valuation_manual_submit',{p_id:b.id,p_hash:h,p_data:cleanSubmission(b.data),p_retention_days:180}));
  }
  if(name==='save')return reply(await action(name,b.id,actor,h,{pricing:cleanPricing(b.pricing||{}),status:b.status,assigned_to:b.assigned_to,revision:b.revision}));
  if(name==='note'){if(!textValue(b.body))throw new Error('Poznámka je prázdná.');return reply(await action(name,b.id,actor,h,{body:textValue(b.body,4000),note_id:b.note_id}));}
  if(name==='convert')return reply(await convertValuation(db,{id:b.id,actor,username,revision:b.revision}));
  return reply({error:'Neznámá operace.'},400);
 }catch(e){return reply({error:String(e instanceof Error?e.message:'Operaci se nepodařilo dokončit.').slice(0,500)},400);}
});

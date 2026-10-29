import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { loadRequest } from './api.js';
export default function TransferredValuationPhotos({carId}) {
 const [request,setRequest]=useState(null);const [error,setError]=useState('');
 useEffect(()=>{let active=true;async function load(){const {data,error}=await supabase.from('valuation_requests').select('id').eq('converted_car_id',carId).maybeSingle();if(error)return; if(!data){if(active)setRequest(null);return;}try{const r=await loadRequest(data.id);if(active){setRequest(r);setError('');}}catch(e){if(active)setError(e.message);}}load();const timer=setInterval(load,480000);return()=>{active=false;clearInterval(timer);};},[carId]);
 if(!request&&!error)return null;
 return <section><h3>Podklady online nacenění {request?.number}</h3>{error&&<p role="alert">{error}</p>}<div className="photoGrid">{request?.photos.map(p=><a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img style={{width:'100%',maxHeight:220,objectFit:'cover'}} src={p.url} alt={p.shot}/></a>)}</div><details><summary>Interní poznámky z poptávky</summary>{request?.notes.map(n=><p key={n.id}>{n.body}</p>)}</details></section>;
}

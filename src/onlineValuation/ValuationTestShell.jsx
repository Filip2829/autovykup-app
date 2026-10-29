import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import PublicValuation, { CustomerValuationLink } from './PublicValuation.jsx';
import ValuationInbox from './ValuationInbox.jsx';
import { isPublicTestPath } from './testAccess.js';

export default function ValuationTestShell() {
 const path=window.location.pathname.replace(/\/$/,'');
 return isPublicTestPath(path,import.meta.env.VITE_VALUATION_PUBLIC_TEST)
  ? <PublicValuation />
  : <StaffValuationTestShell path={path} />;
}

function StaffValuationTestShell({path}) {
 const [user,setUser]=useState(null), [ready,setReady]=useState(false), [username,setUsername]=useState('filkra'), [password,setPassword]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(active){setUser(data.session?.user||null);setReady(true);}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));return()=>{active=false;subscription.unsubscribe();};},[]);
 async function login(e){e.preventDefault();setBusy(true);setError('');try{const email=username.includes('@')?username:username+'@autovykup.local';const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;setPassword('');}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!ready)return <p>Načítání přihlášení…</p>;
 if(!user)return <main className="ov ov-public"><form className="ov-panel" onSubmit={login}><h1>Test online nacenění</h1><p>Přihlaste se svým účtem AutoVýkupu. Testovací poptávky se nepřevádějí do evidence vozidel a e-maily jsou pozastavené.</p><label>Uživatelské jméno<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>Heslo<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>Přihlásit se</button></form></main>;
 return <><nav className="ov ov-panel"><strong>Testovací režim · e-maily pozastavené</strong> · <a href="/naceneni-vozu">Nová žádost</a> · <a href="/poptavky-naceneni">Poptávky nacenění</a> · <button onClick={()=>supabase.auth.signOut({scope:'local'})}>Odhlásit se</button></nav>{path==='/naceneni-vozu/odkaz'?<CustomerValuationLink/>:path==='/naceneni-vozu'?<PublicValuation/>:<ValuationInbox onBack={()=>{window.location.href='/naceneni-vozu';}}/>}</>;
}

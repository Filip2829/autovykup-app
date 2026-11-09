import { useState } from 'react';
import { Link, Copy, ExternalLink } from 'lucide-react';
import AppModal from '../components/ui/AppModal.jsx';
import { sharingApi, shareUrl } from './sharingApi.js';
import { shareCompleteness } from '../../supabase/functions/_shared/vehicleSharing.js';
import './sharing.css';

const kindLabels = { photo: 'Fotografie vozu', tp: 'Technický průkaz', cebia: 'Výpis CEBIA' };

export default function ShareVehicleButton({ sourceType, sourceId, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(null);
  const [selected, setSelected] = useState([]);
  const [audience, setAudience] = useState('aaa');
  const [vat, setVat] = useState('unknown');
  const [stk, setStk] = useState('');
  const [message, setMessage] = useState('');
  const [days, setDays] = useState('14');
  const [confirm, setConfirm] = useState(false);
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [links, setLinks] = useState([]);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const context = { sourceType, sourceId };

  async function load() {
    setOpen(true); setBusy(true); setError(''); setNotice(''); setConfirm(false); setAllowIncomplete(false); setSource(null); setCreated(null);
    try {
      const data = await sharingApi('preview', context);
      setSource(data); setSelected(data.files.filter(f => f.url).map(f => f.id)); setVat(data.vehicle.vat); setStk(data.vehicle.stkValidUntil || '');
      setAudience('aaa'); setMessage('');
      const result = await sharingApi('list', context); setLinks(result.links);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  function toggle(id) { setConfirm(false); setAllowIncomplete(false); setSelected(current => current.includes(id) ? current.filter(v => v !== id) : [...current, id]); }
  const chosen = source?.files.filter(f => selected.includes(f.id)) || [];
  const missing = source ? shareCompleteness({ files: chosen, audience, vehicle: { ...source.vehicle, stkValidUntil: stk, vat } }) : [];

  async function create() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await sharingApi('create', { ...context, fileIds: selected, vat, stkValidUntil: stk, audience, message, days: Number(days), confirm, allowIncomplete });
      setCreated({ ...result, url: shareUrl(result.token) });
      const resultList = await sharingApi('list', context); setLinks(resultList.links);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function revoke(id) {
    setBusy(true); setError('');
    try {
      await sharingApi('revoke', { linkId: id });
      setLinks(current => current.map(link => link.id === id ? { ...link, revoked_at: new Date().toISOString() } : link));
      if (created?.id === id) setCreated(null);
      setNotice('Odkaz byl zneplatněn.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(created.url); setNotice('Odkaz zkopírován. Můžeš ho poslat zvolenému zájemci.'); }
    catch { setNotice('Automatické kopírování není dostupné. Odkaz označ a zkopíruj ručně.'); }
  }
  async function upload(event, kind) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10485760 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Vyber PDF nebo fotografii JPEG, PNG či WebP do 10 MB.'); return; }
    setBusy(true); setError(''); setConfirm(false); setAllowIncomplete(false);
    try {
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      await sharingApi('upload', { ...context, kind, mime: file.type, title: file.name, base64 });
      const updated = await sharingApi('preview', context);
      const oldIds = new Set(source.files.map(f => f.id));
      setSelected(current => [...current, ...updated.files.filter(f => f.url && !oldIds.has(f.id)).map(f => f.id)]);
      setSource(updated); setNotice('Podklad je uložený u tohoto záznamu a připravený ke sdílení.');
    } catch (e) { setError(e.message || 'Soubor se nepodařilo nahrát.'); } finally { setBusy(false); }
  }

  return <>
    <button type="button" className="primary outline" onClick={load} disabled={disabled}><Link size={18} /> Sdílet vůz / nabídka pro AAA</button>
    <AppModal isOpen={open} title="Sdílet nabídku vozu" onClose={() => { if (!busy) setOpen(false); }}>
      <div className="vehicleShareEditor">
        <p>Vytvoř odkaz pro AAA Auto nebo dalšího zájemce. Odeslání odkazu je na tobě.</p>
        {error && <p role="alert" className="shareError">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p role="status">Zpracování…</p>}
        {source && !created && <>
          <h3>{source.vehicle.name}</h3>
          <div className="shareFormGrid">
            <label>Účel nabídky<select value={audience} onChange={e => { const v = e.target.value; setAudience(v); setConfirm(false); setSelected(source.files.filter(f => f.url && (v === 'aaa' || f.kind !== 'tp')).map(f => f.id)); }}><option value="aaa">AAA Auto · podklady k nacenění</option><option value="buyer">Zájemce o vůz</option></select></label>
            <label>Platnost odkazu<select value={days} onChange={e => setDays(e.target.value)}><option value="1">1 den</option><option value="7">7 dní</option><option value="14">14 dní</option><option value="30">30 dní</option></select></label>
            <label>Platnost STK do<input type="date" value={stk} onChange={e => { setStk(e.target.value); setConfirm(false); setAllowIncomplete(false); }} /></label>
            <label>Odpočet DPH<select value={vat} onChange={e => { setVat(e.target.value); setConfirm(false); setAllowIncomplete(false); }}><option value="unknown">Neuvedeno / neověřeno</option><option value="yes">Ano</option><option value="no">Ne</option></select></label>
          </div>
          <p>STK a DPH zde můžeš upřesnit pro tuto nabídku. Původní záznam se tím nemění.</p>
          <label>Zpráva pro příjemce<textarea maxLength={2000} value={message} onChange={e => { setMessage(e.target.value); setConfirm(false); }} placeholder="Doplňující informace určené příjemci nabídky" /></label>
          {Object.entries(kindLabels).map(([kind, label]) => <section key={kind}><h4>{label} ({chosen.filter(f => f.kind === kind).length}/{source.files.filter(f => f.kind === kind).length})</h4>
            {kind !== 'photo' && <label>Přidat {kind === 'tp' ? 'TP' : 'výpis CEBIA'} (PDF nebo fotografie, do 10 MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => upload(e, kind)} /></label>}
            {!source.files.some(f => f.kind === kind) && <p>Podklad zatím není přiložený.</p>}
            <div className="shareAssetGrid">{source.files.filter(f => f.kind === kind).map(f => <label key={f.id} className="shareAsset"><input type="checkbox" checked={selected.includes(f.id)} disabled={!f.url} onChange={() => toggle(f.id)} />{(f.mime?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test((f.url || '').split('?')[0])) && <img src={f.url} alt={f.title} loading="lazy" />}<span>{f.title}</span>{f.url ? <a href={f.url} target="_blank" rel="noreferrer">Zkontrolovat podklad ↗</a> : <span>Soubor není dostupný</span>}</label>)}</div>
          </section>)}
          {missing.length > 0 && <div className="shareWarning"><p>V nabídce chybí: {missing.join(', ')}.</p><label className="shareCheck"><input type="checkbox" checked={allowIncomplete} onChange={e => setAllowIncomplete(e.target.checked)} />Chci vytvořit odkaz i s těmito chybějícími údaji.</label></div>}
          <p>Interní ceny, poznámky a kontaktní údaje původního zákazníka se nesdílejí. Vybrané TP a výpisy mohou obsahovat osobní údaje; před sdílením je zkontroluj.</p>
          <label className="shareCheck"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />Souhlasím se zpřístupněním vybraných podkladů každému, kdo získá tento odkaz.</label>
          <button type="button" className="primary" disabled={busy || !confirm || !selected.length || (missing.length > 0 && !allowIncomplete)} onClick={create}>Vytvořit odkaz</button>
        </>}
        {created && <div className="shareCreated"><h3>Odkaz je připravený</h3><p>Platí do {new Date(created.expires_at).toLocaleString('cs-CZ')}.</p><label>Odkaz k odeslání<input readOnly value={created.url} onFocus={e => e.target.select()} /></label><div className="shareActions"><button type="button" className="primary" onClick={copy}><Copy size={17} />Kopírovat odkaz</button><a href={created.url} target="_blank" rel="noreferrer"><ExternalLink size={17} />Otevřít nabídku</a></div><p>Odkaz si zkopíruj. Po zavření lze vytvořit nový; všechny vytvořené odkazy můžeš níže zneplatnit.</p></div>}
        <h3>Vytvořené odkazy</h3>{!links.length && <p>Zatím nebyl vytvořen žádný odkaz.</p>}
        {links.map(link => { const inactive = link.revoked_at; return <div className="shareLinkRow" key={link.id}><span>{link.audience === 'aaa' ? 'AAA Auto' : 'Zájemce'} · {new Date(link.created_at).toLocaleDateString('cs-CZ')}<small>{link.revoked_at ? 'Zneplatněno' : `Platnost do ${new Date(link.expires_at).toLocaleDateString('cs-CZ')}`}</small></span><button type="button" disabled={busy || Boolean(inactive)} onClick={() => revoke(link.id)}>Zneplatnit</button></div>; })}
      </div>
    </AppModal>
  </>;
}

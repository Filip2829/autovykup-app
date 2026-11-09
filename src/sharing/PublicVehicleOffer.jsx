import { useEffect, useState } from 'react';
import { sharingApi } from './sharingApi.js';
import { companyProfile } from '../marketing/config/companyProfile.js';
import './sharing.css';

const labels = { vin: 'VIN', spz: 'SPZ', year: 'Rok', km: 'Nájezd km', fuel: 'Palivo', engine: 'Motorizace', transmission: 'Převodovka', drive: 'Pohon', powerKw: 'Výkon kW', color: 'Barva' };

export default function PublicVehicleOffer() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const token = window.location.hash.slice(1);
    sharingApi('view', { token }).then(result => { if (active) { setData(result); setError(''); } }).catch(e => { if (active) { setError(e.message); setData(null); } }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [refresh]);
  function reload() { setBusy(true); setRefresh(n => n + 1); }
  return <main className="publicVehicleOffer">
    <header><a href="https://www.opportunity.cz" rel="noreferrer">OPPORTUNITY</a><span>Nabídka vozidla</span></header>
    {busy && <p role="status">Načítám nabídku…</p>}{error && <div role="alert" className="offerCard"><h1>Nabídka není dostupná</h1><p>{error}</p><p>Požádejte prodejce o nový odkaz.</p></div>}
    {data && <>
      <section className="offerIntro"><p className="offerEyebrow">{data.audience === 'aaa' ? 'Podklady k nacenění' : 'Prohlédněte si vůz'}</p><h1>{data.vehicle.name}</h1><p>{[data.vehicle.year, data.vehicle.km && `${Number(data.vehicle.km).toLocaleString('cs-CZ')} km`, data.vehicle.fuel, data.vehicle.transmission].filter(Boolean).join(' · ')}</p></section>
      <section className="offerCard"><h2>Informace o vozidle</h2><dl className="offerFacts">{Object.entries(labels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.vehicle[key] || 'Neuvedeno'}</dd></div>)}<div><dt>Platnost STK do</dt><dd>{data.vehicle.stkValidUntil ? new Date(`${data.vehicle.stkValidUntil}T12:00:00`).toLocaleDateString('cs-CZ') : data.vehicle.stkDeclared === 'yes' ? 'Platná dle zákazníka, datum neuvedeno' : data.vehicle.stkDeclared === 'no' ? 'Dle zákazníka bez platné STK' : 'Neuvedeno'}</dd></div><div><dt>Odpočet DPH</dt><dd>{{ yes: 'Ano', no: 'Ne', unknown: 'Neuvedeno / neověřeno' }[data.vehicle.vat]}</dd></div></dl></section>
      {data.message && <section className="offerCard"><h2>Informace od prodejce</h2><p className="offerMessage">{data.message}</p></section>}
      {data.missing.length > 0 && <p className="shareWarning">Dosud nedodané podklady: {data.missing.join(', ')}.</p>}
      <section className="offerCard"><h2>Fotografie vozu ({data.files.filter(f => f.kind === 'photo').length})</h2><div className="offerPhotos">{data.files.filter(f => f.kind === 'photo' && f.url).map(f => <a href={f.url} key={f.id} target="_blank" rel="noreferrer"><img src={f.url} alt={f.title} loading="lazy" /><span>{f.title} ↗</span></a>)}</div></section>
      {['tp', 'cebia'].map(kind => <section className="offerCard" key={kind}><h2>{kind === 'tp' ? 'Technický průkaz' : 'Výpis CEBIA'} ({data.files.filter(f => f.kind === kind).length})</h2>{!data.files.some(f => f.kind === kind) && <p>Podklad není součástí této nabídky.</p>}<div className="offerDocuments">{data.files.filter(f => f.kind === kind && f.url).map(f => <a key={f.id} href={f.url} target="_blank" rel="noreferrer">{f.title} · otevřít / stáhnout ↗</a>)}</div></section>)}
      <section className="offerCard"><h2>Kontakt na prodejce</h2><p>{companyProfile.company} · {companyProfile.salesperson.name}</p><p><a href={`tel:${companyProfile.salesperson.phone.replace(/\s/g, '')}`}>{companyProfile.salesperson.phone}</a> · <a href={`mailto:${companyProfile.salesperson.email}`}>{companyProfile.salesperson.email}</a></p><p>Platnost nabídky do {new Date(data.expiresAt).toLocaleString('cs-CZ')}.</p><button type="button" disabled={busy} onClick={reload}>Obnovit podklady</button></section>
    </>}
  </main>;
}

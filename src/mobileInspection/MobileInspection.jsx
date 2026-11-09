import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronLeft, ImagePlus, Save, Smartphone } from 'lucide-react';
import { supabase } from '../supabase.js';
import { createInspectionService, DuplicateInspectionError } from './inspectionService.js';
import { changedFormFields, damageAreas, priceFields, readInspectionForm, technicalFields, text, validateInspectionForm } from './inspectionModel.js';
import { inspectionDraftKey, readInspectionDraft, reconcileSavedForm, writeInspectionDraft } from './inspectionDraft.js';
import { prepareInspectionPhoto } from './preparePhoto.js';
import './mobileInspection.css';

const money = value => value == null ? 'Neuvedeno' : `${Math.round(Number(value)).toLocaleString('cs-CZ')} Kč`;
const fieldLabels = { brand: 'Značka', model: 'Model', vin: 'VIN', spz: 'SPZ', year: 'Rok', km: 'Nájezd (km)', customerName: 'Jméno zákazníka', customerPhone: 'Telefon', customerEmail: 'E-mail', valuationDate: 'Datum nacenění', preparationCosts: 'Náklady na přípravu', ...Object.fromEntries(technicalFields.map(([key,label]) => [key,label])), ...Object.fromEntries(priceFields.map(([key,label]) => [key,label])) };

function PhotoInput({ title, kind, disabled, onFiles }) {
  return <div className="miPhotoInputs"><label><Camera size={20} />Vyfotit {title}<input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={e => { onFiles([...e.target.files], kind); e.target.value = ''; }} /></label><label><ImagePlus size={20} />Vybrat z galerie<input type="file" accept="image/*" multiple disabled={disabled} onChange={e => { onFiles([...e.target.files], kind); e.target.value = ''; }} /></label></div>;
}

export default function MobileInspection({ userId, username, onBack, onSaved, onOpenVehicle, availableCars = [], client = supabase, service: providedService }) {
  const draftKey = inspectionDraftKey(userId);
  const [initial] = useState(() => { try { return readInspectionDraft(window.localStorage, draftKey); } catch { return null; } });
  const [creationKey, setCreationKey] = useState(() => initial?.creationKey || crypto.randomUUID());
  const [car, setCar] = useState(() => initial?.carId ? { id: initial.carId } : null);
  const [form, setForm] = useState(() => initial?.form || readInspectionForm());
  const [baseline, setBaseline] = useState(() => initial?.baseline || readInspectionForm());
  const [note, setNote] = useState(() => initial?.note || '');
  const [noteKey, setNoteKey] = useState(() => initial?.noteKey || crypto.randomUUID());
  const [damageArea, setDamageArea] = useState(() => initial?.damageArea || 'exterior');
  const [damageDescription, setDamageDescription] = useState(() => initial?.damageDescription || '');
  const [records, setRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [duplicate, setDuplicate] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [draftWarning, setDraftWarning] = useState(false);
  const running = useRef(false);
  const savedCallback = useRef(onSaved);
  const service = useMemo(() => providedService || createInspectionService({ client, username }), [providedService, client, username]);
  const dirty = Object.keys(changedFormFields(form, baseline)).length > 0;
  const pendingFiles = uploads.some(item => item.state !== 'done');

  useEffect(() => { savedCallback.current = onSaved; }, [onSaved]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const items = await service.list(); if (active) setRecords(items);
        if (initial?.carId) {
          const latest = await service.get(initial.carId);
          if (active) {
            setCar(latest);
            if (!Object.keys(changedFormFields(initial.form, initial.baseline)).length) { const fields = readInspectionForm(latest); setForm(fields); setBaseline(fields); }
          }
        }
      } catch (e) { if (active) setError(e.message); } finally { if (active) setLoading(false); }
    }
    load(); return () => { active = false; };
  }, [service, initial]);
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      let ok = false;
      try { ok = writeInspectionDraft(window.localStorage, draftKey, { creationKey, carId: car?.id || null, form, baseline, note, noteKey, damageArea, damageDescription }); } catch { /* Storage may be blocked by the browser. */ }
      setDraftWarning(!ok);
    }, 150);
    return () => clearTimeout(timer);
  }, [draftKey, creationKey, car?.id, form, baseline, note, noteKey, damageArea, damageDescription, loading]);
  useEffect(() => {
    if (!car?.id) return;
    let active = true;
    service.documents(car.id).then(items => { if (active) setDocuments(items); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [car?.id, service]);
  useEffect(() => {
    function leave(event) { if (dirty || note.trim() || pendingFiles) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty, note, pendingFiles]);

  const acceptSaved = useCallback(async (saved, submitted) => {
    const next = readInspectionForm(saved);
    setCar(saved); setBaseline(next); setForm(current => reconcileSavedForm(current, submitted, next));
    setRecords(current => [saved, ...current.filter(item => item.id !== saved.id)]);
    await savedCallback.current?.(saved);
    return saved;
  }, []);

  const saveForm = useCallback(async () => {
    const submitted = { ...form };
    const validation = validateInspectionForm(submitted, { creating: !car?.id });
    if (validation) throw new Error(validation);
    const saved = car?.id ? await service.saveForm(car.id, submitted, baseline) : await service.create(submitted, creationKey);
    return acceptSaved(saved, submitted);
  }, [form, baseline, car?.id, creationKey, service, acceptSaved]);

  const run = useCallback(async (label, task) => {
    if (running.current) return false;
    running.current = true; setBusy(true); setError(''); setNotice(label); setDuplicate(null);
    try { await task(); return true; }
    catch (e) { setError(e.message || 'Akci se nepodařilo dokončit.'); setNotice(''); if (e instanceof DuplicateInspectionError) setDuplicate(e.car); return false; }
    finally { running.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    if (!car?.id || !dirty || loading || busy || error || validateInspectionForm(form)) return;
    const timer = setTimeout(() => { run('Ukládám změny…', async () => { await saveForm(); setNotice('Změny uloženy do karty.'); }); }, 1200);
    return () => clearTimeout(timer);
  }, [car?.id, dirty, loading, busy, error, form, run, saveForm]);

  function edit(key, value) { setForm(current => ({ ...current, [key]: value })); setError(''); setNotice('Rozepsané změny'); }
  function field(key, { type = 'text', placeholder = '', required = false } = {}) {
    return <label key={key}>{fieldLabels[key]}{required && ' *'}<input type={type} value={form[key] || ''} placeholder={placeholder} required={required} disabled={loading || (busy && !car?.id)} autoComplete={key === 'customerPhone' ? 'tel' : key === 'customerEmail' ? 'email' : 'off'} inputMode={type === 'number' ? 'decimal' : undefined} min={type === 'number' ? '0' : undefined} onChange={e => edit(key, e.target.value)} /></label>;
  }
  async function refreshDocuments(id) { setDocuments(await service.documents(id)); }

  async function openRecord(id) {
    if (pendingFiles || note.trim() || dirty) { setError('Nejdřív ulož rozepsané údaje a poznámku a dokonči nebo odeber nenahrané fotografie.'); return; }
    await run('Otevírám vůz…', async () => {
      const saved = await service.get(id); const fields = readInspectionForm(saved);
      setCar(saved); setForm(fields); setBaseline(fields); setUploads([]); setEstimate(null); setExtraction(null); setDocuments([]);
      await refreshDocuments(saved.id); setNotice('Karta načtena.');
    });
  }
  function newRecord() {
    if (dirty || note.trim() || pendingFiles) { setError('Nejdřív ulož aktuální údaje, poznámku a fotografie.'); return; }
    setCar(null); const empty = readInspectionForm(); setForm(empty); setBaseline(empty); setCreationKey(crypto.randomUUID()); setNoteKey(crypto.randomUUID()); setDocuments([]); setUploads([]); setEstimate(null); setExtraction(null); setDamageDescription(''); setError(''); setNotice('');
  }
  async function saveNote() {
    const submittedNote = note;
    await run('Ukládám poznámku…', async () => {
      const active = await saveForm(); const submitted = { ...form };
      const saved = await service.addNote(active.id, submittedNote, noteKey);
      await acceptSaved(saved, submitted); setNote(current => current === submittedNote ? '' : current); setNoteKey(crypto.randomUUID()); setNotice('Poznámka uložena.');
    });
  }
  async function uploadFiles(items) {
    await run('Nahrávám fotografie…', async () => {
      const active = await saveForm(); let failed = 0;
      for (const task of items) {
        setUploads(current => current.map(item => item.id === task.id ? { ...item, state: 'uploading', error: '' } : item));
        try {
          const file = task.prepared || await prepareInspectionPhoto(task.file);
          setUploads(current => current.map(item => item.id === task.id ? { ...item, prepared: file } : item));
          const saved = await service.upload(active.id, file, { kind: task.kind, area: task.area, description: task.description, attachmentId: task.id });
          await acceptSaved(saved, form);
          setUploads(current => current.map(item => item.id === task.id ? { ...item, state: 'done', error: '', file: null, prepared: null } : item));
        } catch (e) { failed++; setUploads(current => current.map(item => item.id === task.id ? { ...item, state: 'failed', error: e.message } : item)); }
      }
      await refreshDocuments(active.id);
      if (failed) throw new Error(`${failed} fotografií se nepodařilo nahrát. Úspěšné zůstaly uložené; neúspěšné můžeš zopakovat.`);
      setNotice('Fotografie jsou uložené.');
    });
  }
  function queueFiles(files, kind) {
    if (kind === 'damage' && !damageDescription.trim()) { setError('K fotografii poškození nejdřív doplň místo a popis.'); return; }
    const tasks = files.map(file => ({ id: crypto.randomUUID(), name: file.name, file, kind, area: damageArea, description: damageDescription, state: 'waiting' }));
    setUploads(current => [...current, ...tasks]); uploadFiles(tasks);
  }
  async function extract(source) {
    await run(source === 'registry' ? 'Načítám registr…' : 'Čtu technický průkaz…', async () => {
      const active = await saveForm(); const result = await service.extract(active.id, source);
      const values = { ...(result.technicalParams || {}) };
      values.year = text(values.productionYear) || text(values.firstRegistration).match(/(?:19|20)\d{2}/)?.[0] || '';
      const candidates = Object.entries(values).filter(([key,value]) => key in form && text(value) && text(value) !== text(form[key]));
      setExtraction({ candidates, report: result.report || '' }); setSelectedSuggestions(candidates.filter(([key]) => !text(form[key])).map(([key]) => key)); setNotice('Návrh je připravený ke kontrole.');
    });
  }
  function applySuggestions() {
    setForm(current => ({ ...current, ...Object.fromEntries(extraction.candidates.filter(([key]) => selectedSuggestions.includes(key)).map(([key,value]) => [key,text(value)])) }));
    setExtraction(null); setError(''); setNotice('Vybrané údaje převzaty do formuláře.');
  }
  async function estimatePrice(force = false) {
    await run('Porovnávám ceny na trhu…', async () => { const active = await saveForm(); setEstimate(await service.estimate(active.id, force)); setNotice('Návrh ceny je připravený ke kontrole.'); });
  }
  async function finish() {
    if (pendingFiles || note.trim()) { setError('Před dokončením ulož poznámku a vyřeš nenahrané fotografie.'); return; }
    await run('Dokončuji prohlídku…', async () => { const active = await saveForm(); const saved = await service.complete(active.id); await acceptSaved(saved, form); setNotice('Prohlídka dokončena. Vůz je v evidenci a můžeš ho dál upravovat.'); });
  }
  function back() {
    if (pendingFiles) { setError('Před odchodem dokonči nebo odeber nenahrané fotografie.'); return; }
    if (dirty || note.trim()) { setError('Před odchodem ulož změny a poznámku. Rozepsaný formulář je zachovaný.'); return; }
    onBack();
  }

  return <main className="mobileInspection">
    <header className="miHeader"><button type="button" onClick={back} disabled={busy}><ChevronLeft size={20} />Menu</button><div><p>Mobilní výkup · první verze</p><h1>Nacenění u vozu</h1></div><Smartphone size={28} /></header>
    <p className="miLead">Údaje, fotky a ceny na jednom místě. Po prvním uložení už vůz najdeš v běžné evidenci.</p>
    <div className="miStatus" role="status"><span className={dirty ? 'miDot pending' : 'miDot'} />{loading ? 'Načítám…' : busy ? notice : dirty ? 'Rozepsané změny' : car?.id ? 'Údaje uložené v kartě' : 'Nový vůz · zatím nevytvořen'}{car?.id && <strong>Vůz č. {car.id}</strong>}</div>
    {notice && !busy && <p role="status" className="miNotice">{notice}</p>}{error && <div role="alert" className="miError">{error}{duplicate && <button type="button" onClick={() => onOpenVehicle?.(duplicate.id)}>Otevřít existující kartu</button>}</div>}
    {draftWarning && <p className="miError">Prohlížeč nepovolil uložit rozepsaný formulář do telefonu. Před zavřením stránky použij Uložit.</p>}
    <details className="miCard miRecordPicker"><summary>Rozpracované prohlídky a další vozy</summary><button type="button" onClick={newRecord} disabled={busy}>Začít nový výkup</button><label>Otevřít vůz z evidence<select value="" disabled={busy} onChange={e => { if (e.target.value) openRecord(e.target.value); }}><option value="">Vyber vůz…</option>{availableCars.map(item => <option key={item.id} value={item.id}>{item.name} · {item.spz || item.vin || item.id}</option>)}</select></label>{records.map(item => <button className="miRecord" type="button" key={item.id} disabled={busy} onClick={() => openRecord(item.id)}><span><strong>{item.name}</strong><small>{item.spz || item.vin} · {item.technical_params?.mobileInspection?.completedAt ? 'Dokončeno' : 'Rozpracováno'}</small></span>Otevřít →</button>)}</details>
    <section className="miCard" id="mi-identification"><div className="miSectionTitle"><b>1</b><div><h2>Základní údaje</h2><p>Začni značkou, modelem a VIN nebo SPZ.</p></div></div><div className="miFields">{field('brand',{required:true,placeholder:'Renault'})}{field('model',{required:true,placeholder:'Clio'})}{field('spz',{placeholder:'1AB 2345'})}{field('vin',{placeholder:'17 znaků VIN'})}{field('year',{type:'number',placeholder:'2020'})}{field('km',{type:'number',placeholder:'85000'})}</div>{!car?.id && <button className="miPrimary" type="button" disabled={busy || loading} onClick={() => run('Zakládám vůz…', async () => { await saveForm(); setNotice('Vůz je založený v evidenci. Pokračuj fotografiemi a kontrolou.'); })}>Založit vůz a pokračovat</button>}</section>
    <fieldset disabled={busy || !car?.id || loading} className="miCard"><div className="miSectionTitle"><b>2</b><div><h2>Technický průkaz</h2><p>TP se uloží mezi soukromé dokumenty vozu.</p></div></div>{!car?.id && <p>Nejdřív založ vůz v prvním kroku.</p>}<PhotoInput title="TP" kind="tp" disabled={busy || !car?.id} onFiles={queueFiles} /><div className="miThumbs">{documents.map(doc => <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer"><img src={doc.url} alt={doc.title} loading="lazy" /><span>Otevřít TP ↗</span></a>)}</div><button type="button" onClick={() => extract('document')}>Načíst údaje z TP</button></fieldset>
    <fieldset disabled={busy || !car?.id || loading} className="miCard"><div className="miSectionTitle"><b>3</b><div><h2>Fotografie vozu</h2><p>Exteriér, interiér, tachometr a další podklady.</p></div></div><PhotoInput title="vůz" kind="vehicle" disabled={busy || !car?.id} onFiles={queueFiles} /><div className="miThumbs">{(car?.photos || []).map((url,i) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Fotografie vozu ${i+1}`} loading="lazy" /></a>)}</div></fieldset>
    <section className="miCard"><div className="miSectionTitle"><b>4</b><div><h2>Technické parametry</h2><p>Načtené údaje před převzetím zkontroluj.</p></div></div><button type="button" disabled={busy || !car?.id} onClick={() => extract('registry')}>Načíst z registru podle VIN</button><div className="miFields">{technicalFields.map(([key,,placeholder]) => field(key,{placeholder}))}</div>{extraction && <div className="miSuggestion"><h3>Navržené údaje</h3>{!extraction.candidates.length && <p>V uložených údajích není co doplnit.</p>}{extraction.candidates.map(([key,value]) => <label className="miCheck" key={key}><input type="checkbox" checked={selectedSuggestions.includes(key)} onChange={e => setSelectedSuggestions(current => e.target.checked ? [...current,key] : current.filter(k => k !== key))} /><span>{fieldLabels[key]}<strong>{text(value)}</strong><small>Aktuálně: {form[key] || 'nevyplněno'}</small></span></label>)}{extraction.report && <details><summary>Zobrazit zprávu</summary><p className="miPrewrap">{extraction.report}</p></details>}<div className="miActions"><button className="miPrimary" type="button" onClick={applySuggestions} disabled={!selectedSuggestions.length}>Převzít vybrané údaje</button><button type="button" onClick={() => setExtraction(null)}>Zavřít návrh</button></div></div>}</section>
    <fieldset disabled={busy || !car?.id || loading} className="miCard"><div className="miSectionTitle"><b>5</b><div><h2>Poškození</h2><p>Ke snímku přidej místo a popis závady.</p></div></div><label>Místo<select value={damageArea} onChange={e => setDamageArea(e.target.value)}>{damageAreas.map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Popis poškození<textarea value={damageDescription} onChange={e => setDamageDescription(e.target.value)} placeholder="Např. škrábanec na levých zadních dveřích" /></label><PhotoInput title="poškození" kind="damage" disabled={busy || !car?.id} onFiles={queueFiles} />{damageAreas.filter(([key]) => car?.damage_report?.[key]).map(([key,label]) => <p key={key} className="miPrewrap"><strong>{label}:</strong> {car.damage_report[key]}</p>)}</fieldset>
    {uploads.length > 0 && <section className="miCard"><h2>Přenos fotografií</h2>{uploads.map(item => <div className="miUploadRow" key={item.id}><span>{item.name}<small>{item.state === 'done' ? 'Uloženo' : item.state === 'uploading' ? 'Nahrávám…' : item.state === 'failed' ? item.error : 'Čeká na nahrání'}</small></span>{item.state === 'done' ? <Check size={20} /> : <div className="miActions"><button type="button" disabled={busy} onClick={() => uploadFiles([item])}>Zkusit znovu</button><button type="button" disabled={busy} onClick={() => setUploads(current => current.filter(file => file.id !== item.id))}>Odebrat nenahraný soubor</button></div>}</div>)}</section>}
    <section className="miCard"><div className="miSectionTitle"><b>6</b><div><h2>Zákazník a poznámky</h2><p>Poznámky se ukládají do běžné karty vozu.</p></div></div><div className="miFields">{field('customerName')}{field('customerPhone',{type:'tel'})}{field('customerEmail',{type:'email'})}</div><label>Interní poznámka<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Co je důležité vědět o tomto vozu?" /></label><button type="button" disabled={busy || !car?.id || !note.trim()} onClick={saveNote}>Uložit poznámku</button>{(car?.notes || []).map((item,i) => <p key={i} className="miSavedNote">{item}</p>)}</section>
    <section className="miCard"><div className="miSectionTitle"><b>7</b><div><h2>Nacenění</h2><p>Vyplň vlastní ceny nebo si nech připravit porovnání trhu.</p></div></div>{field('preparationCosts',{type:'number'})}<div className="miActions"><button type="button" className="miPrimary" disabled={busy || !car?.id} onClick={() => estimatePrice(false)}>Porovnat s trhem</button>{estimate && <button type="button" disabled={busy} onClick={() => estimatePrice(true)}>Nové porovnání</button>}</div>{estimate && <div className="miSuggestion"><h3>Návrh podle trhu</h3><p>{estimate.cached ? 'Použit poslední shodný výpočet.' : 'Nové porovnání uložené do historie.'}</p><div className="miPriceResult"><div><span>Prodej</span><strong>{money(estimate.output.salePriceLow)} – {money(estimate.output.salePriceHigh)}</strong></div><div><span>Výkup</span><strong>{money(estimate.output.purchasePriceLow)} – {money(estimate.output.purchasePriceHigh)}</strong></div></div><p>{estimate.output.sampleSize} porovnatelných nabídek.</p>{estimate.output.warnings?.map(item => <p key={item}>{item}</p>)}<button type="button" className="miPrimary" onClick={() => { setForm(current => ({ ...current, buyEstimate: text(estimate.output.purchasePriceLow), buyEstimateMax: text(estimate.output.purchasePriceHigh), saleEstimate: text(estimate.output.salePriceLow), saleEstimateMax: text(estimate.output.salePriceHigh) })); setError(''); setNotice('Návrh převzat. Schválenou cenu zvol samostatně.'); }}>Převzít návrh do nacenění</button><details><summary>Porovnávané vozy</summary>{estimate.output.comparables.map((item,i) => <p key={i}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> · {money(item.price)}</p>)}</details></div>}<div className="miFields">{priceFields.map(([key]) => field(key,{type:'number'}))}{field('valuationDate',{type:'date'})}</div><button type="button" disabled={busy || !car?.id} onClick={finish}><Check size={18} />Dokončit prohlídku</button>{car?.id && <button type="button" disabled={busy || dirty || pendingFiles || Boolean(note.trim())} onClick={() => onOpenVehicle?.(car.id)}>Otevřít běžnou kartu vozu →</button>}</section>
    {dirty && <button type="button" disabled={busy} onClick={() => { setForm({ ...baseline }); setError(''); setNotice('Neuložené úpravy formuláře byly vráceny.'); }}>Vrátit neuložené úpravy formuláře</button>}
    <footer className="miSaveBar"><span>{busy ? notice : dirty ? 'Změny čekají na uložení' : car?.id ? 'Uloženo v AutoVýkupu' : 'Vůz zatím není založený'}</span><button type="button" className="miPrimary" disabled={busy || loading} onClick={() => run('Ukládám…', async () => { await saveForm(); setNotice('Údaje uloženy.'); })}><Save size={19} />{busy ? 'Pracuji…' : car?.id ? 'Uložit' : 'Založit vůz'}</button></footer>
  </main>;
}

import { useEffect, useRef, useState } from 'react';
import { Camera, Download, RefreshCw, Sparkles } from 'lucide-react';
import { angles, backgrounds, backgroundOptions, exportName, validatePhoto } from './model';
import { studioRequest } from './api';
import { prepareInspectionPhoto } from '../mobileInspection/preparePhoto';
import { makeZip } from './zip';
import { PlateEditor, PlatePhoto } from './PlatePhoto.jsx';
import { platePhotoBlob } from './plateCanvas.js';
import './photoStudio.css';

function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function PhotoStudio({ carId, carName }) {
  const [items, setItems] = useState([]);
  const [angle, setAngle] = useState('frontLeft');
  const [background, setBackground] = useState('opportunityWhite');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [originals, setOriginals] = useState(false);
  const [editingPlate, setEditingPlate] = useState(null);
  const mounted = useRef(true);
  const running = useRef(false);
  const stop = useRef(false);
  useEffect(() => {
    mounted.current = true;
    studioRequest(carId, 'list').then(data => { if (mounted.current) setItems(data.items); })
      .catch(e => { if (mounted.current) setError(e.message); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; stop.current = true; };
  }, [carId]);
  const merge = item => { if (mounted.current) setItems(current => current.some(p => p.id === item.id) ? current.map(p => p.id === item.id ? item : p) : [...current, item]); };
  async function run(work) {
    if (running.current) return;
    running.current = true; stop.current = false; setBusy(true); setError('');
    try { await work(); } catch (e) { if (mounted.current) setError(e.message); }
    finally { running.current = false; if (mounted.current) { setBusy(false); setProgress(''); } }
  }
  async function refresh() {
    await run(async () => { const data = await studioRequest(carId, 'list'); if (mounted.current) setItems(data.items); });
  }
  async function upload(event) {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (!files.length) return;
    await run(async () => {
      if (files.length + items.length > 40) throw new Error('Pro jeden vůz nahrajte nejvýše 40 fotografií.');
      // Validate the entire selection before uploading anything.
      files.forEach(validatePhoto);
      let failures = 0;
      for (let i = 0; i < files.length && !stop.current; i++) {
        setProgress(`Fotografie ${i + 1} z ${files.length}: nahrávám originál…`);
        const file = await prepareInspectionPhoto(files[i]);
        const { item } = await studioRequest(carId, 'upload', { file, angle, background }); merge(item);
        if (stop.current) break;
        setProgress(`Fotografie ${i + 1} z ${files.length}: AI upravuje snímek…`);
        try { const data = await studioRequest(carId, 'process', { id: item.id }); merge(data.item); }
        catch (e) { failures++; if (mounted.current) setError(`${failures} fotek čeká na úpravu. ${e.message}`); }
      }
    });
  }
  async function process(item) {
    await run(async () => { setProgress('AI upravuje snímek…'); const data = await studioRequest(carId, 'process', { id: item.id }); merge(data.item); });
  }
  async function approve(item) {
    await run(async () => { const data = await studioRequest(carId, 'approve', { id: item.id, approved: String(!item.approved) }); merge(data.item); });
  }
  async function savePlate(item, plates) {
    await run(async () => {
      const data = await studioRequest(carId, 'plate', { id: item.id, plates: JSON.stringify(plates) });
      merge(data.item); if (mounted.current) setEditingPlate(null);
    });
  }
  async function exportPhotos() {
    await run(async () => {
      const selected = items.filter(p => p.ready && p.approved && p.plateVerified);
      if (!selected.length) throw new Error('Nejprve schvalte alespoň jednu upravenou fotografii.');
      const files = [];
      for (let i = 0; i < selected.length; i++) {
        setProgress(`Připravuji export ${i + 1} z ${selected.length}…`);
        const photo = await platePhotoBlob(selected[i].resultUrl, selected[i].plates || []);
        files.push({ name: exportName(i, selected[i].angle), bytes: new Uint8Array(await photo.arrayBuffer()) });
      }
      download(makeZip(files), `vuz-${carId}-inzerce.zip`);
    });
  }
  function move(index, direction) {
    setItems(current => { const next = [...current], target = index + direction; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  const approved = items.filter(p => p.ready && p.approved && p.plateVerified).length;
  return <section className="card decision photoStudio" aria-label="Fotostudio pro inzerci">
    <div className="studioHeader"><div><p className="label">INZERCE · FOTOGRAFIE</p><h2><Camera size={24} /> Fotostudio</h2><p>Jednotné pozadí. Přirozený vzhled. Fotografie připravené pro váš inzerát.</p></div><span className="studioBadge">První verze</span></div>
    <div className="studioSteps"><span>1. Nahrajte fotografie</span><span>2. AI sjednotí vzhled</span><span>3. Zkontrolujte a exportujte</span></div>
    <div className="studioControls">
      <label>Pohled na nahrávaných fotkách<select value={angle} onChange={e => setAngle(e.target.value)} disabled={busy}>{Object.entries(angles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Jednotné pozadí<select value={background} onChange={e => setBackground(e.target.value)} disabled={busy}>{Object.entries(backgrounds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <fieldset className="studioBackgrounds" disabled={busy || loading}>
      <legend>Vyberte vzhled fotografií</legend>
      <div className="studioBackgroundGrid">{Object.entries(backgroundOptions).map(([key, option]) => <label className="studioBackgroundOption" data-selected={background === key} key={key}>
        {option.image ? <img src={option.image} alt={`Pozadí ${option.label}`} loading="lazy" /> : <span className={`studioNeutralPreview studioNeutralPreview-${key}`} aria-hidden="true" />}
        <span className="studioBackgroundCaption"><input type="radio" name={`studio-background-${carId}`} value={key} checked={background === key} onChange={() => setBackground(key)} /><strong>{option.label}</strong><small>{option.description}</small></span>
      </label>)}</div>
    </fieldset>
    <p className="studioHint">Výběr platí pro nově nahrávané fotografie. U exteriéru AI použije zvolené pozadí jako obrazovou předlohu; drobné odchylky v logu a prostoru jsou možné. Interiéry a detaily zůstanou v původním prostředí.</p>
    {backgroundOptions[background].image && <a className="studioBackgroundLink" href={backgroundOptions[background].image} target="_blank" rel="noreferrer">Zobrazit vybrané pozadí v plné velikosti ↗</a>}
    <label className={`studioUpload ${busy || loading ? 'studioDisabled' : ''}`}><Sparkles size={28} /><strong>Nahrát a automaticky upravit</strong><span>JPG, PNG nebo WebP · nejvýše 12 MB na fotku</span><input aria-label="Nahrát fotografie pro inzerci" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || loading} onChange={upload} /></label>
    <p className="studioHint">Nahrajte společně snímky stejného pohledu; pro další pohled změňte výběr. AI srovná kompozici a horizont, zachová původní úhel. Chybějící pohledy dofoťte. Interiér a detaily si ponechají původní prostředí.</p>
    <div className="studioChecklist">{Object.entries(angles).slice(0, 8).map(([key, label]) => <span className={items.some(p => p.angle === key && p.ready) ? 'studioCaptured' : ''} key={key}>{items.some(p => p.angle === key && p.ready) ? '✓' : '○'} {label}</span>)}</div>
    <p className="studioHint">AI úpravy využívají placené API. Před exportem porovnejte vůz s originálem, zejména lak, výbavu a poškození. Fotografie se ukládají jako ostatní fotky vozu; originály se nepřepisují.</p>
    <p className="studioHint">Viditelné SPZ překryjeme originálním logem Opportunity podle jejich rohů a perspektivy. AI navrhne umístění; před schválením potvrďte úplné zakrytí nebo rohy ručně opravte. Stejný překryv se použije v náhledu i exportu.</p>
    <div className="studioToolbar"><button type="button" className="primary outline" disabled={busy || loading} onClick={refresh}><RefreshCw size={16} /> Obnovit seznam</button><label><input type="checkbox" checked={originals} onChange={e => setOriginals(e.target.checked)} /> Ukázat originály</label><button type="button" className="primary" disabled={busy || loading || !approved} onClick={exportPhotos}><Download size={16} /> Export ZIP ({approved})</button></div>
    {(loading || progress) && <p role="status">{loading ? 'Načítám fotografie…' : progress}</p>}
    {busy && <button type="button" className="primary outline" onClick={() => { stop.current = true; }}>Zastavit po aktuální fotografii</button>}
    {error && <p role="alert" className="badText">{error}</p>}
    {!loading && !items.length && <div className="studioEmpty">Fotostudio pro {carName || 'tento vůz'} je připravené. Začněte předním pohledem zleva.</div>}
    <div className="studioGrid">{items.map((item, index) => <article className="studioPhoto" key={item.id}>
      <PlatePhoto item={item} original={originals} label={angles[item.angle]} />
      <div className="studioPhotoBody"><strong>{index + 1}. {angles[item.angle]}</strong><small>{backgrounds[item.background]} · {item.approved ? 'Schváleno' : item.ready ? 'Ke kontrole' : 'Čeká na úpravu'}</small>
        {item.ready && <small>{item.plateVerified ? '✓ Kontrola SPZ potvrzena' : 'SPZ: zkontrolujte úplné zakrytí'}</small>}
        <div className="studioPhotoActions">{item.ready ? <><button type="button" className="primary outline" disabled={busy} onClick={() => setEditingPlate(item.id)}>Zkontrolovat / upravit SPZ</button><button type="button" className={item.approved ? 'success' : 'primary outline'} disabled={busy || !item.plateVerified} onClick={() => approve(item)}>{item.approved ? '✓ Schváleno · vrátit' : 'Schválit pro export'}</button></> : <button type="button" className="primary" disabled={busy} onClick={() => process(item)}>Upravit pomocí AI</button>}<button type="button" aria-label="Posunout dopředu" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Posunout dozadu" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}>↓</button></div>
        {editingPlate === item.id && <PlateEditor key={item.id} item={item} busy={busy} onClose={() => setEditingPlate(null)} onSave={plates => savePlate(item, plates)} />}
      </div></article>)}</div>
    <p className="studioHint">Export: JPG 1536 × 1024 px (3:2), pořadí podle náhledu, soubory očíslované v ZIP. Pořadí platí pro aktuální export; po obnovení se vrátí pořadí nahrání. ZIP rozbalte a fotografie nahrajte na inzertní portál.</p>
  </section>;
}

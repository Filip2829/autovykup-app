import { useEffect, useRef, useState } from 'react';
import { Camera, Download, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { angles, backgrounds, backgroundOptions, canExportPhoto, needsPlateUpdate, exportName, validatePhoto } from './model';
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
export default function PhotoStudio({ carId, carName, initialBackground = 'opportunityWhite' }) {
  const [items, setItems] = useState([]);
  const [angle, setAngle] = useState('frontLeft');
  const [background, setBackground] = useState(initialBackground);
  const [reduceReflections, setReduceReflections] = useState(false);
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
    mounted.current = true; let active = true, ownsWork = false;
    studioRequest(carId, 'list').then(async data => {
      if (!active) return;
      setItems(data.items); setLoading(false);
      const outdated = data.items.filter(needsPlateUpdate);
      if (!outdated.length || running.current) return;
      ownsWork = true; running.current = true; setBusy(true);
      for (let i = 0; i < outdated.length && active; i++) {
        const photo = outdated[i]; setProgress(`Zaměřuji SPZ u starších fotografií: ${i + 1} z ${outdated.length}…`);
        try {
          // Preserve explicitly corrected geometry; automatically re-detect old AI estimates.
          const updated = photo.plateStatus === 'verified'
            ? await studioRequest(carId, 'plate', { id: photo.id, plates: JSON.stringify(photo.plates || []) })
            : await studioRequest(carId, 'autoPlate', { id: photo.id });
          if (active) setItems(current => current.map(item => item.id === photo.id ? updated.item : item));
        } catch (e) { if (active) setError(e.message); }
      }
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (ownsWork) running.current = false; if (active) { setLoading(false); if (ownsWork) { setBusy(false); setProgress(''); } } });
    return () => { active = false; mounted.current = false; stop.current = true; };
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
        const { item } = await studioRequest(carId, 'upload', { file, angle, background, reflectionReduction: reduceReflections ? 'gentle' : 'off' }); merge(item);
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
  async function deletePhoto(item) {
    if (running.current || !window.confirm('Smazat tuto fotku z fotostudia včetně jejího nahraného originálu a upravených verzí? Ostatní fotografie vozu zůstanou zachované.')) return;
    await run(async () => {
      const data = await studioRequest(carId, 'delete', { id: item.id });
      if (data.deletedId !== item.id) throw new Error('Smazání fotografie nebylo potvrzeno. Obnovte seznam.');
      if (mounted.current) { setItems(current => current.filter(photo => photo.id !== item.id)); setEditingPlate(current => current === item.id ? null : current); }
    });
  }
  async function autoPlate(item) {
    await run(async () => {
      setProgress('Rozpoznávám a zakrývám SPZ…');
      const data = await studioRequest(carId, 'autoPlate', { id: item.id }); merge(data.item);
    });
  }
  async function savePlate(item, plates) {
    await run(async () => {
      const data = await studioRequest(carId, 'plate', { id: item.id, plates: JSON.stringify(plates) });
      merge(data.item); if (mounted.current) setEditingPlate(null);
    });
  }
  async function exportPhotos() {
    await run(async () => {
      const selected = items.filter(canExportPhoto);
      if (!selected.length) throw new Error('Nejprve schvalte alespoň jednu upravenou fotografii.');
      const files = [];
      for (let i = 0; i < selected.length; i++) {
        setProgress(`Připravuji export ${i + 1} z ${selected.length}…`);
        let photo;
        if (selected[i].plateRendered) {
          const response = await fetch(selected[i].resultUrl);
          if (!response.ok) throw new Error('Stažení fotografie selhalo. Zkuste export znovu.');
          photo = await response.blob();
        } else photo = await platePhotoBlob(selected[i].resultUrl, selected[i].plates || []);
        files.push({ name: exportName(i, selected[i].angle), bytes: new Uint8Array(await photo.arrayBuffer()) });
      }
      const standalone = String(carId).startsWith('session:');
      const name = String(carName || 'fotografie').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'fotografie';
      download(makeZip(files), standalone ? `${name}-inzerce.zip` : `vuz-${carId}-inzerce.zip`);
    });
  }
  function move(index, direction) {
    setItems(current => { const next = [...current], target = index + direction; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  const approved = items.filter(canExportPhoto).length;
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
    <div className="studioReflectionControl">
      <label><input type="checkbox" checked={reduceReflections && angle !== 'interior' && angle !== 'detail'} onChange={e => setReduceReflections(e.target.checked)} disabled={busy || loading || angle === 'interior' || angle === 'detail'} /> Jemná redukce odrazů okolí</label>
      <p className="studioHint">Pro venkovní fotografie exteriéru: šetrné omezení odrazů stromů, budov a oblohy při zachování přirozeného lesku. Před exportem ověřte odstín laku, detaily a vady porovnáním s originálem. U interiéru a detailů se redukce nepoužije.</p>
    </div>
    <label className={`studioUpload ${busy || loading ? 'studioDisabled' : ''}`}><Sparkles size={28} /><strong>Nahrát a automaticky upravit</strong><span>JPG, PNG nebo WebP · nejvýše 12 MB na fotku</span><input aria-label="Nahrát fotografie pro inzerci" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || loading} onChange={upload} /></label>
    <p className="studioHint">Nahrajte společně snímky stejného pohledu; pro další pohled změňte výběr. AI srovná kompozici a horizont, zachová původní úhel. Chybějící pohledy dofoťte. Interiér a detaily si ponechají původní prostředí.</p>
    <div className="studioChecklist">{Object.entries(angles).slice(0, 8).map(([key, label]) => <span className={items.some(p => p.angle === key && p.ready) ? 'studioCaptured' : ''} key={key}>{items.some(p => p.angle === key && p.ready) ? '✓' : '○'} {label}</span>)}</div>
    <p className="studioHint">AI úpravy využívají placené API. Před exportem porovnejte vůz s originálem, zejména lak, výbavu a poškození. Fotografie se ukládají jako ostatní fotky vozu; originály se nepřepisují.</p>
    <p className="studioHint">SPZ se rozpoznají a automaticky překryjí logem Opportunity už při generování. Zakrytí je součástí uloženého JPG. Před exportem zkontrolujte výsledek; pokud se rozpoznání nepodaří, zopakujte jej nebo ručně označte rohy SPZ.</p>
    <div className="studioToolbar"><button type="button" className="primary outline" disabled={busy || loading} onClick={refresh}><RefreshCw size={16} /> Obnovit seznam</button><label><input type="checkbox" checked={originals} onChange={e => setOriginals(e.target.checked)} /> Ukázat originály</label><button type="button" className="primary" disabled={busy || loading || !approved} onClick={exportPhotos}><Download size={16} /> Export ZIP ({approved})</button></div>
    {(loading || progress) && <p role="status">{loading ? 'Načítám fotografie…' : progress}</p>}
    {busy && progress.startsWith('Fotografie') && <button type="button" className="primary outline" onClick={() => { stop.current = true; }}>Zastavit po aktuální fotografii</button>}
    {error && <p role="alert" className="badText">{error}</p>}
    {!loading && !items.length && <div className="studioEmpty">Fotostudio pro {carName || 'tento vůz'} je připravené. Začněte předním pohledem zleva.</div>}
    <div className="studioGrid">{items.map((item, index) => <article className="studioPhoto" key={item.id}>
      <PlatePhoto item={item} original={originals} label={angles[item.angle]} />
      <div className="studioPhotoBody"><strong>{index + 1}. {angles[item.angle]}</strong><small>{backgrounds[item.background]} · {item.approved ? 'Schváleno' : item.ready ? 'Ke kontrole' : 'Čeká na úpravu'}</small>
        {item.reflectionReduction === 'gentle' && <small>Jemná redukce odrazů okolí</small>}
        {item.ready && <small>{item.plateVerified ? (item.plateStatus === 'automatic' ? '✓ SPZ automaticky zakryta' : item.plateStatus === 'not-visible' ? '✓ SPZ není na snímku viditelná' : '✓ Zakrytí SPZ připraveno') : 'SPZ se nepodařilo spolehlivě rozpoznat. Zopakujte zakrytí nebo označte rohy ručně.'}</small>}
        <div className="studioPhotoActions">{item.ready ? <><button type="button" className="primary outline" disabled={busy} onClick={() => autoPlate(item)}>Znovu zaměřit SPZ automaticky</button><button type="button" className="primary outline" disabled={busy} onClick={() => setEditingPlate(item.id)}>Upravit zakrytí SPZ</button><button type="button" className={item.approved ? 'success' : 'primary outline'} disabled={busy || !item.plateVerified || needsPlateUpdate(item)} onClick={() => approve(item)}>{item.approved ? '✓ Schváleno · vrátit' : 'Schválit pro export'}</button></> : <button type="button" className="primary" disabled={busy} onClick={() => process(item)}>Upravit pomocí AI</button>}<button type="button" aria-label="Posunout dopředu" disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Posunout dozadu" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="studioDeletePhoto" disabled={busy} onClick={() => deletePhoto(item)}><Trash2 size={16} /> Smazat fotku</button></div>
        {editingPlate === item.id && <PlateEditor key={item.id} item={item} busy={busy} onClose={() => setEditingPlate(null)} onSave={plates => savePlate(item, plates)} />}
      </div></article>)}</div>
    <p className="studioHint">Export: JPG 1536 × 1024 px (3:2), pořadí podle náhledu, soubory očíslované v ZIP. Pořadí platí pro aktuální export; po obnovení se vrátí pořadí nahrání. ZIP rozbalte a fotografie nahrajte na inzertní portál.</p>
  </section>;
}

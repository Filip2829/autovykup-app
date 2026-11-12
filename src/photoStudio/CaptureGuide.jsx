import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { angles } from './model.js';

export function VehicleOutline({ angle, body = 'car' }) {
  const side = angle === 'left' || angle === 'right';
  const straight = angle === 'front' || angle === 'rear';
  const rear = angle.startsWith('rear');
  const mirror = angle === 'frontRight' || angle === 'rearLeft' || angle === 'right';
  const roof = body === 'van' ? 155 : body === 'suv' ? 200 : 250;
  return <svg className="studioVehicleOutline" viewBox="0 0 1000 650" role="img" aria-label={`Obrys vozu: ${angles[angle]}`}>
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" transform={mirror ? 'translate(1000 0) scale(-1 1)' : undefined}>
      {side ? <>
        <path d={`M95 455 L105 365 L225 340 L320 ${roof} Q350 ${roof - 15} 410 ${roof - 15} L650 ${roof - 15} Q690 ${roof} 715 ${roof + 60} L790 335 L880 365 L900 455 L850 480 L810 480 M690 480 L320 480 M200 480 L120 480 Z`} />
        <path d={`M265 335 L345 ${roof + 20} L640 ${roof + 20} L735 335 Z M490 ${roof + 20} L490 450 M265 350 L265 400 M735 350 L735 410 M510 365 L545 365`} />
        <circle cx="260" cy="465" r="60" /><circle cx="750" cy="465" r="60" /><circle cx="260" cy="465" r="27" /><circle cx="750" cy="465" r="27" />
      </> : straight ? <>
        <path d={`M245 440 L240 360 L285 300 L330 ${roof} Q500 ${roof - 30} 670 ${roof} L715 300 L760 360 L755 440 L730 475 L270 475 Z`} />
        <path d={`M300 300 L350 ${roof + 25} Q500 ${roof + 5} 650 ${roof + 25} L700 300 Z M295 475 L295 510 L250 510 L245 445 M705 475 L705 510 L750 510 L755 445 M280 315 L220 310 L220 340 L250 345 M720 315 L780 310 L780 340 L750 345`} />
        {rear ? <path d="M270 340 L300 340 L300 405 L270 405 Z M700 340 L730 340 L730 405 L700 405 Z M350 440 L650 440 M440 415 L560 415 L560 445 L440 445 Z" /> : <path d="M275 350 L395 365 L390 390 L270 380 Z M725 350 L605 365 L610 390 L730 380 Z M415 375 L585 375 L570 420 L430 420 Z M345 450 L655 450" />}
      </> : <>
        <path d={`M115 420 L130 340 L280 300 L390 ${roof} Q470 ${roof - 30} 540 ${roof - 20} L740 ${roof + 10} L840 315 L875 430 L835 490 L740 510 L340 535 L160 495 Z`} />
        <path d={`M300 305 L410 ${roof + 20} L530 ${roof + 10} L610 310 Z M550 ${roof + 15} L735 ${roof + 40} L800 320 L640 320 Z M625 330 L640 470 M805 340 L815 440 M340 430 L740 405 M155 425 L320 455 L335 505`} />
        <ellipse cx="370" cy="485" rx="48" ry="65" /><ellipse cx="790" cy="445" rx="35" ry="55" />
        {rear ? <path d="M145 355 L180 365 L175 425 L140 415 M285 375 L325 380 L325 440 L285 430 M195 445 L270 460 L270 485 L195 470" /> : <path d="M145 350 L235 370 L230 400 L140 380 Z M270 380 L310 375 L320 405 L270 410 Z M165 415 L275 440 L270 475 L165 450 Z" />}
      </>}
    </g>
    <path d="M75 535 H925" stroke="currentColor" opacity=".5" strokeWidth="2" strokeDasharray="12 14" />
    <path d="M70 210 V155 H125 M875 155 H930 V210 M70 485 V540 H125 M875 540 H930 V485" fill="none" stroke="currentColor" strokeWidth="3" opacity=".6" />
  </svg>;
}

export default function CaptureGuide({ angle, onAngleChange, disabled, onCapture }) {
  const [open, setOpen] = useState(false), [body, setBody] = useState('car');
  const [camera, setCamera] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null), [saving, setSaving] = useState(false);
  const video = useRef(null), stream = useRef(null), nativeInput = useRef(null), objectUrl = useRef(null);
  const exterior = !['interior', 'detail'].includes(angle);
  useEffect(() => {
    if (!open || !camera) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active && !video.current?.videoWidth) { setError('Kamera neposkytla obraz. Zkuste ji zapnout znovu nebo použijte fotoaparát telefonu.'); setCamera(false); }
    }, 30000);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera vyžaduje HTTPS a podporovaný prohlížeč.');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1280 } }, audio: false });
        if (!active) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media; video.current.srcObject = media; await video.current.play();
        if (active && video.current?.videoWidth) setReady(true);
      } catch (e) { if (active) { setError(e.name === 'NotAllowedError' ? 'Povolte kameru v prohlížeči, nebo použijte fotoaparát telefonu níže.' : e.message); setCamera(false); } }
    })();
    return () => { active = false; clearTimeout(timeout); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setReady(false); };
  }, [open, camera]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  function clearSnapshot() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null; setSnapshot(null);
  }
  function showSnapshot(file) { clearSnapshot(); objectUrl.current = URL.createObjectURL(file); setSnapshot({ file, url: objectUrl.current, angle }); setCamera(false); }
  async function capture() {
    try {
      const canvas = document.createElement('canvas');
      const vw = video.current.videoWidth, vh = video.current.videoHeight;
      const width = Math.min(vw, vh * 1.5), height = width / 1.5;
      canvas.width = Math.round(width); canvas.height = Math.round(height);
      canvas.getContext('2d').drawImage(video.current, (vw - width) / 2, (vh - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
      if (!blob) throw new Error('Snímek se nepodařilo pořídit.');
      showSnapshot(new File([blob], `${angle}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    } catch (e) { setError(e.message); }
  }
  async function useSnapshot() {
    setSaving(true);
    try { if (await onCapture(snapshot.file, snapshot.angle)) { clearSnapshot(); setOpen(false); } }
    finally { setSaving(false); }
  }
  return <section className="studioCaptureGuide" aria-label="Průvodce focením">
    <div className="studioGuideHeading"><div><strong>Vyfoťte vůz ve správném úhlu</strong><p>Obrys přes živý obraz pomůže sjednotit velikost a výšku záběru.</p></div><button type="button" className="primary outline" disabled={disabled} onClick={() => { setOpen(!open); setCamera(false); clearSnapshot(); }}><Camera size={18} /> {open ? 'Skrýt průvodce' : 'Focení s obrysem'}</button></div>
    {open && <>
      <div className="studioControls"><label>Pohled pro focení<select value={angle} disabled={saving || disabled || !!snapshot} onChange={e => onAngleChange(e.target.value)}>{Object.entries(angles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Karoserie pro vodítko<select value={body} onChange={e => setBody(e.target.value)}><option value="car">Osobní vůz</option><option value="suv">SUV / crossover</option><option value="van">Dodávka / MPV</option></select></label></div>
      <div className="studioCameraViewport">
        {snapshot ? <img src={snapshot.url} alt="Pořízená fotografie ke kontrole" /> : <><video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} onLoadedData={() => setReady(true)} />{exterior ? <VehicleOutline angle={angle} body={body} /> : <div className="studioInteriorFrame">{angle === 'interior' ? 'Celý záběr interiéru · telefon držte rovně' : 'Zaostřete detail · zachovejte viditelné poškození'}</div>}<span className="studioCameraLabel">{angles[angle]} · {camera ? (ready ? 'Srovnejte vůz s obrysem' : 'Připravuji kameru…') : 'Náhled vodítka'}</span></>}
      </div>
      <p className="studioHint">{exterior ? 'Telefon držte vodorovně přibližně ve výšce světlometů (0,9–1,2 m), bez náklonu dolů. Použijte 1× objektiv, odstupte asi 4–6 m a nechte kolem celého vozu rezervu. U 45° pohledu mají být vidět čelo i celý bok; boční pohled foťte kolmo. Kola srovnejte rovně. Nejlépe funguje rovná plocha a měkké světlo bez přímého slunce.' : 'Interiér foťte za měkkého denního světla, bez blesku. Před focením vyjměte osobní věci a vůz fyzicky vyčistěte. Detaily poškození foťte samostatně.'} Obrys je orientační vodítko; správný úhel se neověřuje automaticky. Do výsledné fotografie se neukládá.</p>
      {error && <p role="alert" className="badText">{error}</p>}
      <div className="studioToolbar">{snapshot ? <><button type="button" className="primary" disabled={saving || disabled} onClick={useSnapshot}>{saving ? 'Zpracovávám…' : 'Použít a upravit fotografii'}</button><button type="button" disabled={saving} onClick={() => { clearSnapshot(); setCamera(true); }}>Vyfotit znovu</button></> : <><button type="button" className="primary" onClick={() => { setError(''); camera ? capture() : setCamera(true); }} disabled={disabled || (camera && !ready)}><Camera size={18} /> {camera ? 'Vyfotit' : 'Zapnout kameru s obrysem'}</button><button type="button" className="primary outline" disabled={disabled} onClick={() => nativeInput.current.click()}>Fotoaparát telefonu / vybrat snímek</button><input ref={nativeInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) showSnapshot(file); }} /></>}
        <button type="button" disabled={saving} onClick={() => { setCamera(false); clearSnapshot(); setOpen(false); }}><X size={16} /> Zavřít focení</button>
      </div>
    </>}
  </section>;
}

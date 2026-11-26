import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { angles } from './model.js';
import { isInteriorShot, nextOpportunityShot, opportunityShots } from './captureStandard.js';
import { drawCaptureFrame } from './prepareSubject.js';

export function VehicleOutline({ angle, body = 'car' }) {
  const side = angle === 'left' || angle === 'right';
  const straight = angle === 'front' || angle === 'rear';
  const rear = angle.startsWith('rear');
  const mirror = angle === 'frontRight' || angle === 'rearLeft' || angle === 'right';
  const roof = body === 'van' ? 155 : body === 'suv' ? 200 : 250;
  return <svg className="studioVehicleOutline" viewBox="0 0 1000 750" role="img" aria-label={`Obrys vozu: ${angles[angle]}`}>
    <g transform="translate(0 92)">
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
    <path d={`M75 ${side ? 525 : straight ? 510 : 550} H925 M500 135 V550`} stroke="currentColor" opacity=".5" strokeWidth="2" strokeDasharray="12 14" />
    <path d="M70 210 V155 H125 M875 155 H930 V210 M70 485 V540 H125 M875 540 H930 V485" fill="none" stroke="currentColor" strokeWidth="3" opacity=".6" />
    </g>
  </svg>;
}

const interiorOutlines = {
  dashboard: 'M105 350 Q500 260 895 350 M105 405 Q500 335 895 405 M460 405 L540 405 L635 660 H365 Z M425 310 H575 V400 H425 Z M340 445 A90 90 0 1 0 160 445 A90 90 0 1 0 340 445',
  frontSeats: 'M320 340 L314 270 Q324 240 380 238 Q430 240 438 276 L440 335 M315 335 Q370 300 440 335 L490 495 L420 550 H270 L235 505 Z M565 285 L552 175 Q560 135 645 132 Q730 132 747 180 L749 278 M560 280 Q645 240 755 280 L834 530 L785 646 H542 L495 560 Z',
  rearSeats: 'M175 340 V230 Q175 209 210 203 H305 Q335 209 335 237 V320 M395 318 V244 Q395 225 425 220 H500 Q529 225 529 249 V310 M590 315 V213 Q596 182 634 181 H725 Q756 181 762 219 V321 M163 340 Q505 279 790 324 L870 497 L780 580 H128 L105 515 Z M128 510 L862 497 M364 319 L335 507 M580 315 L596 502',
  console: 'M390 205 H610 L758 650 H242 Z M405 296 H595 L630 465 H370 Z M475 335 H525 V427 H475 Z M325 555 H675',
};

function InteriorOutline({ angle }) {
  return <svg className="studioVehicleOutline" viewBox="0 0 1000 750" role="img" aria-label={`Vodítko: ${angles[angle]}`}>
    <path d="M85 235 V170 H150 M850 170 H915 V235 M85 585 V650 H150 M850 650 H915 V585 M100 375 H900" fill="none" stroke="currentColor" strokeWidth="3" opacity=".55" strokeDasharray="14 14" />
    <path d={interiorOutlines[angle]} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" opacity=".85" />
  </svg>;
}

export default function CaptureGuide({ items, disabled, onCapture }) {
  const [angle, setAngle] = useState('frontLeft');
  const [open, setOpen] = useState(false), [body, setBody] = useState('car');
  const [camera, setCamera] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null), [saving, setSaving] = useState(false);
  const video = useRef(null), stream = useRef(null), nativeInput = useRef(null), objectUrl = useRef(null);
  const currentAngle = snapshot?.angle ?? angle;
  const exterior = !isInteriorShot(currentAngle);
  const completed = new Set(items.filter(item => item.opportunityCapture).map(item => item.angle));
  const shots = Object.keys(opportunityShots);
  useEffect(() => {
    if (!open || !camera) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active && !video.current?.videoWidth) { setError('Kamera neposkytla obraz. Zkuste ji zapnout znovu nebo použijte fotoaparát telefonu.'); setCamera(false); }
    }, 30000);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera vyžaduje HTTPS a podporovaný prohlížeč.');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false });
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
  function showSnapshot(file, shot = currentAngle) {
    clearSnapshot();
    objectUrl.current = URL.createObjectURL(file);
    setSnapshot({ file, url: objectUrl.current, angle: shot });
    setCamera(false);
  }
  async function capture() {
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      const vw = video.current.videoWidth, vh = video.current.videoHeight;
      drawCaptureFrame(canvas, video.current, vw, vh, false);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
      if (!blob) throw new Error('Snímek se nepodařilo pořídit.');
      showSnapshot(new File([blob], `${currentAngle}-${Date.now()}.jpg`, { type: 'image/jpeg' }), currentAngle);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  async function useSnapshot() {
    setError('');
    setSaving(true);
    try {
      if (await onCapture(snapshot.file, snapshot.angle, setError)) {
        const next = nextOpportunityShot(snapshot.angle, [...items, { angle: snapshot.angle, opportunityCapture: true }]);
        clearSnapshot();
        if (next) setAngle(next);
      }
    }
    finally { setSaving(false); }
  }
  return <section className="studioCaptureGuide" aria-label="Průvodce focením">
    <div className="studioGuideHeading"><div><strong>Focení podle standardu Opportunity</strong><p>8 pohledů na vůz a 4 záběry interiéru v poměru 4:3.</p></div><button type="button" className="primary outline" disabled={disabled || saving} onClick={() => { if (!open) setAngle(nextOpportunityShot('', items) ?? 'frontLeft'); setOpen(!open); setCamera(false); clearSnapshot(); setError(''); }}><Camera size={18} /> {open ? 'Skrýt průvodce' : 'Focení s obrysem'}</button></div>
    {open && <>
      <div className="studioControls"><label>Pohled pro focení · {completed.size}/{shots.length} uloženo<select value={currentAngle} disabled={saving || disabled || !!snapshot} onChange={e => setAngle(e.target.value)}>{shots.map(key => <option key={key} value={key}>{completed.has(key) ? '✓ ' : ''}{opportunityShots[key].title}</option>)}</select></label>{exterior && <label>Karoserie pro vodítko<select value={body} disabled={saving || !!snapshot} onChange={e => setBody(e.target.value)}><option value="car">Osobní vůz</option><option value="suv">SUV / crossover</option><option value="van">Dodávka / MPV</option></select></label>}</div>
      <div className="studioCameraViewport">
        {snapshot ? <img src={snapshot.url} alt="Výřez fotografie ke kontrole" /> : <video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} onLoadedData={() => setReady(true)} />}
        {exterior ? <VehicleOutline angle={currentAngle} body={body} /> : <InteriorOutline angle={currentAngle} />}
        <span className="studioCameraLabel">{opportunityShots[currentAngle].title} · {snapshot ? 'Zkontrolujte výřez' : camera && !ready ? 'Připravuji kameru…' : 'Srovnejte záběr s vodítkem'}</span>
      </div>
      <p className="studioHint">{opportunityShots[currentAngle].guide} {exterior ? 'Použijte 1× objektiv a rovnou plochu. Telefon držte na šířku přibližně 1,1 m nad zemí a začněte asi 5 m od středu vozu. Kola nechte rovně.' : 'Použijte 1× objektiv a měkké světlo bez blesku.'}</p>
      {error && <p role="alert" className="badText">{error}</p>}
      <div className="studioToolbar">{snapshot ? <><button type="button" className="primary" disabled={saving || disabled} onClick={useSnapshot}>{saving ? 'Kontroluji a upravuji…' : 'Zkontrolovat a vložit do Atelieru'}</button><button type="button" disabled={saving} onClick={() => { setError(''); clearSnapshot(); setCamera(true); }}>Vyfotit znovu</button><button type="button" disabled={saving} onClick={() => { setError(''); clearSnapshot(); }}>Vybrat jinou fotografii</button></> : <><button type="button" className="primary" onClick={() => { setError(''); camera ? capture() : setCamera(true); }} disabled={saving || disabled || (camera && !ready)}><Camera size={18} /> {camera ? 'Vyfotit' : 'Zapnout kameru s obrysem'}</button><button type="button" className="primary outline" disabled={saving || disabled} onClick={() => nativeInput.current.click()}>Fotoaparát telefonu / vybrat snímek</button><input ref={nativeInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) showSnapshot(file); }} /></>}
        <button type="button" disabled={saving} onClick={() => { setCamera(false); clearSnapshot(); setOpen(false); }}><X size={16} /> Zavřít focení</button>
      </div>
    </>}
  </section>;
}

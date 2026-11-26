import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { angles } from './model.js';
import { isInteriorShot, nextOpportunityShot, opportunityShots } from './captureStandard.js';
import { drawCaptureFrame } from './prepareSubject.js';

// Original line drawings based on the CUPRA Formentor facelift's silhouette.
const formentorViews = {
  frontLeft: {
    shape: 'M133 509 Q127 470 148 418 L193 392 303 366 383 291 Q429 256 531 250 L663 251 Q724 253 768 284 L805 328 844 357 Q867 390 867 455 L856 503 829 521 M760 535 L513 578 M393 593 L283 604 194 583 Q151 562 133 509Z',
    landmarks: 'M323 367 L407 292 Q453 270 536 266 L623 266 584 357 Z M612 353 L647 266 Q721 271 759 295 L794 337 Z M700 280 L704 340 M603 367 L592 543 M711 354 L704 518 M162 425 L251 418 213 443 164 445 Z M274 414 L372 383 345 421 280 434 Z M171 467 L332 461 308 557 190 538 Z M177 486 L319 483 M580 361 L615 350 651 353 649 373 612 382 577 378',
    wheels: [[454,543,61,80], [798,473,37,62]],
  },
  front: {
    shape: 'M243 534 L241 429 266 385 279 342 302 318 321 320 349 258 Q374 224 416 218 Q500 211 584 218 Q626 223 651 258 L679 320 698 318 721 342 734 385 759 429 757 534 Q748 572 722 583 L683 585 670 618 H612 L605 588 H395 L388 618 H330 L317 585 278 583 Q252 572 243 534Z',
    landmarks: 'M333 338 L366 258 Q384 238 423 233 H577 Q616 238 634 258 L667 338 Q500 326 333 338Z M270 393 L378 410 345 440 268 427 Z M730 393 L622 410 655 440 732 427 Z M285 488 L417 474 500 484 583 474 715 488 682 552 Q500 571 318 552Z M390 428 L456 443 H544 L610 428 M268 456 L316 461 303 483 M732 456 L684 461 697 483',
  },
  rear: {
    shape: 'M246 531 L244 418 266 373 279 342 303 326 327 329 348 270 361 239 397 221 Q500 211 603 221 L639 239 652 270 673 329 697 326 721 342 734 373 756 418 754 531 732 581 682 589 672 618 H615 L609 591 H391 L385 618 H328 L318 589 268 581 Z',
    landmarks: 'M337 332 L365 267 388 243 Q500 230 612 243 L635 267 663 332 Q500 346 337 332Z M352 240 Q500 218 648 240 M253 404 L357 410 Q500 420 643 410 L747 404 M254 425 L346 440 Q500 440 654 440 L746 425 M405 461 H595 L583 504 H417Z M265 540 Q500 573 735 540 M271 555 L314 560 M729 555 L686 560',
  },
  rearLeft: {
    shape: 'M132 441 Q132 411 157 387 L204 371 271 327 Q319 295 365 275 Q410 256 488 251 L625 252 Q699 255 749 283 L811 312 842 344 860 394 Q873 460 867 497 L850 550 808 577 752 586 M628 589 L326 548 M250 532 L171 512 Q140 487 132 441Z',
    landmarks: 'M300 335 L375 289 Q419 269 488 267 H556 L542 342 426 354 320 352 Z M573 267 H618 Q692 271 733 293 L799 323 747 356 578 346Z M431 281 L426 354 M591 259 L654 259 Q728 269 791 304 M575 377 Q665 391 750 380 L852 359 M706 399 L847 382 M728 443 L830 421 822 478 728 492Z M674 530 Q779 544 853 508 M321 365 L316 505 M426 368 L423 536',
    wheels: [[286,491,39,58], [693,543,65,80]],
  },
  left: {
    shape: 'M90 507 L95 453 Q104 418 133 399 L229 373 304 355 383 294 Q424 276 505 275 H634 Q686 275 722 291 L780 321 834 342 875 358 900 398 910 438 909 500 887 537 815 545 M693 545 H334 M210 545 H144 Q110 541 90 507Z',
    landmarks: 'M326 355 L401 306 Q435 290 509 290 H625 Q675 290 712 306 L767 332 696 353 Z M499 295 L483 353 M646 294 L645 352 M482 365 L477 514 M642 364 L638 518 M129 407 L226 385 200 414 115 440 M818 354 L874 370 879 395 827 382 M343 366 L371 354 401 358 396 375 358 381 335 374 M335 523 H687',
    wheels: [[273,541,64,72], [750,541,64,72]],
  },
};

const mirroredFormentor = { frontRight: 'frontLeft', rearRight: 'rearLeft', right: 'left' };

export function VehicleOutline({ angle }) {
  const reflected = mirroredFormentor[angle];
  const { shape, landmarks, wheels = [] } = formentorViews[reflected ?? angle];
  return <svg className="studioVehicleOutline" viewBox="0 0 1000 750" role="img" aria-label={`CUPRA Formentor · ${angles[angle]}`}>
    <path d="M72 622 H928 M500 195 V632" fill="none" stroke="currentColor" strokeWidth="2" opacity=".55" strokeDasharray="12 12" />
    <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" transform={reflected ? 'translate(1000 0) scale(-1 1)' : undefined}>
      <path d={shape} />
      <path d={landmarks} strokeWidth="3" opacity=".78" />
      {wheels.map(([x, y, rx, ry]) => <g key={x}>
        <ellipse cx={x} cy={y} rx={rx} ry={ry} />
        <ellipse cx={x} cy={y} rx={rx * .48} ry={ry * .56} strokeWidth="2.5" opacity=".7" />
        <path d={`M${x - 13} ${y}h26 m-13 -13v26`} strokeWidth="2" />
      </g>)}
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
  const [open, setOpen] = useState(false);
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
  function toggleGuide() {
    if (!open) setAngle(nextOpportunityShot('', items) ?? 'frontLeft');
    setCamera(!open);
    setOpen(!open);
    clearSnapshot();
    setError('');
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
    <div className="studioGuideHeading">
      <strong>{open ? 'Průvodce focením' : 'Vyfoťte vůz podle obrysu'}</strong>
      <button type="button" className={open ? 'primary outline' : 'primary'} disabled={disabled || saving} onClick={toggleGuide}>{open ? <X size={18} /> : <Camera size={18} />} {open ? 'Zavřít' : 'Focení s obrysem'}</button>
    </div>
    {open && <>
      <label className="studioGuideShot">Pohled · {completed.size}/{shots.length} uloženo<select value={currentAngle} disabled={saving || disabled || !!snapshot} onChange={e => setAngle(e.target.value)}>{shots.map(key => <option key={key} value={key}>{completed.has(key) ? '✓ ' : ''}{opportunityShots[key].title}</option>)}</select></label>
      <p className="studioCaptureInstruction">{opportunityShots[currentAngle].guide}</p>
      <div className="studioCameraViewport">
        {snapshot ? <img src={snapshot.url} alt="Výřez fotografie ke kontrole" /> : <video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} onLoadedData={() => setReady(true)} />}
        {exterior ? <VehicleOutline angle={currentAngle} /> : <InteriorOutline angle={currentAngle} />}
        {(snapshot || camera && !ready) && <span className="studioCameraLabel">{snapshot ? 'Zkontrolujte výřez' : 'Připravuji kameru…'}</span>}
      </div>
      {exterior && !snapshot && <p className="studioHint">Telefon na šířku · 1× · výška asi 1,1 m · začněte asi 5 m od středu vozu. Menší vůz v náhledu → blíž. Větší → dál.</p>}
      {error && <p role="alert" className="badText">{error}</p>}
      <div className="studioToolbar">{snapshot ? <><button type="button" className="primary" disabled={saving || disabled} onClick={useSnapshot}>{saving ? 'Kontroluji a upravuji…' : 'Použít snímek'}</button><button type="button" disabled={saving} onClick={() => { setError(''); clearSnapshot(); setCamera(true); }}>Vyfotit znovu</button></> : <><button type="button" className="primary" onClick={() => { setError(''); camera ? capture() : setCamera(true); }} disabled={saving || disabled || (camera && !ready)}><Camera size={18} /> {camera ? 'Vyfotit' : 'Zapnout kameru'}</button>{!camera && <button type="button" className="primary outline" disabled={saving || disabled} onClick={() => nativeInput.current.click()}>Vybrat snímek</button>}<input ref={nativeInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) showSnapshot(file); }} /></>}</div>
    </>}
  </section>;
}

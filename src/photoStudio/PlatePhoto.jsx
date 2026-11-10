import { useEffect, useRef, useState } from 'react';
import { drawPlatePhoto, platePhotoBlob } from './plateCanvas.js';
import { validatePlates } from './plates.js';

export function PlatePhoto({ item, original, label }) {
  const [preview, setPreview] = useState({ key: '', url: '', error: '' });
  const key = JSON.stringify([item.resultUrl, item.plates]);
  useEffect(() => {
    if (original || !item.ready || item.plateRendered) return;
    let active = true, objectUrl;
    platePhotoBlob(item.resultUrl, item.plates || []).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setPreview({ key, url: objectUrl, error: '' }); else URL.revokeObjectURL(objectUrl);
    }).catch(error => { if (active) setPreview({ key, url: '', error: error.message }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.resultUrl, item.plates, item.ready, item.plateRendered, original, key]);
  if (original || !item.ready) return <a href={item.originalUrl} target="_blank" rel="noreferrer"><img src={item.originalUrl} alt={`Originál: ${label}`} loading="lazy" /></a>;
  if (item.plateRendered) return <a href={item.resultUrl} target="_blank" rel="noreferrer"><img src={item.resultUrl} alt={`AI úprava se zakrytím SPZ: ${label}`} loading="lazy" /></a>;
  if (preview.key !== key || !preview.url) return <div className="studioPlatePending" role="status">{preview.key === key && preview.error ? preview.error : 'Připravuji náhled…'}</div>;
  return <a href={preview.url} target="_blank" rel="noreferrer"><img src={preview.url} alt={`AI úprava: ${label}`} loading="lazy" /></a>;
}

export function PlateEditor({ item, onSave, onClose, busy }) {
  const [plates, setPlates] = useState(item.plates || []);
  const [points, setPoints] = useState([]);
  const [noPlate, setNoPlate] = useState(false);
  const [error, setError] = useState('');
  const [drawing, setDrawing] = useState(true);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef(null);
  const sourceUrl = item.baseUrl || item.resultUrl;
  useEffect(() => {
    let active = true;
    const rendered = document.createElement('canvas');
    drawPlatePhoto(rendered, sourceUrl, plates).then(() => {
      if (!active) return;
      canvas.current.width = rendered.width; canvas.current.height = rendered.height;
      const context = canvas.current.getContext('2d');
      context.drawImage(rendered, 0, 0);
      context.fillStyle = '#fb923c'; context.strokeStyle = '#fb923c'; context.lineWidth = 3;
      points.forEach((p, i) => {
        const x = p.x * canvas.current.width, y = p.y * canvas.current.height;
        context.beginPath(); context.arc(x, y, 6, 0, Math.PI * 2); context.fill();
        if (i) { context.beginPath(); context.moveTo(points[i - 1].x * canvas.current.width, points[i - 1].y * canvas.current.height); context.lineTo(x, y); context.stroke(); }
      });
      setDrawing(false);
    }).catch(e => { if (active) { setError(e.message); setDrawing(false); } });
    return () => { active = false; };
  }, [sourceUrl, plates, points]);
  function selectCorner(event) {
    if (busy || drawing || noPlate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
    const next = [...points, point]; setError('');
    if (next.length === 4) {
      try { validatePlates([next]); setPlates(current => [...current, next]); setPoints([]); }
      catch (e) { setError(e.message); setPoints([]); }
    } else setPoints(next);
  }
  return <div className="studioPlateEditor">
    <h3>Zakrytí SPZ logem Opportunity</h3>
    <p>Zkontrolujte celý překryv včetně modrého pruhu a všech znaků. Pro přesné označení klikněte na čtyři vnější rohy SPZ: levý horní → pravý horní → pravý dolní → levý dolní.</p>
    <label>Zvětšení pro přesné označení <select value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
    <div className="studioPlateViewport"><canvas style={{ width: `${zoom * 100}%` }} ref={canvas} onClick={selectCorner} aria-label="Fotografie pro označení rohů SPZ" /></div>
    <p role="status">{points.length ? `Označeno ${points.length} ze 4 rohů.` : `Překryté značky: ${plates.length}.`}</p>
    <div className="studioPhotoActions"><button type="button" disabled={busy} onClick={() => { setPlates([]); setPoints([]); setNoPlate(false); setError(''); }}>Označit SPZ znovu</button><button type="button" disabled={busy || !points.length} onClick={() => setPoints([])}>Zrušit rozpracované rohy</button></div>
    <label className="studioNoPlate"><input type="checkbox" checked={noPlate} disabled={busy} onChange={e => { setNoPlate(e.target.checked); setPoints([]); if (e.target.checked) setPlates([]); }} /> Na fotografii není viditelná žádná SPZ</label>
    {error && <p role="alert" className="badText">{error}</p>}
    <div className="studioPhotoActions"><button type="button" className="primary" disabled={busy || drawing || !!error || !!points.length || (!plates.length && !noPlate)} onClick={() => onSave(noPlate ? [] : plates)}>Uložit a potvrdit kontrolu SPZ</button><button type="button" className="primary outline" disabled={busy} onClick={onClose}>Zavřít</button></div>
  </div>;
}

import { useEffect, useState } from 'react';
import { Camera, Plus, FolderOpen } from 'lucide-react';
import PhotoStudio from './PhotoStudio.jsx';
import { studioRequest } from './api.js';
import './photoStudio.css';

export function PhotoStudioMenuCard({ onOpen }) {
  return <div className="module"><Camera /><h3>Fotostudio</h3><p>Fotky pro inzerci nových i ojetých vozů · bez založení výkupu</p><button type="button" onClick={onOpen}>Otevřít</button></div>;
}

export default function StandalonePhotoStudio({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    studioRequest('session:', 'sessions').then(data => { if (active) setSessions(data.sessions); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function createSession(event) {
    event.preventDefault(); if (saving || !label.trim()) return;
    setSaving(true); setError('');
    try {
      const { session } = await studioRequest('session:', 'createSession', { label: label.trim() });
      setSessions(current => [session, ...current]); setSelected(session); setLabel('');
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function deleteSession(session) {
    if (saving || !window.confirm(`Smazat prázdnou sadu „${session.label}“? Sadu s fotografiemi je nutné nejprve vyprázdnit.`)) return;
    setSaving(true); setError('');
    try {
      const data = await studioRequest(`session:${session.id}`, 'deleteSession');
      if (data.deletedSessionId !== session.id) throw new Error('Smazání sady nebylo potvrzeno.');
      setSessions(current => current.filter(item => item.id !== session.id));
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  if (selected) return <section>
    <button type="button" className="back bigBack" onClick={() => setSelected(null)}>← Zpět na moje sady fotografií</button>
    <div className="studioStandaloneHeading"><h2>{selected.label}</h2><p>Samostatná sada fotografií · bez vazby na evidenci výkupů</p></div>
    <PhotoStudio key={selected.id} carId={`session:${selected.id}`} carName={selected.label} />
  </section>;
  return <section>
    <button type="button" className="back bigBack" onClick={onBack}>← Zpět na rozcestník</button>
    <div className="card decision">
      <div className="studioHeader"><div><p className="label">NOVÉ I OJETÉ VOZY</p><h2><Camera size={24} /> Samostatné Fotostudio</h2><p>Nahrajte fotografie do Opportunity Showroom a exportujte připravenou inzerci. Karta výkupu není potřeba.</p></div></div>
      <form className="studioSessionForm" onSubmit={createSession}>
        <label htmlFor="studio-session-label">Nová sada fotografií<input id="studio-session-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={100} placeholder="Např. Renault Austral · VIN / interní číslo" required disabled={saving || loading} /></label>
        <button type="submit" className="primary" disabled={saving || loading || !label.trim()}><Plus size={18} /> {saving ? 'Ukládám…' : 'Vytvořit sadu'}</button>
      </form>
      {error && <p className="badText" role="alert">{error}</p>}
      {loading ? <p role="status">Načítám vaše sady…</p> : <>
        <h3>Moje sady fotografií <span className="studioBadge">{sessions.length}</span></h3>
        {!sessions.length && <p>Zatím nemáte žádnou sadu. Vytvořte první a nahrajte fotografie vozu.</p>}
        <div className="studioSessionGrid">{sessions.map(session => <article className="studioSessionCard" key={session.id}>
          <FolderOpen size={24} /><h3>{session.label}</h3><p>{new Date(session.createdAt).toLocaleDateString('cs-CZ')}</p>
          <button type="button" className="primary" disabled={saving} onClick={() => setSelected(session)}>Otevřít fotografie</button>
          <button type="button" className="studioDeletePhoto" disabled={saving} onClick={() => deleteSession(session)}>Smazat prázdnou sadu</button>
        </article>)}</div>
      </>}
    </div>
  </section>;
}

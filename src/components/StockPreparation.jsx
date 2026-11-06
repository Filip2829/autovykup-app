import { useRef, useState } from "react";
import { getStockPreparation, preparationSteps } from "../utils/stockPreparation";
import "./StockPreparation.css";

function PreparationRow({ car, onSave, onOpen, hidden }) {
  const preparation = getStockPreparation(car);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  async function save(key, value, previousValue = preparation[key]) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await onSave(car.id, key, value, previousValue);
      if (key === "note") setDraft(null);
      setMessage("Uloženo");
    } catch (saveError) {
      setError(saveError.message || "Změnu se nepodařilo uložit. Zkus to znovu.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <tr hidden={hidden} className={preparation.advertised ? "preparationDone" : ""}>
      <th scope="row" data-label="Vůz">
        <button type="button" className="back preparationCar" onClick={() => onOpen(car)} disabled={saving || draft !== null}>
          {car.name || "Vůz bez názvu"}
        </button>
        <small>{car.spz || "Bez SPZ"} · {car.year || "Rok neuveden"}</small>
        <small>VIN: {car.vin || "—"}</small>
        <span className={`preparationBadge ${preparation.advertised ? "done" : preparation.ready ? "urgent" : ""}`}>
          {preparation.advertised ? "Zainzerováno" : preparation.ready ? "Čeká na zainzerování" : "V přípravě"}
        </span>
      </th>
      {preparationSteps.map((step) => (
        <td key={step.key} data-label={step.label}>
          <input
            type="checkbox"
            aria-label={`${car.name}, ${car.spz || car.vin}: ${step.label}`}
            checked={preparation[step.key]}
            disabled={saving}
            onChange={(event) => save(step.key, event.target.checked)}
          />
        </td>
      ))}
      <td data-label="Na co se čeká" className="preparationNote">
        <textarea
          aria-label={`Poznámka k přípravě: ${car.name}, ${car.spz || car.vin}`}
          placeholder="Např. čekáme na díl, čištění v pátek…"
          value={draft?.value ?? preparation.note}
          disabled={saving}
          onChange={(event) => setDraft({ value: event.target.value, original: draft?.original ?? preparation.note })}
        />
        {draft !== null && (
          <div className="preparationNoteActions">
            <button type="button" className="primary" disabled={saving} onClick={() => save("note", draft.value, draft.original)}>Uložit poznámku</button>
            <button type="button" className="back" disabled={saving} onClick={() => setDraft(null)}>Zrušit</button>
          </div>
        )}
        <small role="status">{saving ? "Ukládám…" : draft !== null ? "Neuložená poznámka" : message}</small>
        {error && <p role="alert" className="preparationError">{error}</p>}
        <small>Upravil: {car.updated_by || "—"}</small>
      </td>
    </tr>
  );
}

export default function StockPreparation({ cars, onSave, onOpen, onBack, onRefresh }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const pending = cars.filter((car) => !getStockPreparation(car).advertised);
  const ready = pending.filter((car) => getStockPreparation(car).ready);
  // Keep rows mounted while filtering so an unfinished note is never discarded.
  const sortedCars = [...cars].sort((a, b) => {
    const priority = (car) => {
      const prep = getStockPreparation(car);
      return prep.advertised ? 2 : prep.ready ? 0 : 1;
    };
    return priority(a) - priority(b);
  });
  function matches(car) {
    const prep = getStockPreparation(car);
    return (filter === "all" || (filter === "pending" && !prep.advertised) || (filter === "ready" && prep.ready && !prep.advertised))
      && `${car.name || ""} ${car.spz || ""} ${car.vin || ""}`.toLocaleLowerCase("cs-CZ").includes(query.trim().toLocaleLowerCase("cs-CZ"));
  }
  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      if (!(await onRefresh())) setError("Přehled se nepodařilo obnovit. Zkus to znovu.");
    } catch {
      setError("Přehled se nepodařilo obnovit. Zkus to znovu.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="stockPreparation">
      <button type="button" className="back bigBack" onClick={onBack}>← Zpět na rozcestník</button>
      <div className="card decision">
        <div className="preparationHeading">
          <div><h2>Chystání vozů na bazar</h2><p>Od přípravy až po zveřejnění inzerátu. Fajfky se ukládají ihned, poznámku ulož tlačítkem.</p></div>
          <button type="button" className="primary outline" disabled={refreshing} onClick={refresh}>{refreshing ? "Obnovuji…" : "Obnovit přehled"}</button>
        </div>
        <div className="preparationCounts">
          <span><strong>{cars.length}</strong> vozů skladem</span>
          <span><strong>{pending.length}</strong> nezainzerovaných</span>
          <span className="preparationAttention"><strong>{ready.length}</strong> čeká na zainzerování</span>
        </div>
        <div className="preparationToolbar">
          <input type="search" aria-label="Hledat v přípravě vozů" placeholder="Hledat název, SPZ nebo VIN" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div role="group" aria-label="Filtr přípravy">
            {[["pending", "Nezainzerované"], ["ready", "Čeká na inzerci"], ["all", "Všechny skladové"]].map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? "primary" : "primary outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
        </div>
        <p className="preparationHint">Pro změny od kolegy použij „Obnovit přehled“. Rozpracované poznámky zůstanou zachované.</p>
        {error && <p role="alert" className="preparationError">{error}</p>}
        <div className="preparationTableWrap">
          <table className="preparationTable">
            <caption className="preparationHint">Příprava skladových vozů</caption>
            <thead><tr><th scope="col">Vůz</th>{preparationSteps.map((step) => <th key={step.key} scope="col">{step.label}</th>)}<th scope="col">Poznámka / na co se čeká</th></tr></thead>
            <tbody>
              {sortedCars.map((car) => <PreparationRow key={car.id} car={car} onSave={onSave} onOpen={onOpen} hidden={!matches(car)} />)}
            </tbody>
          </table>
        </div>
        {!cars.some(matches) && <p>{cars.length ? "Tomuto filtru neodpovídá žádný vůz." : "Zatím nejsou žádné vozy skladem. Vykoupené vozy se zde objeví automaticky."}</p>}
      </div>
    </section>
  );
}

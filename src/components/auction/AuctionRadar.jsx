import { useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Ban, Check, ExternalLink, Eye, Filter, MapPin, Plus, Radar, Search, Trash2, X } from "lucide-react";
import {
  AUCTION_DATA_STATUS,
  AUCTION_DECISION,
  auctionRadarCriteria,
  buildVerifiedAuctionVehicle,
  demoAuctionVehicles,
  emptyAuctionVehicleForm,
  filterAuctionVehicles,
} from "../../auctionRadar/auctionRadarData.js";
import "./auctionRadar.css";

const STORAGE_KEY = "autovykup.auction-radar.decisions.v1";
const VEHICLES_STORAGE_KEY = "autovykup.auction-radar.vehicles.v1";
const decisionOptions = [
  { value: AUCTION_DECISION.SUITABLE, label: "Vhodné k výkupu", icon: Check },
  { value: AUCTION_DECISION.WATCHLIST, label: "Sledovat", icon: Eye },
  { value: AUCTION_DECISION.REJECTED, label: "Nevhodné", icon: Ban },
];

function readDecisions() {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function readCustomVehicles() {
  try {
    const value = JSON.parse(window.localStorage.getItem(VEHICLES_STORAGE_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const formatPrice = (value) => new Intl.NumberFormat("cs-CZ", {
  style: "currency", currency: "CZK", maximumFractionDigits: 0,
}).format(value);
const formatNumber = (value) => new Intl.NumberFormat("cs-CZ").format(value);

export default function AuctionRadar({ onBack }) {
  const [decisions, setDecisions] = useState(readDecisions);
  const [customVehicles, setCustomVehicles] = useState(readCustomVehicles);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyAuctionVehicleForm });
  const [formErrors, setFormErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState("");
  const [filters, setFilters] = useState({
    query: "", brand: "all", decision: "all", maxPriceCzk: auctionRadarCriteria.maxPriceCzk,
  });
  const allVehicles = useMemo(() => [...customVehicles, ...demoAuctionVehicles], [customVehicles]);
  const visibleVehicles = useMemo(
    () => filterAuctionVehicles(allVehicles, { ...filters, decisions }),
    [allVehicles, filters, decisions],
  );

  function setDecision(vehicleId, decision) {
    const next = { ...decisions, [vehicleId]: decision };
    setDecisions(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage("");
  }

  function saveVehicle(event) {
    event.preventDefault();
    const { vehicle, errors } = buildVerifiedAuctionVehicle(form);
    setFormErrors(errors);
    if (!vehicle) return;

    const next = [vehicle, ...customVehicles];
    setCustomVehicles(next);
    window.localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(next));
    setForm({ ...emptyAuctionVehicleForm });
    setIsFormOpen(false);
    setSaveMessage(`${vehicle.brand} ${vehicle.model} byl uložen jako ručně ověřený záznam.`);
  }

  function removeVehicle(vehicle) {
    if (!window.confirm(`Odstranit z radaru ${vehicle.brand} ${vehicle.model}?`)) return;
    const nextVehicles = customVehicles.filter((item) => item.id !== vehicle.id);
    const nextDecisions = { ...decisions };
    delete nextDecisions[vehicle.id];
    setCustomVehicles(nextVehicles);
    setDecisions(nextDecisions);
    window.localStorage.setItem(VEHICLES_STORAGE_KEY, JSON.stringify(nextVehicles));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDecisions));
  }

  return (
    <section className="auctionRadarPage">
      <button className="back bigBack" type="button" onClick={onBack}>
        <ArrowLeft size={18} /> Zpět na rozcestník
      </button>

      <div className="auctionRadarHero">
        <div className="auctionRadarHeroIcon"><Radar /></div>
        <div>
          <p className="label">Nový modul</p>
          <h2>Aukční radar</h2>
          <p>Předvýběr vozů Renault a Dacia fyzicky v ČR do 500 000 Kč. Finální rozhodnutí zůstává vždy na vás.</p>
        </div>
        <div className="auctionRadarMode"><span>Ručně ověřené nabídky</span><strong>{customVehicles.length} záznamů</strong></div>
      </div>

      <div className="auctionRadarNotice" role="status">
        <BadgeCheck size={21} />
        <div>
          <strong>Ukázkové a ověřené nabídky jsou vždy jasně oddělené.</strong>
          <p>Skutečný záznam lze uložit jen s odkazem na původní aukci a potvrzením ruční kontroly. Ukázkové karty zůstávají označené jako neověřené.</p>
        </div>
      </div>

      <div className="auctionRadarActions">
        <div>
          <strong>Vlastní ověřené nabídky</strong>
          <p>Údaje se v této první verzi ukládají pouze do tohoto prohlížeče.</p>
        </div>
        <button className="primary" type="button" onClick={() => setIsFormOpen((value) => !value)}>
          {isFormOpen ? <X size={18} /> : <Plus size={18} />}
          {isFormOpen ? "Zavřít formulář" : "Přidat nabídku"}
        </button>
      </div>

      {saveMessage && <div className="auctionSaveMessage" role="status"><Check size={18} /> {saveMessage}</div>}

      {isFormOpen && (
        <form className="auctionVehicleForm" onSubmit={saveVehicle} noValidate>
          <div className="auctionFormHeader">
            <div><p className="label">Ruční vložení</p><h3>Nová ověřená nabídka</h3></div>
            <span>Povinné údaje jsou označené *</span>
          </div>
          <div className="auctionFormGrid">
            <label>Značka *
              <select value={form.brand} onChange={(event) => updateForm("brand", event.target.value)}>
                <option value="Renault">Renault</option><option value="Dacia">Dacia</option>
              </select>
            </label>
            <label>Model *
              <input value={form.model} onChange={(event) => updateForm("model", event.target.value)} placeholder="např. Captur" />
              {formErrors.model && <small>{formErrors.model}</small>}
            </label>
            <label>Verze / motorizace
              <input value={form.trim} onChange={(event) => updateForm("trim", event.target.value)} placeholder="např. TCe 90" />
            </label>
            <label>Rok výroby *
              <input type="number" value={form.year} onChange={(event) => updateForm("year", event.target.value)} placeholder="2021" />
              {formErrors.year && <small>{formErrors.year}</small>}
            </label>
            <label>Nájezd km *
              <input type="number" min="0" value={form.mileageKm} onChange={(event) => updateForm("mileageKm", event.target.value)} placeholder="68500" />
              {formErrors.mileageKm && <small>{formErrors.mileageKm}</small>}
            </label>
            <label>Cena v Kč *
              <input type="number" min="1" max="500000" value={form.priceCzk} onChange={(event) => updateForm("priceCzk", event.target.value)} placeholder="319000" />
              {formErrors.priceCzk && <small>{formErrors.priceCzk}</small>}
            </label>
            <label>Palivo
              <select value={form.fuel} onChange={(event) => updateForm("fuel", event.target.value)}>
                <option>Benzín</option><option>Nafta</option><option>Benzín / LPG</option><option>Hybrid</option><option>Elektro</option>
              </select>
            </label>
            <label>Převodovka
              <select value={form.transmission} onChange={(event) => updateForm("transmission", event.target.value)}>
                <option>Manuální</option><option>Automatická</option>
              </select>
            </label>
            <label>Město v ČR *
              <input value={form.locationCity} onChange={(event) => updateForm("locationCity", event.target.value)} placeholder="např. Praha" />
              {formErrors.locationCity && <small>{formErrors.locationCity}</small>}
            </label>
            <label>Název zdroje *
              <input value={form.sourceName} onChange={(event) => updateForm("sourceName", event.target.value)} placeholder="např. aukční portál" />
              {formErrors.sourceName && <small>{formErrors.sourceName}</small>}
            </label>
            <label className="auctionFormWide">Odkaz na původní aukci *
              <input type="url" value={form.originalAuctionUrl} onChange={(event) => updateForm("originalAuctionUrl", event.target.value)} placeholder="https://…" />
              {formErrors.originalAuctionUrl && <small>{formErrors.originalAuctionUrl}</small>}
            </label>
            <label className="auctionFormWide">Stručné ověřené informace *
              <textarea value={form.summary} onChange={(event) => updateForm("summary", event.target.value)} placeholder="Co bylo ověřeno přímo v aukční nabídce?" />
              {formErrors.summary && <small>{formErrors.summary}</small>}
            </label>
            <label>Klady (jeden na řádek)
              <textarea value={form.positives} onChange={(event) => updateForm("positives", event.target.value)} placeholder="Doložená servisní historie" />
            </label>
            <label>Rizika (jedno na řádek)
              <textarea value={form.negatives} onChange={(event) => updateForm("negatives", event.target.value)} placeholder="Nutná kontrola podvozku" />
            </label>
          </div>
          <label className="auctionVerificationCheck">
            <input type="checkbox" checked={form.verificationConfirmed} onChange={(event) => updateForm("verificationConfirmed", event.target.checked)} />
            <span>Potvrzuji, že jsem údaje ručně zkontroloval(a) proti původní aukční nabídce. *</span>
          </label>
          {formErrors.verificationConfirmed && <p className="auctionFormError">{formErrors.verificationConfirmed}</p>}
          <div className="auctionFormActions">
            <button className="back" type="button" onClick={() => { setIsFormOpen(false); setFormErrors({}); }}>Zrušit</button>
            <button className="primary" type="submit"><Check size={18} /> Uložit ověřenou nabídku</button>
          </div>
        </form>
      )}

      <div className="auctionRadarFilters">
        <div className="auctionRadarFilterTitle"><Filter size={18} /> Přednastavená kritéria</div>
        <div className="auctionRadarChips"><span>Renault + Dacia</span><span>Česká republika</span><span>Max. 500 000 Kč</span></div>
        <label className="auctionRadarSearch">
          <Search size={18} />
          <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Hledat model, lokalitu nebo zdroj" />
        </label>
        <div className="auctionRadarSelects">
          <label>Značka
            <select value={filters.brand} onChange={(event) => setFilters({ ...filters, brand: event.target.value })}>
              <option value="all">Renault i Dacia</option><option value="Renault">Renault</option><option value="Dacia">Dacia</option>
            </select>
          </label>
          <label>Rozhodnutí
            <select value={filters.decision} onChange={(event) => setFilters({ ...filters, decision: event.target.value })}>
              <option value="all">Všechna rozhodnutí</option>
              <option value={AUCTION_DECISION.UNDECIDED}>Nerozhodnuto</option>
              <option value={AUCTION_DECISION.SUITABLE}>Vhodné k výkupu</option>
              <option value={AUCTION_DECISION.WATCHLIST}>Sledovat</option>
              <option value={AUCTION_DECISION.REJECTED}>Nevhodné</option>
            </select>
          </label>
        </div>
      </div>

      <div className="auctionRadarResultsTop">
        <div><strong>{visibleVehicles.length}</strong> kandidáti v aktuálním výběru</div>
        <span>Automatické přihazování je vypnuto</span>
      </div>

      <div className="auctionVehicleGrid">
        {visibleVehicles.map((vehicle) => {
          const decision = decisions[vehicle.id] || AUCTION_DECISION.UNDECIDED;
          const isVerified = vehicle.dataStatus === AUCTION_DATA_STATUS.VERIFIED;
          return (
            <article className="auctionVehicleCard" key={vehicle.id}>
              <header>
                <div>
                  <span className={`auctionDataBadge ${isVerified ? "isVerified" : "isDemo"}`}>{isVerified ? "Ověřená data" : "UKÁZKA · neověřeno"}</span>
                  <h3>{vehicle.brand} {vehicle.model}</h3><p>{vehicle.trim}</p>
                </div>
                <strong className="auctionPrice">{formatPrice(vehicle.priceCzk)}</strong>
              </header>
              <div className="auctionFacts">
                <span><small>Rok</small>{vehicle.year}</span><span><small>Nájezd</small>{formatNumber(vehicle.mileageKm)} km</span>
                <span><small>Palivo</small>{vehicle.fuel}</span><span><small>Převodovka</small>{vehicle.transmission}</span>
              </div>
              <p className="auctionLocation"><MapPin size={16} /> {vehicle.location}</p>
              <p className="auctionSummary">{vehicle.summary}</p>
              <div className="auctionProsCons">
                <div><strong>Klady</strong><ul>{vehicle.positives.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><strong>Rizika / chybí ověřit</strong><ul>{vehicle.negatives.map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
              <div className="auctionSource">
                <div><small>Zdroj</small><strong>{vehicle.sourceName}</strong></div>
                {vehicle.originalAuctionUrl ? (
                  <a href={vehicle.originalAuctionUrl} target="_blank" rel="noreferrer">Původní aukce <ExternalLink size={15} /></a>
                ) : <span className="auctionLinkUnavailable">Odkaz bude dostupný u ověřeného záznamu</span>}
              </div>
              <div className="auctionDecision">
                <span>Moje rozhodnutí</span>
                <div>{decisionOptions.map(({ value, label, icon: Icon }) => (
                  <button type="button" className={decision === value ? `isActive decision-${value}` : ""} key={value}
                    onClick={() => setDecision(vehicle.id, decision === value ? AUCTION_DECISION.UNDECIDED : value)}>
                    <Icon size={16} /> {label}
                  </button>
                ))}</div>
                {vehicle.createdManually && (
                  <button className="auctionDeleteButton" type="button" onClick={() => removeVehicle(vehicle)}>
                    <Trash2 size={15} /> Odstranit vlastní záznam
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {visibleVehicles.length === 0 && <div className="auctionRadarEmpty">Tomuto filtru neodpovídá žádný kandidát.</div>}
    </section>
  );
}

import { companyProfile } from "../../config/companyProfile.js";
import "./OpportunityClassic.css";

const fallbackText = "Neuvedeno";

function DetailRow({ label, value }) {
  return (
    <div className="oc-detail-row">
      <span>{label}</span>
      <strong>{value || fallbackText}</strong>
    </div>
  );
}

function StatItem({ icon, label, value }) {
  return (
    <div className="oc-stat-item">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value || fallbackText}</strong>
      </div>
    </div>
  );
}

function ChipList({ items, emptyText = fallbackText }) {
  if (!items || items.length === 0) {
    return <p className="oc-empty">{emptyText}</p>;
  }

  return (
    <div className="oc-chip-list">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export default function OpportunityClassic({ vehicle, cardRef }) {
  const { salesperson } = companyProfile;

  return (
    <article className="opportunityClassicCard" ref={cardRef}>
      <header className="oc-brand-header">
        <div>
          <div className="oc-mark">{companyProfile.company}</div>
          <p>{vehicle.contact.claim}</p>
        </div>
        <div className="oc-contact-block">
          <span>Prodejce</span>
          <strong>{salesperson.name}</strong>
          <span>Telefon: {salesperson.phone}</span>
          <span>E-mail: {salesperson.email}</span>
          <span>Web: {companyProfile.website}</span>
        </div>
      </header>

      <section className="oc-hero">
        <div>
          <p className="oc-eyebrow">Nabídka vozu</p>
          <h1>{vehicle.title}</h1>
          <p className="oc-version">{vehicle.subtitle}</p>
        </div>
        <div className="oc-price-badge">
          <span>Cena</span>
          <strong>{vehicle.price}</strong>
        </div>
      </section>

      <section className="oc-stats">
        <StatItem icon="R" label="Rok výroby" value={vehicle.specs.year} />
        <StatItem icon="KM" label="Nájezd" value={vehicle.specs.mileage} />
        <StatItem icon="F" label="Palivo" value={vehicle.specs.fuel} />
        <StatItem icon="P" label="Převodovka" value={vehicle.specs.transmission} />
        <StatItem icon="kW" label="Výkon" value={vehicle.specs.power} />
      </section>

      <main className="oc-main-grid">
        <div className="oc-photo-column">
          <div className="oc-photo-block">
            {vehicle.heroImage ? (
              <img src={vehicle.heroImage} alt="Hlavní fotografie vozu" />
            ) : (
              <div className="oc-photo-fallback">Fotografie neuvedena</div>
            )}
          </div>

          <section className="oc-block oc-highlights">
            <h3>Hlavní přednosti vozu</h3>
            <ChipList items={vehicle.highlights} />
          </section>
        </div>

        <aside className="oc-side-column">
          <section className="oc-block">
            <h3>Základní informace</h3>
            <DetailRow label="VIN" value={vehicle.vin} />
            <DetailRow label="Barva" value={vehicle.technical.color} />
            <DetailRow label="Karoserie" value={vehicle.technical.bodyType} />
            <DetailRow label="STK" value={vehicle.technical.stk} />
            <DetailRow label="Původ" value={vehicle.specs.origin} />
            <DetailRow label="První majitel" value={vehicle.specs.firstOwner} />
            <DetailRow label="Servisní historie" value={vehicle.specs.serviceHistory} />
            <DetailRow label="Záruka" value={vehicle.specs.warranty} />
          </section>

          <section className="oc-block">
            <h3>Technické parametry</h3>
            <DetailRow label="Objem motoru" value={vehicle.technical.engine} />
            <DetailRow label="Výkon" value={vehicle.technical.power} />
            <DetailRow label="Pohon" value={vehicle.technical.drive} />
            <DetailRow label="Spotřeba" value={vehicle.technical.consumption} />
            <DetailRow label="Emise" value={vehicle.technical.emissions} />
          </section>
        </aside>
      </main>

      <section className="oc-bottom-grid">
        <div className="oc-block">
          <h3>Výbava</h3>
          <ChipList items={vehicle.equipment} />
        </div>

        <div className="oc-block">
          <h3>Prodejní argumenty / garance</h3>
          <ChipList items={vehicle.guarantees} />
        </div>
      </section>

      {vehicle.condition !== fallbackText && (
        <section className="oc-condition-note">
          <strong>Poznámka ke stavu vozu:</strong> {vehicle.condition}
        </section>
      )}

      <footer className="oc-footer">
        <div>
          <strong>{companyProfile.company}</strong>
          <span>Transparentní prodej prověřených vozů</span>
        </div>
        <div>
          <span>Více informací u prodejce</span>
          <strong>{salesperson.name} · {salesperson.phone}</strong>
          <span>{salesperson.email} · {companyProfile.website}</span>
        </div>
      </footer>
    </article>
  );
}

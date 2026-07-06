import { companyProfile } from "../../config/companyProfile.js";
import "./OpportunityClassic.css";

const fallbackText = "Neuvedeno";

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isVisibleValue(value) {
  return hasValue(value) && value !== fallbackText;
}

function displayValue(value) {
  return isVisibleValue(value) ? value : fallbackText;
}

function getShortItems(items = [], limit) {
  return items
    .filter(isVisibleValue)
    .map((item) => String(item).trim())
    .filter((item) => item.length <= 58)
    .slice(0, limit);
}

function hasLetter(value) {
  return /[a-zA-ZÀ-ž]/.test(String(value || ""));
}

function formatPriceAmount(amount) {
  const normalizedAmount = String(amount || "").trim();
  const digits = normalizedAmount.replace(/\D/g, "");

  if (digits.length >= 4 && !hasLetter(normalizedAmount)) {
    return new Intl.NumberFormat("cs-CZ").format(Number(digits));
  }

  return normalizedAmount || fallbackText;
}

function getPriceParts(price) {
  const normalizedPrice = String(price || "").trim();
  const match = normalizedPrice.match(/^(.+?)\s*(Kč)?$/i);

  return {
    amount: formatPriceAmount(match?.[1] || normalizedPrice),
    suffix: match?.[2] || (normalizedPrice ? "Kč" : ""),
  };
}

function addUnique(items, value) {
  if (!isVisibleValue(value)) return items;
  return items.includes(value) ? items : [...items, value];
}

function MetricItem({ label, value }) {
  return (
    <div className="ocMetric">
      <div>
        <small>{label}</small>
        <strong>{displayValue(value)}</strong>
      </div>
    </div>
  );
}

function DataTable({ rows, large = false, showEmpty = true, limit = null }) {
  const visibleRows = rows
    .filter((row) => isVisibleValue(row.value))
    .slice(0, limit || rows.length);

  if (visibleRows.length === 0) {
    return showEmpty ? <p className="ocEmpty">Neuvedeno</p> : null;
  }

  return (
    <div className={large ? "ocDataTable ocDataTableLarge" : "ocDataTable"}>
      {visibleRows.map((row) => (
        <div key={row.label} className="ocDataRow">
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items, limit = 10, check = false }) {
  const visibleItems = getShortItems(items, limit);

  if (visibleItems.length === 0) {
    return <p className="ocEmpty">Neuvedeno</p>;
  }

  return (
    <ul className={check ? "ocCheckList" : "ocBulletList"}>
      {visibleItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h2 className="ocSectionTitle">
      <span>{icon}</span>
      {children}
    </h2>
  );
}

export default function OpportunityClassic({ vehicle, cardRef }) {
  const { salesperson } = companyProfile;
  const price = getPriceParts(vehicle.price);
  const whyBuyItems = [
    "Pravidelný servis",
    "Známé vady uvedeny transparentně",
    "CEBIA / ověřená historie",
    ...getShortItems(vehicle.guarantees, 5),
    "Autorizovaný prodej ojetých vozů",
    "Možnost financování a pojištění",
  ].reduce(addUnique, []).slice(0, 5);

  const basicRows = [
    { label: "Počet dveří / míst", value: vehicle.technical.doors },
    { label: "Rok výroby", value: vehicle.specs.year },
    { label: "Najeto", value: vehicle.specs.mileage },
    { label: "Palivo", value: vehicle.specs.fuel },
    { label: "Převodovka", value: vehicle.specs.transmission },
    { label: "Výkon", value: vehicle.specs.power || vehicle.technical.power },
    { label: "Objem motoru", value: vehicle.technical.engine },
    { label: "Pohon", value: vehicle.technical.drive },
    { label: "Barva", value: vehicle.technical.color },
    { label: "Původ", value: vehicle.specs.origin },
    { label: "Servisní historie", value: vehicle.specs.serviceHistory },
    { label: "STK", value: vehicle.technical.stk },
    { label: "Emisní norma", value: vehicle.technical.emissions },
  ];

  return (
    <article className="opportunityClassicCard" ref={cardRef}>
      <header className="ocHeader">
        <div className="ocLogoBlock">
          <div className="ocLogo">
            <span>O</span>PPORTUNITY
          </div>
          <p>AUTORIZOVANÝ PRODEJ OJETÝCH VOZŮ</p>
        </div>

        <div className="ocHeaderQuality">
          <span className="ocShield">✓</span>
          <div>
            <strong>GARANCE PŮVODU A KVALITY</strong>
            <p>PROVĚŘENÉ VOZY S JISTOTOU</p>
          </div>
        </div>
      </header>

      <section className="ocHero">
        <div className="ocHeroIntro">
          <h1>{vehicle.title}</h1>
        </div>

        <div className="ocHeroPrice">
          <div className="ocPriceBox">
            <span>PRODEJNÍ CENA</span>
            <strong>
              {price.amount} {price.suffix}
            </strong>
            <small>vč. DPH</small>
          </div>
        </div>
      </section>

      <section className="ocMetricsBar">
        <MetricItem label="Najeto" value={vehicle.specs.mileage} />
        <MetricItem label="Výkon" value={vehicle.specs.power} />
        <MetricItem label="Palivo" value={vehicle.specs.fuel} />
        <MetricItem label="Převodovka" value={vehicle.specs.transmission} />
        <MetricItem label="Pohon" value={vehicle.technical.drive} />
        <MetricItem label="STK" value={vehicle.technical.stk} />
      </section>

      <main className="ocInfoPanel">
        <h2>
          <span />
          Základní informace
          <span />
        </h2>
        <DataTable rows={basicRows} large />
      </main>

      <section className="ocThreeColumns">
        <div className="ocPanel">
          <SectionTitle icon="☆">Hlavní výbava</SectionTitle>
          <BulletList items={vehicle.equipment} limit={12} />
        </div>

        <div className="ocPanel ocSalesPanel">
          <SectionTitle icon="✓">Proč koupit tento vůz</SectionTitle>
          <BulletList items={whyBuyItems} limit={5} check />
        </div>
      </section>

      <section className="ocBenefitStrip">
        <div>
          <span>CEBIA</span>
          <strong>Prověřeno CEBIA</strong>
          <p>Garantujeme původ a historii vozu</p>
        </div>
        <div>
          <span>%</span>
          <strong>Výhodné financování</strong>
          <p>Úvěr nebo leasing na míru</p>
        </div>
        <div>
          <span>↔</span>
          <strong>Výkup vozů</strong>
          <p>Rychle a férově</p>
        </div>
      </section>

      <footer className="ocFooter">
        <div className="ocFooterBrand">
          <strong><span>O</span>PPORTUNITY</strong>
          <p>AUTORIZOVANÝ PRODEJ OJETÝCH VOZŮ</p>
        </div>
        <div className="ocFooterAddress">
          <strong>{companyProfile.company}</strong>
          <p>{vehicle.contact?.address || "Sedláčkova 10, 628 00 Brno - Líšeň"}</p>
        </div>
        <div className="ocFooterContact">
          <strong>{salesperson.phone || "+420 777 123 456"}</strong>
          <p>{companyProfile.website}</p>
        </div>
      </footer>
    </article>
  );
}

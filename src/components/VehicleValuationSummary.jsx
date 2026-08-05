import { buildVehicleProfile } from "../utils/buildVehicleProfile.js";

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function displayValue(value) {
  return hasValue(value) ? String(value) : "Neověřeno";
}

function formatCurrency(value) {
  if (!hasValue(value) || !Number.isFinite(Number(value))) return "Neověřeno";
  return `${Math.round(Number(value)).toLocaleString("cs-CZ")} Kč`;
}

function formatMileage(value) {
  if (!hasValue(value) || !Number.isFinite(Number(value))) return "Neověřeno";
  return `${Math.round(Number(value)).toLocaleString("cs-CZ")} km`;
}

function collectValues(values) {
  return values.filter(hasValue).map(String);
}

function SummaryList({ values, emptyText = "Neověřeno" }) {
  if (values.length === 0) return <p>{emptyText}</p>;

  return (
    <ul className="summaryList">
      {values.map((value, index) => (
        <li key={`${value}-${index}`}>{value}</li>
      ))}
    </ul>
  );
}

export default function VehicleValuationSummary({
  selectedCar,
  documents,
  documentsLoading,
  lifecycleSection,
  getVehicleStatusLabel,
  moduleContentRef,
}) {
  const profile = buildVehicleProfile(selectedCar, {
    documents,
    documentsLoading,
  });
  const technical = profile.technical;
  const damage = profile.condition.publicDamage || {};
  const damageItems = collectValues([
    profile.condition.publicDefects,
    damage.overallCondition,
    damage.exterior,
    damage.interior,
    damage.technical,
    damage.tiresBrakes,
    damage.glassLights,
    damage.otherDamage,
  ]);
  const cebiaNotes = collectValues([
    damage.cebiaDamageHistory,
    damage.mileageSuspicion,
    damage.cebiaRiskNotes,
  ]);
  const documentCount = Array.isArray(documents) ? documents.length : 0;
  const isValuationFlow =
    lifecycleSection === "valuation" ||
    lifecycleSection === "approved_purchase";

  return (
    <div className="card decision valuationSummary" ref={moduleContentRef}>
      <div className="valuationSummaryHeader">
        <div>
          <p className="label">
            {isValuationFlow ? "Rozhodovací podklady" : "Souhrn uložených dat"}
          </p>
          <h2>
            {isValuationFlow
              ? "Souhrn pro stanovení výkupní ceny"
              : "Přehled vozidla"}
          </h2>
        </div>
        <span className="statusBadge">
          {getVehicleStatusLabel(selectedCar.status)}
        </span>
      </div>

      <div className="summaryGrid">
        <section>
          <h3>Identifikace</h3>
          <div className="summaryFacts">
            <p><span>Vůz</span><strong>{displayValue(profile.identity.name)}</strong></p>
            <p><span>Značka / model</span><strong>{displayValue(
              [profile.identity.brand, profile.identity.model]
                .filter(hasValue)
                .join(" ")
            )}</strong></p>
            <p><span>VIN</span><strong>{displayValue(profile.identity.vin)}</strong></p>
            <p><span>SPZ</span><strong>{displayValue(profile.identity.registrationPlate)}</strong></p>
          </div>
        </section>

        <section>
          <h3>Hlavní technické údaje</h3>
          <div className="summaryFacts">
            <p><span>Rok / první registrace</span><strong>{displayValue(
              technical.firstRegistration || technical.year
            )}</strong></p>
            <p><span>Nájezd</span><strong>{formatMileage(technical.mileage)}</strong></p>
            <p><span>Motor</span><strong>{displayValue(technical.engine)}</strong></p>
            <p><span>Palivo / převodovka</span><strong>{displayValue(
              [technical.fuel, technical.transmission].filter(hasValue).join(" / ")
            )}</strong></p>
          </div>
        </section>

        <section>
          <h3>Známé poškození</h3>
          <SummaryList values={damageItems} />
        </section>

        <section>
          <h3>Důležité poznámky z CEBIA</h3>
          <SummaryList
            values={cebiaNotes}
            emptyText={
              profile.history.cebiaAvailable
                ? "Podklad CEBIA je dostupný, bez strukturované poznámky."
                : "Neověřeno"
            }
          />
        </section>

        <section>
          <h3>Administrativní podklady</h3>
          {documentsLoading ? (
            <p>Načítám dokumenty…</p>
          ) : (
            <div className="summaryFacts">
              <p><span>Dokumenty vozidla</span><strong>{documentCount}</strong></p>
              <p><span>CEBIA</span><strong>{profile.history.cebiaAvailable ? "Dostupná" : "Neověřeno"}</strong></p>
              <p><span>Fotografie</span><strong>{profile.media.photosCount}</strong></p>
            </div>
          )}
        </section>

        <section>
          <h3>Cenové údaje</h3>
          <div className="summaryFacts">
            <p><span>Představa zákazníka</span><strong>{formatCurrency(selectedCar.customerExpectedPrice)}</strong></p>
            <p><span>Návrh výkupní ceny</span><strong>{formatCurrency(selectedCar.buyEstimate)}</strong></p>
            <p><span>Návrh prodejní ceny</span><strong>{formatCurrency(selectedCar.saleEstimate)}</strong></p>
            <p><span>Potvrzená výkupní cena</span><strong>{formatCurrency(selectedCar.approvedPrice)}</strong></p>
          </div>
        </section>
      </div>
    </div>
  );
}

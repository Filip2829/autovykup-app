import {
  formatVehicleCurrency,
  getVehicleEconomy,
} from "../utils/vehicleEconomy.js";

function hasFilledValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getFilledLines(value, limit = 5) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function hasAdvertisingPreparation(advertisingData = {}) {
  return [
    advertisingData.highlights,
    advertisingData.defects,
    advertisingData.repairs,
    advertisingData.listingNote,
    advertisingData.internalSaleNote,
  ].some(hasFilledValue);
}

function SummaryLines({ lines }) {
  if (lines.length === 0) return <p>—</p>;

  return (
    <ul className="summaryList">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export default function VehicleSummary({
  selectedCar,
  readiness,
  getVehicleStatusLabel,
}) {
  const economy = getVehicleEconomy(selectedCar);
  const advertisingData = selectedCar.advertisingData || {};
  const highlightLines = getFilledLines(advertisingData.highlights);
  const defectLines = getFilledLines(advertisingData.defects);
  const hasPhotos = Array.isArray(selectedCar.photos) && selectedCar.photos.length > 0;
  const hasAdvertisingData = hasAdvertisingPreparation(advertisingData);
  const isReadyForAdvertising =
    readiness.percent >= 80 && hasPhotos && hasAdvertisingData;

  return (
    <div className="card decision vehicleSummary">
      <h2>Shrnutí vozu</h2>

      <div className="summaryGrid">
        <section>
          <h3>Ekonomika</h3>
          <div className="economyOverview">
            <div className="economyRow">
              <span>Kupní cena</span>
              <strong>{formatVehicleCurrency(economy.purchasePrice)}</strong>
            </div>
            <div className="economyRow">
              <span>Náklady po výkupu</span>
              <strong>{formatVehicleCurrency(economy.totalCosts)}</strong>
            </div>
            <div className="economyRow result">
              <span>Pořizovací cena</span>
              <strong>{formatVehicleCurrency(economy.acquisitionPrice)}</strong>
            </div>
            <div className="economyRow">
              <span>Plánovaná prodejní cena</span>
              <strong>{formatVehicleCurrency(economy.expectedSalePrice)}</strong>
            </div>
            <div
              className={`economyRow result ${
                economy.expectedMargin >= 0 ? "positive" : "negative"
              }`}
            >
              <span>Očekávaná marže</span>
              <strong>{formatVehicleCurrency(economy.expectedMargin)}</strong>
            </div>
          </div>
        </section>

        <section>
          <h3>Připravenost</h3>
          <p className="summaryPercent">{readiness.percent} %</p>
          <div className="readinessGrid compact">
            {readiness.items.map((item, index) => (
              <div
                key={item.label}
                className={`readinessItem ${item.done ? "done" : "missing"}`}
              >
                <div className="readinessNumber">{index + 1}</div>
                <h4>{item.label}</h4>
                <p>{item.done ? "Hotovo" : "Čeká"}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>Hlavní přednosti</h3>
          <SummaryLines lines={highlightLines} />
        </section>

        <section>
          <h3>Známé vady</h3>
          <SummaryLines lines={defectLines} />
        </section>

        <section>
          <h3>Stav vozu</h3>
          <div className="economyOverview">
            <div className="economyRow">
              <span>Workflow status</span>
              <strong>{getVehicleStatusLabel(selectedCar.status)}</strong>
            </div>
            <div className="economyRow">
              <span>Celkový stav vozu</span>
              <strong>{selectedCar.damageReport?.overallCondition || "—"}</strong>
            </div>
            <div
              className={`economyRow result ${
                isReadyForAdvertising ? "positive" : "negative"
              }`}
            >
              <span>Připraveno k inzerci</span>
              <strong>{isReadyForAdvertising ? "ANO" : "NE"}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

import {
  formatVehicleCurrency,
  getVehicleEconomy,
  postPurchaseCostFields,
} from "../utils/vehicleEconomy.js";

export default function VehiclePostPurchaseCosts({
  selectedCar,
  updateCar,
  moduleContentRef,
}) {
  const {
    costs,
    totalCosts,
    purchasePrice,
    acquisitionPrice,
    expectedSalePrice,
    expectedMargin,
  } = getVehicleEconomy(selectedCar);

  function updateCost(key, value) {
    updateCar({
      ...selectedCar,
      postPurchaseCosts: {
        ...costs,
        [key]: value,
      },
    });
  }

  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Náklady po výkupu</h2>

      <h3>Náklady</h3>
      <div className="formGrid">
        {postPurchaseCostFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={`${field.label} v Kč`}
              value={costs[field.key] ?? ""}
              onChange={(event) => updateCost(field.key, event.target.value)}
            />
          </div>
        ))}
      </div>

      <div>
        <p className="label">Poznámka k nákladům</p>
        <textarea
          placeholder="Poznámka k nákladům po výkupu"
          value={costs.note || ""}
          onChange={(event) => updateCost("note", event.target.value)}
        />
      </div>

      <h3>Ekonomika vozu</h3>
      <div className="economyOverview">
        <div className="economyRow">
          <span>Kupní cena</span>
          <strong>{formatVehicleCurrency(purchasePrice)}</strong>
        </div>
        <div className="economyRow">
          <span>Náklady</span>
          <strong>{formatVehicleCurrency(totalCosts)}</strong>
        </div>
        <div className="economyRow result">
          <span>Pořizovací cena</span>
          <strong>{formatVehicleCurrency(acquisitionPrice)}</strong>
        </div>
        <div className="economyRow">
          <span>Plánovaná prodejní cena</span>
          <strong>{formatVehicleCurrency(expectedSalePrice)}</strong>
        </div>
        <div
          className={`economyRow result ${
            expectedMargin >= 0 ? "positive" : "negative"
          }`}
        >
          <span>Očekávaná marže</span>
          <strong>{formatVehicleCurrency(expectedMargin)}</strong>
        </div>
      </div>
    </div>
  );
}

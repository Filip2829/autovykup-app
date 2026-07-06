const costFields = [
  { key: "service", label: "Servis" },
  { key: "bodyPaint", label: "Karoserie / lak" },
  { key: "tires", label: "Pneumatiky" },
  { key: "cleaning", label: "Čištění" },
  { key: "stkEmission", label: "STK / emise" },
  { key: "transfer", label: "Přepis" },
  { key: "other", label: "Ostatní" },
];

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatCurrency(value) {
  return `${Math.round(value).toLocaleString("cs-CZ")} Kč`;
}

function getCosts(car) {
  const costs = car.postPurchaseCosts || {};

  return {
    service: costs.service ?? "",
    bodyPaint: costs.bodyPaint ?? "",
    tires: costs.tires ?? "",
    cleaning: costs.cleaning ?? "",
    stkEmission: costs.stkEmission ?? "",
    transfer: costs.transfer ?? costs.registration ?? "",
    registration: costs.registration ?? "",
    other: costs.other ?? "",
    note: costs.note || "",
  };
}

export default function VehiclePostPurchaseCosts({
  selectedCar,
  updateCar,
  moduleContentRef,
}) {
  const costs = getCosts(selectedCar);
  const totalCosts = costFields.reduce(
    (sum, field) => sum + toNumber(costs[field.key]),
    0
  );
  const purchasePrice = toNumber(selectedCar.purchasePrice);
  const acquisitionPrice = purchasePrice + totalCosts;
  const expectedSalePrice = toNumber(selectedCar.expectedSalePrice);
  const expectedMargin = expectedSalePrice - acquisitionPrice;

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
        {costFields.map((field) => (
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
          <strong>{formatCurrency(purchasePrice)}</strong>
        </div>
        <div className="economyRow">
          <span>Náklady</span>
          <strong>{formatCurrency(totalCosts)}</strong>
        </div>
        <div className="economyRow result">
          <span>Pořizovací cena</span>
          <strong>{formatCurrency(acquisitionPrice)}</strong>
        </div>
        <div className="economyRow">
          <span>Plánovaná prodejní cena</span>
          <strong>{formatCurrency(expectedSalePrice)}</strong>
        </div>
        <div className={`economyRow result ${expectedMargin >= 0 ? "positive" : "negative"}`}>
          <span>Očekávaná marže</span>
          <strong>{formatCurrency(expectedMargin)}</strong>
        </div>
      </div>
    </div>
  );
}

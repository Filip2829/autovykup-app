import AppSelect from "./ui/AppSelect";

const purchasedStatusOptions = [
  { value: "", label: "Nevybráno" },
  { value: "Čeká na servis", label: "Čeká na servis" },
  { value: "Čeká na čištění", label: "Čeká na čištění" },
  { value: "Připraveno k prodeji", label: "Připraveno k prodeji" },
  { value: "Inzerováno", label: "Inzerováno" },
  { value: "Rezervováno", label: "Rezervováno" },
  { value: "Prodáno", label: "Prodáno" },
];

const costFields = [
  { key: "service", label: "Servis" },
  { key: "cleaning", label: "Čištění" },
  { key: "bodyPaint", label: "Karoserie/lak" },
  { key: "registration", label: "Přepis" },
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

export default function VehiclePurchase({
  selectedCar,
  updateCar,
  moduleContentRef,
}) {
  const costs = selectedCar.postPurchaseCosts || {};
  const totalCosts = costFields.reduce(
    (sum, field) => sum + toNumber(costs[field.key]),
    0
  );
  const expectedMargin =
    toNumber(selectedCar.expectedSalePrice) -
    toNumber(selectedCar.purchasePrice) -
    totalCosts;
  const hasSoldPrice =
    selectedCar.soldPrice !== "" &&
    selectedCar.soldPrice !== null &&
    selectedCar.soldPrice !== undefined;
  const actualMargin =
    toNumber(selectedCar.soldPrice) -
    toNumber(selectedCar.purchasePrice) -
    totalCosts;

  function updateField(key, value) {
    updateCar({
      ...selectedCar,
      [key]: value,
    });
  }

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
      <h2>Výkup vozidla</h2>

      <div className="formGrid">
        <div>
          <p className="label">Datum výkupu</p>
          <input
            type="date"
            value={selectedCar.purchaseDate || ""}
            onChange={(event) => updateField("purchaseDate", event.target.value)}
          />
        </div>

        <div>
          <p className="label">Skutečná výkupní cena</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Skutečná výkupní cena"
            value={selectedCar.purchasePrice ?? ""}
            onChange={(event) => updateField("purchasePrice", event.target.value)}
          />
        </div>

        <div>
          <p className="label">Předpokládaná prodejní cena</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Předpokládaná prodejní cena"
            value={selectedCar.expectedSalePrice ?? ""}
            onChange={(event) =>
              updateField("expectedSalePrice", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Stav po výkupu</p>
          <AppSelect
            ariaLabel="Stav po výkupu"
            value={selectedCar.purchasedStatus || ""}
            options={purchasedStatusOptions}
            onChange={(value) => updateField("purchasedStatus", value)}
          />
        </div>
      </div>

      <h3>Náklady po výkupu</h3>
      <div className="formGrid">
        {costFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={field.label}
              value={costs[field.key] ?? ""}
              onChange={(event) => updateCost(field.key, event.target.value)}
            />
          </div>
        ))}
      </div>

      <textarea
        placeholder="Poznámka k nákladům"
        value={costs.note || ""}
        onChange={(event) => updateCost("note", event.target.value)}
      />

      <div className="formGrid">
        <div>
          <p className="label">Skutečná prodejní cena</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Skutečná prodejní cena"
            value={selectedCar.soldPrice ?? ""}
            onChange={(event) => updateField("soldPrice", event.target.value)}
          />
        </div>

        <div>
          <p className="label">Datum prodeje</p>
          <input
            type="date"
            value={selectedCar.soldDate || ""}
            onChange={(event) => updateField("soldDate", event.target.value)}
          />
        </div>
      </div>

      <div className="aiReport">
        <h3>Orientační marže</h3>
        <p>Očekávaná marže: {formatCurrency(expectedMargin)}</p>
        {hasSoldPrice && <p>Skutečná marže: {formatCurrency(actualMargin)}</p>}
      </div>
    </div>
  );
}

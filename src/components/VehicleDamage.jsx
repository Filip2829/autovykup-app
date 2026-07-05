import AppSelect from "./ui/AppSelect";

const damageTextFields = [
  { key: "exterior", label: "Exteriér" },
  { key: "interior", label: "Interiér" },
  { key: "technical", label: "Technika" },
  { key: "tiresBrakes", label: "Pneumatiky / brzdy" },
  { key: "glassLights", label: "Skla / světla" },
  { key: "otherDamage", label: "Ostatní poškození" },
];

const damageCostFields = [
  { key: "serviceCost", label: "Servis" },
  { key: "bodyPaintCost", label: "Lak / karoserie" },
  { key: "cleaningCost", label: "Čištění" },
  { key: "tiresCost", label: "Pneumatiky" },
  { key: "stkRegistrationCost", label: "STK / evidenčka / přepis" },
  { key: "otherCost", label: "Ostatní" },
];

const recommendationOptions = [
  { value: "", label: "Nevybráno" },
  { value: "vykoupit", label: "vykoupit" },
  { value: "opatrně", label: "opatrně" },
  { value: "nevykupovat", label: "nevykupovat" },
];

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatCurrency(value) {
  return `${Math.round(value).toLocaleString("cs-CZ")} Kč`;
}

export default function VehicleDamage({
  selectedCar,
  updateCar,
  moduleContentRef,
}) {
  const damageReport = selectedCar.damageReport || {};
  const totalCosts = damageCostFields.reduce(
    (sum, field) => sum + toNumber(damageReport[field.key]),
    0
  );

  function updateDamageField(key, value) {
    updateCar({
      ...selectedCar,
      damageReport: {
        ...damageReport,
        [key]: value,
      },
    });
  }

  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Poškození a náklady na opravu</h2>

      <h3>Poškození vozu</h3>
      <div className="formGrid">
        {damageTextFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <textarea
              placeholder={field.label}
              value={damageReport[field.key] || ""}
              onChange={(event) =>
                updateDamageField(field.key, event.target.value)
              }
            />
          </div>
        ))}
      </div>

      <h3>Odhad nákladů</h3>
      <div className="formGrid">
        {damageCostFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={field.label}
              value={damageReport[field.key] ?? ""}
              onChange={(event) =>
                updateDamageField(field.key, event.target.value)
              }
            />
          </div>
        ))}
      </div>

      <h3>Souhrn</h3>
      <div className="aiReport">
        <h3>Celkové odhadované náklady</h3>
        <p>{formatCurrency(totalCosts)}</p>
      </div>

      <textarea
        placeholder="Poznámka"
        value={damageReport.note || ""}
        onChange={(event) => updateDamageField("note", event.target.value)}
      />

      <div>
        <p className="label">Doporučení</p>
        <AppSelect
          ariaLabel="Doporučení"
          value={damageReport.recommendation || ""}
          options={recommendationOptions}
          onChange={(value) => updateDamageField("recommendation", value)}
        />
      </div>
    </div>
  );
}

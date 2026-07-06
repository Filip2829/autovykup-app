import AppSelect from "./ui/AppSelect";

const overallConditionOptions = [
  { value: "", label: "Nevybráno" },
  { value: "Bez poškození", label: "Bez poškození" },
  { value: "Běžné opotřebení", label: "Běžné opotřebení" },
  { value: "Drobné kosmetické vady", label: "Drobné kosmetické vady" },
  { value: "Viditelné poškození", label: "Viditelné poškození" },
  { value: "Vyžaduje opravu", label: "Vyžaduje opravu" },
  { value: "Větší poškození", label: "Větší poškození" },
];

const damageFields = [
  {
    key: "exterior",
    label: "Karoserie / lak",
    quickChoices: [
      "drobné oděrky",
      "škrábance na nárazníku",
      "promáčklina",
      "lakování dílu",
      "koroze",
      "bez zjevných vad",
    ],
  },
  {
    key: "interior",
    label: "Interiér",
    quickChoices: [
      "běžné opotřebení",
      "znečištění",
      "poškozené čalounění",
      "poškozené plasty",
      "zápach v interiéru",
      "bez zjevných vad",
    ],
  },
  {
    key: "technical",
    label: "Mechanika / technický stav",
    quickChoices: [
      "bez zjevných závad",
      "nutná diagnostika",
      "únik provozních kapalin",
      "hluk od podvozku",
      "závada brzd",
      "závada motoru",
      "závada převodovky",
    ],
  },
  {
    key: "tiresBrakes",
    label: "Pneumatiky / kola",
    quickChoices: [
      "pneu v pořádku",
      "sjeté pneumatiky",
      "poškozený disk",
      "chybí sada kol",
      "nutná výměna pneu",
    ],
  },
];

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatCurrency(value) {
  return `${Math.round(value).toLocaleString("cs-CZ")} Kč`;
}

function appendChoice(currentValue, choice) {
  const trimmedCurrentValue = String(currentValue || "").trim();
  if (!trimmedCurrentValue) return choice;
  return `${trimmedCurrentValue}\n${choice}`;
}

export default function VehicleDamage({
  selectedCar,
  updateCar,
  moduleContentRef,
}) {
  const damageReport = selectedCar.damageReport || {};
  const repairCostEstimate = toNumber(damageReport.repairCostEstimate);

  function updateDamageField(key, value) {
    updateCar({
      ...selectedCar,
      damageReport: {
        ...damageReport,
        [key]: value,
      },
    });
  }

  function addQuickChoice(key, choice) {
    updateDamageField(key, appendChoice(damageReport[key], choice));
  }

  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Poškození / kontrola vozu</h2>

      <div className="formGrid">
        <div>
          <p className="label">Celkový stav vozu</p>
          <AppSelect
            ariaLabel="Celkový stav vozu"
            value={damageReport.overallCondition || ""}
            options={overallConditionOptions}
            onChange={(value) => updateDamageField("overallCondition", value)}
          />
        </div>

        <div>
          <p className="label">Odhad nákladů na opravu</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Odhad nákladů v Kč"
            value={damageReport.repairCostEstimate ?? ""}
            onChange={(event) =>
              updateDamageField("repairCostEstimate", event.target.value)
            }
          />
        </div>
      </div>

      <div className="aiReport">
        <h3>Souhrn nákladů</h3>
        <p>Odhad opravy: {formatCurrency(repairCostEstimate)}</p>
      </div>

      <div className="formGrid">
        {damageFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <textarea
              placeholder={field.label}
              value={damageReport[field.key] || ""}
              onChange={(event) =>
                updateDamageField(field.key, event.target.value)
              }
            />

            <div className="quickChoiceGrid">
              {field.quickChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="quickChoice"
                  onClick={() => addQuickChoice(field.key, choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="label">Interní poznámka</p>
        <textarea
          placeholder="Interní poznámka ke kontrole vozu"
          value={damageReport.note || ""}
          onChange={(event) => updateDamageField("note", event.target.value)}
        />
      </div>
    </div>
  );
}

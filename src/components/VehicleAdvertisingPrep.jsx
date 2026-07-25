const advertisingFields = [
  {
    key: "highlights",
    label: "Hlavní přednosti vozu",
    placeholder: "Hlavní přednosti vozu pro inzerát",
    quickChoices: [
      "první majitel",
      "koupeno jako nové v ČR",
      "pravidelný servis",
      "servisní historie",
      "nehavarováno",
      "nelakováno",
      "2 klíče",
      "nízký nájezd",
      "pěkný stav",
      "bohatá výbava",
    ],
  },
  {
    key: "defects",
    label: "Známé vady / poškození",
    placeholder: "Známé vady nebo poškození k uvedení u prodeje",
    quickChoices: [
      "běžné opotřebení",
      "drobné kosmetické vady",
      "škrábance",
      "poškození laku",
      "opotřebené pneumatiky",
      "prodáváno se zohledněním stavu",
    ],
  },
  {
    key: "repairs",
    label: "Provedené opravy / servis před prodejem",
    placeholder: "Provedené opravy nebo servis před prodejem",
    quickChoices: [
      "po servisní kontrole",
      "výměna oleje",
      "nové brzdy",
      "nové pneumatiky",
      "doplněná klimatizace",
      "profesionálně vyčištěno",
    ],
  },
];

const noteFields = [
  {
    key: "listingNote",
    label: "Poznámka pro inzerát",
    placeholder: "Poznámka určená pro budoucí text inzerátu",
  },
  {
    key: "internalSaleNote",
    label: "Interní poznámka k prodeji",
    placeholder: "Interní poznámka k prodeji vozu",
  },
];

function appendChoice(currentValue, choice) {
  const trimmedCurrentValue = String(currentValue || "").trim();
  if (!trimmedCurrentValue) return choice;
  return `${trimmedCurrentValue}\n${choice}`;
}

export default function VehicleAdvertisingPrep({
  selectedCar,
  updateCar,
}) {
  const advertisingData = selectedCar.advertisingData || {};

  function updateAdvertisingField(key, value) {
    updateCar({
      ...selectedCar,
      advertisingData: {
        ...advertisingData,
        [key]: value,
      },
    });
  }

  function addQuickChoice(key, choice) {
    updateAdvertisingField(key, appendChoice(advertisingData[key], choice));
  }

  return (
    <div className="card decision">
      <h2>Příprava inzerce</h2>

      <div className="formGrid">
        {advertisingFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <textarea
              placeholder={field.placeholder}
              value={advertisingData[field.key] || ""}
              onChange={(event) =>
                updateAdvertisingField(field.key, event.target.value)
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

      <div className="formGrid">
        {noteFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <textarea
              placeholder={field.placeholder}
              value={advertisingData[field.key] || ""}
              onChange={(event) =>
                updateAdvertisingField(field.key, event.target.value)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

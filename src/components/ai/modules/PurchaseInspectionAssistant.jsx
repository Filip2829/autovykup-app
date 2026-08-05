import { useMemo, useState } from "react";
import {
  PURCHASE_INSPECTION_CATEGORIES,
  PURCHASE_INSPECTION_PRIORITIES,
} from "../../../ai/purchaseInspectionCatalog.js";
import {
  getPurchaseInspectionMissingData,
  updatePurchaseInspectionItem,
} from "../../../ai/purchaseInspection.js";
import AiMissingData from "../AiMissingData.jsx";

const statusLabels = {
  unchecked: "Neověřeno",
  passed: "V pořádku",
  defect: "Závada",
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function InputSummary({ context }) {
  const profile = context.profile || {};
  const technical = profile.technical || {};
  const values = [
    [
      "Vozidlo",
      [profile.identity?.brand, profile.identity?.model]
        .filter(hasValue)
        .join(" "),
    ],
    ["Verze / motorizace", profile.identity?.version || technical.engine],
    ["Kód motoru", technical.engineCode],
    ["Palivo", technical.fuel],
    ["Převodovka", technical.transmission],
    ["Pohon", technical.drive],
    ["Karoserie", technical.bodyType],
    ["Rok / registrace", technical.year || technical.firstRegistration],
    [
      "Výkon",
      hasValue(technical.powerKw) ? `${technical.powerKw} kW` : "",
    ],
    [
      "Nájezd",
      hasValue(technical.mileage)
        ? `${Number(technical.mileage).toLocaleString("cs-CZ")} km`
        : "",
    ],
    [
      "Známý stav",
      profile.condition?.hasStructuredData ? "Evidován" : "Neevidován",
    ],
  ].filter(([, value]) => hasValue(value));

  return (
    <section className="aiAssistantSection">
      <h3>Vstupní údaje kontroly</h3>
      <div className="purchaseInspectionInputs">
        {values.map(([label, value]) => (
          <p key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </p>
        ))}
      </div>
    </section>
  );
}

function formatInspectionForClipboard(items) {
  return Object.entries(PURCHASE_INSPECTION_CATEGORIES)
    .map(([category, label]) => {
      const categoryItems = items.filter((item) => item.category === category);
      if (categoryItems.length === 0) return "";
      return [
        label,
        ...categoryItems.map((item) => {
          const note = item.note?.trim()
            ? ` Poznámka: ${item.note.trim()}`
            : "";
          return `- [${statusLabels[item.status]}] ${item.title}: ${item.howToCheck}${note}`;
        }),
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export default function PurchaseInspectionAssistant({
  moduleDefinition,
  context,
  capabilities,
  aiState,
}) {
  const [items, setItems] = useState([]);
  const [copied, setCopied] = useState(false);
  const missingData = useMemo(
    () => getPurchaseInspectionMissingData(context),
    [context]
  );
  const canRun = capabilities.canRun && missingData.length === 0;

  const runInspection = async () => {
    const result = await aiState.run({
      moduleId: moduleDefinition.id,
      vehicleId: context.vehicleId,
      context,
      options: {},
    });
    if (result) {
      setItems(result.output?.items || []);
      setCopied(false);
    }
  };

  const resetInspection = () => {
    setItems((currentItems) =>
      currentItems.map((item) => ({
        ...item,
        status: "unchecked",
        note: "",
      }))
    );
    setCopied(false);
  };

  const copyInspection = async () => {
    if (items.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatInspectionForClipboard(items));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const updateItem = (itemId, changes) => {
    setItems((currentItems) =>
      updatePurchaseInspectionItem(currentItems, itemId, changes)
    );
  };

  return (
    <div className="aiModulePanel purchaseInspectionModule">
      <div className="aiModuleIntro">
        <div>
          <h2>{moduleDefinition.label}</h2>
          <p>
            Modelově a motorizací specifické body, na které se zaměřit před
            výkupem. Seznam nepotvrzuje závadu a nic neukládá.
          </p>
        </div>
        {!aiState.result && (
          <button
            type="button"
            className="primary"
            onClick={runInspection}
            disabled={aiState.loading || !canRun}
          >
            {aiState.loading
              ? "Připravuji kontrolu…"
              : "Vytvořit seznam rizik"}
          </button>
        )}
      </div>

      <InputSummary context={context} />
      <AiMissingData
        title="Doplňte před vytvořením kontroly"
        items={missingData}
      />
      {aiState.error && <p className="badText">{aiState.error}</p>}

      {aiState.result && items.length === 0 && (
        <section className="aiAssistantSection purchaseInspectionEmpty">
          <h3>Konkrétní doporučení nejsou dostupná</h3>
          <p>{aiState.result.output?.emptyMessage}</p>
          <button
            type="button"
            className="primary outline"
            onClick={runInspection}
            disabled={aiState.loading}
          >
            Vytvořit znovu
          </button>
        </section>
      )}

      {items.length > 0 && (
        <div className="purchaseInspectionResult">
          <div className="aiResultHeader">
            <div>
              <p className="label">Lokální pracovní kontrola</p>
              <h3>Specifická rizika ({items.length} bodů)</h3>
            </div>
            <div className="purchaseInspectionActions">
              <button
                type="button"
                className="primary outline"
                onClick={runInspection}
                disabled={aiState.loading}
              >
                Vytvořit znovu
              </button>
              <button
                type="button"
                className="secondary"
                onClick={resetInspection}
              >
                Resetovat kontrolu
              </button>
              <button
                type="button"
                className="secondary"
                onClick={copyInspection}
              >
                Kopírovat seznam
              </button>
            </div>
          </div>

          {copied && (
            <p className="goodText" role="status">
              Seznam specifických rizik byl zkopírován.
            </p>
          )}

          <div className="purchaseInspectionGroups">
            {Object.entries(PURCHASE_INSPECTION_CATEGORIES).map(
              ([category, label]) => {
                const categoryItems = items.filter(
                  (item) => item.category === category
                );
                if (categoryItems.length === 0) return null;

                return (
                  <section className="aiAssistantSection" key={category}>
                    <h3>{label}</h3>
                    <div className="purchaseInspectionItems">
                      {categoryItems.map((item) => (
                        <article
                          className={`purchaseInspectionItem priority-${item.priority}`}
                          key={item.id}
                        >
                          <div className="purchaseInspectionItemHeader">
                            <div>
                              <span className="purchaseInspectionPriority">
                                {PURCHASE_INSPECTION_PRIORITIES[item.priority]}
                              </span>
                              <h4>{item.title}</h4>
                            </div>
                            <select
                              aria-label={`Stav kontroly: ${item.title}`}
                              value={item.status}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  status: event.target.value,
                                })
                              }
                            >
                              {Object.entries(statusLabels).map(
                                ([value, labelText]) => (
                                  <option value={value} key={value}>
                                    {labelText}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <p>
                            <strong>Proč ověřit:</strong> {item.reason}
                          </p>
                          <p>
                            <strong>Jak zkontrolovat:</strong> {item.howToCheck}
                          </p>
                          <label>
                            Poznámka
                            <textarea
                              rows="2"
                              value={item.note}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  note: event.target.value,
                                })
                              }
                              placeholder="Krátká poznámka z prohlídky"
                            />
                          </label>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              }
            )}
          </div>

          {aiState.result?.warnings?.map((warning) => (
            <div className="aiResultWarning" key={warning}>
              <p>{warning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

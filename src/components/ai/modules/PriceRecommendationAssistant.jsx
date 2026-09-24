import AiMissingData from "../AiMissingData.jsx";

const confidenceLabels = {
  high: "Vysoká vypovídací hodnota",
  medium: "Střední vypovídací hodnota",
  low: "Nízká vypovídací hodnota",
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatCurrency(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? `${Math.round(number).toLocaleString("cs-CZ")} Kč`
    : "Neuvedeno";
}

function formatMileage(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? `${Math.round(number).toLocaleString("cs-CZ")} km`
    : "Neuvedeno";
}

function InputSummary({ context }) {
  const profile = context.profile || {};
  const identity = profile.identity || {};
  const technical = profile.technical || {};
  const costs = context.internal?.purchaseEconomy?.totalCosts || 0;
  const values = [
    ["Vozidlo", [identity.brand, identity.model].filter(hasValue).join(" ")],
    ["Verze", identity.version || technical.version],
    ["Rok", technical.productionYear || technical.year || technical.firstRegistration],
    ["Motor", technical.engine],
    ["Výkon", hasValue(technical.powerKw) ? `${technical.powerKw} kW` : ""],
    ["Palivo", technical.fuel],
    ["Převodovka", technical.transmission],
    ["Pohon", technical.drive],
    ["Nájezd", hasValue(technical.mileage) ? formatMileage(technical.mileage) : ""],
    ["Evidované náklady na přípravu", formatCurrency(costs)],
  ].filter(([, value]) => hasValue(value));

  return (
    <section className="aiAssistantSection">
      <h3>Podklady pro porovnání</h3>
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

export default function PriceRecommendationAssistant({
  moduleDefinition,
  context,
  capabilities,
  aiState,
}) {
  const runRecommendation = () =>
    aiState.run({
      moduleId: moduleDefinition.id,
      vehicleId: context.vehicleId,
      context,
      options: {},
    });
  const output = aiState.result?.output;

  return (
    <div className="aiModulePanel priceRecommendationModule">
      <div className="aiModuleIntro">
        <div>
          <h2>{moduleDefinition.label}</h2>
          <p>
            Vyhledá až 10 nejbližších aktivních nabídek na Sauto. Medián
            nabídkových cen určí návrh prodejní ceny a výkupní cenu dopočítá
            po odečtení přípravy a minimální marže.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={runRecommendation}
          disabled={aiState.loading || !capabilities.canRun}
        >
          {aiState.loading ? "Porovnávám nabídky…" : "Porovnat se Sauto"}
        </button>
      </div>

      <InputSummary context={context} />
      <AiMissingData
        title="Doplňte před naceněním"
        items={capabilities.missingRequiredSources}
      />
      {aiState.error && <p className="badText">{aiState.error}</p>}

      {output && (
        <div className="priceRecommendationResult">
          <section className="aiAssistantSection priceRecommendationPrices">
            <div>
              <span>Doporučená prodejní cena</span>
              <strong>{formatCurrency(output.recommendedSalePrice)}</strong>
              <small>Medián porovnatelných nabídkových cen</small>
            </div>
            <div>
              <span>Doporučená výkupní cena</span>
              <strong>{formatCurrency(output.recommendedPurchasePrice)}</strong>
              <small>Po odečtení nákladů a minimální marže</small>
            </div>
          </section>

          <section className="aiAssistantSection">
            <h3>Výpočet výkupní ceny</h3>
            <div className="priceRecommendationFormula">
              <p><span>Prodejní cena</span><strong>{formatCurrency(output.recommendedSalePrice)}</strong></p>
              <p><span>Náklady na přípravu</span><strong>− {formatCurrency(output.preparationCosts)}</strong></p>
              <p><span>Minimální marže</span><strong>− {formatCurrency(output.minimumMargin)}</strong></p>
              <p className="priceRecommendationFormulaTotal"><span>Výkupní návrh</span><strong>{formatCurrency(output.recommendedPurchasePrice)}</strong></p>
            </div>
            <p className="mutedText">
              Marže je 30 000 Kč do prodejní ceny 300 000 Kč a 10 % nad tuto hranici.
            </p>
          </section>

          <section className={`aiAssistantSection purchaseInspectionConfidence confidence-${output.confidence}`}>
            <h3>{confidenceLabels[output.confidence] || "Vypovídací hodnota"}</h3>
            <p>
              Použito {output.sampleSize} porovnatelných inzerátů. {output.querySummary}
            </p>
            {output.selection && (
              <p>
                Rozsah porovnání: rok ±{output.selection.yearTolerance}, nájezd ±{Number(output.selection.mileageTolerance).toLocaleString("cs-CZ")} km.
              </p>
            )}
          </section>

          <section className="aiAssistantSection">
            <h3>Porovnatelné inzeráty</h3>
            <div className="priceComparableList">
              {output.comparables.map((item) => (
                <article key={item.url}>
                  <div>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                    <p>{item.matchReason}</p>
                  </div>
                  <div className="priceComparableFacts">
                    <strong>{formatCurrency(item.price)}</strong>
                    <span>{item.year || "Rok neuveden"}</span>
                    <span>{formatMileage(item.mileage)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {output.warnings.map((warning) => (
            <div className="aiResultWarning" key={warning}>
              <p>{warning}</p>
            </div>
          ))}

          <div className="purchaseInspectionActions">
            <button
              type="button"
              className="primary outline"
              onClick={runRecommendation}
              disabled={aiState.loading}
            >
              Přepočítat podle aktuálních nabídek
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

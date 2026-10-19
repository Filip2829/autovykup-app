import { useEffect, useState } from "react";
import AiMissingData from "../AiMissingData.jsx";
import { getPriceRecommendationReadiness } from "../../../services/priceRecommendationAi.js";
import { priceRecommendationSnapshots } from "../../../services/priceRecommendationSnapshots.js";

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

function formatRange(from, to) {
  if (!hasValue(from) || !hasValue(to) || Number(from) === Number(to)) {
    return formatCurrency(from);
  }
  return `${formatCurrency(from)} – ${formatCurrency(to)}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
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
  const [history, setHistory] = useState([]);
  const readiness = getPriceRecommendationReadiness(context);
  const canRun = capabilities.canRun && readiness.canRun;
  const runRecommendation = (forceRefresh = false) =>
    aiState.run({
      moduleId: moduleDefinition.id,
      vehicleId: context.vehicleId,
      context,
      options: { forceRefresh },
    });
  const output = aiState.result?.output;

  useEffect(() => {
    let active = true;
    priceRecommendationSnapshots.list(context.vehicleId, 6)
      .then((items) => { if (active) setHistory(items); })
      .catch(() => { if (active) setHistory([]); });
    return () => { active = false; };
  }, [context.vehicleId, aiState.result?.generatedAt]);

  return (
    <div className="aiModulePanel priceRecommendationModule">
      <div className="aiModuleIntro">
        <div>
          <h2>{moduleDefinition.label}</h2>
          <p>
            Prohledá Sauto i TipCars, odstraní jiné varianty, duplicity a cenové
            odlehlosti. Cenu určí váženě podle podobnosti roku, nájezdu,
            motorizace, převodovky, karoserie a výbavy.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => runRecommendation(false)}
          disabled={aiState.loading || !canRun}
        >
          {aiState.loading ? "Porovnávám oba trhy…" : "Přesně nacenit podle trhu"}
        </button>
      </div>

      <InputSummary context={context} />
      <section className="aiAssistantSection priceRecommendationReadiness">
        <div className="priceRecommendationReadinessHeader">
          <h3>Připravenost podkladů</h3>
          <strong>{readiness.percent} %</strong>
        </div>
        <div className="priceRecommendationReadinessBar" aria-label={`Připravenost ${readiness.percent} %`}>
          <span style={{ width: `${readiness.percent}%` }} />
        </div>
        {readiness.missingRequired.length > 0 && (
          <p className="badText">Před spuštěním doplňte: {readiness.missingRequired.join(", ")}.</p>
        )}
        {readiness.missingRecommended.length > 0 && (
          <p className="mutedText">Pro přesnější výsledek doporučujeme doplnit: {readiness.missingRecommended.join(", ")}.</p>
        )}
      </section>
      <AiMissingData
        title="Doplňte před naceněním"
        items={capabilities.missingRequiredSources}
      />
      {aiState.error && <p className="badText">{aiState.error}</p>}

      {output && (
        <div className="priceRecommendationResult">
          {aiState.result?.cache?.hit && (
            <div className="aiResultWarning priceRecommendationCacheNotice">
              <p>Použit poslední shodný výpočet z {formatDate(aiState.result.generatedAt)}. Platnost mezipaměti: 12 hodin.</p>
            </div>
          )}
          <section className="aiAssistantSection priceRecommendationPrices">
            <div>
              <span>Doporučená prodejní cena</span>
              <strong>{formatCurrency(output.recommendedSalePrice)}</strong>
              <small>Tržní pásmo {formatRange(output.salePriceLow, output.salePriceHigh)}</small>
            </div>
            <div>
              <span>Doporučená výkupní cena</span>
              <strong>{formatCurrency(output.recommendedPurchasePrice)}</strong>
              <small>Bezpečné pásmo {formatRange(output.purchasePriceLow, output.purchasePriceHigh)}</small>
            </div>
          </section>

          <section className="aiAssistantSection">
            <h3>Výpočet výkupní ceny</h3>
            <div className="priceRecommendationFormula">
              <p><span>Prodejní cena</span><strong>{formatCurrency(output.recommendedSalePrice)}</strong></p>
              <p><span>Náklady na přípravu</span><strong>− {formatCurrency(output.preparationCosts)}</strong></p>
              <p><span>Minimální marže</span><strong>− {formatCurrency(output.minimumMargin)}</strong></p>
              <p><span>Rezerva podle jistoty výsledku</span><strong>− {formatCurrency(output.riskReserve)}</strong></p>
              <p className="priceRecommendationFormulaTotal"><span>Výkupní návrh</span><strong>{formatCurrency(output.recommendedPurchasePrice)}</strong></p>
            </div>
            <p className="mutedText">
              Marže je 30 000 Kč do prodejní ceny 300 000 Kč a 10 % nad tuto
              hranici. Rezerva se přidá pouze při střední nebo nízké jistotě.
            </p>
          </section>

          <section className={`aiAssistantSection purchaseInspectionConfidence confidence-${output.confidence}`}>
            <h3>{confidenceLabels[output.confidence] || "Vypovídací hodnota"}</h3>
            <p>
              Použito {output.sampleSize} porovnatelných inzerátů. {output.querySummary}
            </p>
            <p>
              Sauto: {output.sourceCounts?.sauto || 0}, TipCars: {output.sourceCounts?.tipcars || 0},
              průměrná shoda {output.averageQuality || 0} %, cenový rozptyl {Math.round((output.spreadPercent || 0) * 100)} %.
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
                    <span className={`marketplaceBadge marketplace-${item.source}`}>
                      {item.source === "tipcars" ? "TipCars" : "Sauto"}
                    </span>
                    <p>{item.matchReason}</p>
                  </div>
                  <div className="priceComparableFacts">
                    <strong>{formatCurrency(item.price)}</strong>
                    <span>{item.year || "Rok neuveden"}</span>
                    <span>{formatMileage(item.mileage)}</span>
                    <span>Shoda {item.qualityScore || 0} %</span>
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
              onClick={() => runRecommendation(true)}
              disabled={aiState.loading}
            >
              Přepočítat podle aktuálních nabídek
            </button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section className="aiAssistantSection priceRecommendationHistory">
          <h3>Historie nacenění</h3>
          <div className="priceRecommendationHistoryList">
            {history.map((snapshot) => (
              <div key={snapshot.id}>
                <span>{formatDate(snapshot.generatedAt)}</span>
                <strong>{formatCurrency(snapshot.output?.recommendedSalePrice)}</strong>
                <small>výkup {formatCurrency(snapshot.output?.recommendedPurchasePrice)} · {snapshot.output?.sampleSize || 0} nabídek</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

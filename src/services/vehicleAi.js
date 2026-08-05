import { getAiModule } from "../ai/aiModuleRegistry.js";
import { evaluateVehicleAiCapabilities } from "../ai/vehicleAiCapabilities.js";
import { createVehicleAiResponse } from "../ai/vehicleAiContracts.js";
import { sanitizeVehicleAiContext } from "../ai/sanitizeVehicleAiContext.js";

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function valueOrUnknown(value) {
  return hasValue(value) ? String(value) : "Neověřeno";
}

function formatNumber(value, suffix = "") {
  const number = Number(value);
  return hasValue(value) && Number.isFinite(number)
    ? `${Math.round(number).toLocaleString("cs-CZ")}${suffix}`
    : "Neověřeno";
}

function addLine(lines, label, value, formatter = valueOrUnknown) {
  if (!hasValue(value)) return;
  lines.push({ label, value: formatter(value) });
}

function collectCondition(profile) {
  const damage = profile.condition?.publicDamage || {};
  const values = [
    profile.condition?.publicDefects,
    damage.overallCondition,
    damage.exterior,
    damage.interior,
    damage.technical,
    damage.tiresBrakes,
    damage.glassLights,
    damage.otherDamage,
    damage.cebiaDamageHistory,
    damage.mileageSuspicion,
    damage.cebiaRiskNotes,
  ];

  return [...new Set(values.filter(hasValue).map((value) => String(value)))];
}

function getPricingLines(context) {
  const lines = [];
  const valuation = context.internal?.valuation || {};
  const formatCurrency = (value) => formatNumber(value, " Kč");

  if (
    context.lifecycleSection === "valuation" ||
    context.lifecycleSection === "approved_purchase"
  ) {
    addLine(lines, "Představa zákazníka", valuation.customerExpectedPrice, formatCurrency);
    addLine(lines, "Návrh výkupní ceny", valuation.buyEstimate, formatCurrency);
    addLine(lines, "Návrh prodejní ceny", valuation.saleEstimate, formatCurrency);
    addLine(lines, "Potvrzená výkupní cena", valuation.approvedPrice, formatCurrency);
    return lines;
  }

  addLine(lines, "Výkupní cena", valuation.purchasePrice, formatCurrency);
  addLine(lines, "Plánovaná prodejní cena", valuation.expectedSalePrice, formatCurrency);
  addLine(lines, "Návrh prodejní ceny", valuation.saleEstimate, formatCurrency);

  if (context.lifecycleSection === "sold") {
    addLine(lines, "Prodejní cena", valuation.soldPrice, formatCurrency);
    addLine(lines, "Datum prodeje", valuation.soldDate);
  }

  return lines;
}

function buildMissingData(context) {
  const profile = context.profile;
  const missing = [];

  if (!hasValue(profile.identity?.brand)) missing.push("Značka vozidla");
  if (!hasValue(profile.identity?.model)) missing.push("Model vozidla");
  if (!hasValue(profile.identity?.vin)) missing.push("VIN");
  if (!hasValue(profile.technical?.year)) missing.push("Rok výroby nebo registrace");
  if (!hasValue(profile.technical?.mileage)) missing.push("Stav kilometrů");
  if (!hasValue(profile.technical?.fuel)) missing.push("Palivo");
  if (!hasValue(profile.technical?.transmission)) missing.push("Převodovka");
  if (!profile.condition?.hasStructuredData) missing.push("Kontrola stavu vozidla");
  if (Number(profile.documents?.totalCount || 0) === 0) missing.push("Dokumentace vozidla");

  return missing;
}

export function createDeterministicVehicleSummary(context, generatedAt) {
  const profile = context.profile;
  const identity = [];
  const technical = [];
  const condition = collectCondition(profile);
  const equipmentDocumentation = [];

  addLine(identity, "Vozidlo", profile.identity?.name);
  addLine(identity, "Značka", profile.identity?.brand);
  addLine(identity, "Model", profile.identity?.model);
  addLine(identity, "VIN", profile.identity?.vin);
  addLine(identity, "SPZ", profile.identity?.registrationPlate);
  addLine(technical, "Rok", profile.technical?.year);
  addLine(technical, "První registrace", profile.technical?.firstRegistration);
  addLine(technical, "Nájezd", profile.technical?.mileage, (value) =>
    formatNumber(value, " km")
  );
  addLine(technical, "Motor", profile.technical?.engine);
  addLine(technical, "Výkon", profile.technical?.powerKw, (value) =>
    formatNumber(value, " kW")
  );
  addLine(technical, "Palivo", profile.technical?.fuel);
  addLine(technical, "Převodovka", profile.technical?.transmission);

  if (Number(profile.equipment?.count || 0) > 0) {
    equipmentDocumentation.push(
      `Evidováno ${profile.equipment.count} položek výbavy.`
    );
  }
  if (Number(profile.documents?.totalCount || 0) > 0) {
    equipmentDocumentation.push(
      `Dostupných dokumentů: ${profile.documents.totalCount}.`
    );
  }
  if (profile.history?.cebiaAvailable) {
    equipmentDocumentation.push("K vozidlu jsou dostupné podklady CEBIA.");
  }

  const missingData = buildMissingData(context);
  const name =
    profile.identity?.name ||
    [profile.identity?.brand, profile.identity?.model].filter(hasValue).join(" ") ||
    "Vozidlo";
  const summaryParts = [`${name} je vedeno ve fázi ${context.lifecycleSection}.`];

  if (technical.length > 0) {
    summaryParts.push("Základní technické údaje jsou v evidenci alespoň částečně vyplněné.");
  }
  summaryParts.push(
    condition.length > 0
      ? "Souhrn uvádí pouze evidovaný stav a známá poškození."
      : "Stav a případná poškození zatím nejsou ověřené."
  );
  if (missingData.length > 0) {
    summaryParts.push(`Před dalším rozhodnutím je vhodné doplnit ${missingData.length} důležitých údajů.`);
  }

  return createVehicleAiResponse({
    moduleId: "vehicle-summary",
    generatedAt,
    output: {
      identification: identity,
      technical,
      condition,
      equipmentDocumentation,
      pricing: getPricingLines(context),
      summary: summaryParts.join(" "),
    },
    sourceReferences: [
      "profile.identity",
      "profile.technical",
      "profile.condition",
      "profile.equipment",
      "profile.documents",
      "internal.valuation",
    ],
    missingData,
    warnings: ["Výstup je sestaven pouze z uložených údajů a vyžaduje kontrolu uživatelem."],
    proposedChanges: [],
  });
}

async function runModule({ moduleId, vehicleId, context, options = {} }) {
  const moduleDefinition = getAiModule(moduleId);
  if (!moduleDefinition || moduleDefinition.enabled !== true) {
    throw new Error("Požadovaný AI modul není dostupný.");
  }
  if (vehicleId !== context?.vehicleId) {
    throw new Error("AI kontext neodpovídá vybranému vozidlu.");
  }
  if (!moduleDefinition.supportedSections.includes(context.lifecycleSection)) {
    throw new Error("AI modul není pro tuto fázi vozidla dostupný.");
  }

  const sanitizedContext = sanitizeVehicleAiContext(context, moduleDefinition);
  const capabilities = evaluateVehicleAiCapabilities(
    sanitizedContext,
    moduleDefinition
  );
  if (!capabilities.canRun) {
    throw new Error(
      `Chybí povinné podklady: ${capabilities.missingRequiredSources.join(", ")}.`
    );
  }

  if (moduleId === "vehicle-summary") {
    return createDeterministicVehicleSummary(
      sanitizedContext,
      options.generatedAt
    );
  }

  throw new Error("AI modul zatím nemá implementovaný backend.");
}

export const vehicleAi = { runModule };

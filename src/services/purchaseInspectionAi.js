import { supabase } from "../supabase.js";

const FUNCTION_NAME = "analyze-vehicle-purchase-risks";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_CONTEXT_LENGTH = 12000;
const MAX_TEXT_LENGTH = 600;
const MAX_RISKS = 8;

const allowedConfidence = new Set(["high", "medium", "low"]);
const allowedCategories = new Set([
  "engine",
  "emissions",
  "transmission",
  "drivetrain",
  "chassis",
  "body",
  "electronics",
  "cooling",
  "other",
]);
const allowedPriorities = new Set([
  "critical",
  "important",
  "recommended",
]);
const forbiddenGenericPatterns = [
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola brzd/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola pneumatik/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola laku/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola sv[eě]tel/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola klimatizace/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola podvozku/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola interi[eé]ru/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?zku[sš]ebn[ií] j[ií]zda/i,
];

export class PurchaseInspectionAiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PurchaseInspectionAiError";
    this.code = code;
  }
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function text(value, maxLength = MAX_TEXT_LENGTH) {
  return hasValue(value) ? String(value).trim().slice(0, maxLength) : "";
}

function normalize(value) {
  return text(value)
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function compactStrings(values, limit = 8) {
  const seen = new Set();
  return values
    .filter(hasValue)
    .map((value) => text(value, 400))
    .filter((value) => {
      const key = normalize(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function getKnownDamage(profile) {
  const damage = profile.condition?.publicDamage || {};
  return compactStrings([
    profile.condition?.publicDefects,
    damage.overallCondition,
    damage.exterior,
    damage.interior,
    damage.technical,
    damage.tiresBrakes,
    damage.glassLights,
    damage.otherDamage,
  ]);
}

function getTechnicalNotes(profile) {
  const damage = profile.condition?.publicDamage || {};
  return compactStrings([
    damage.technical,
    profile.condition?.publicDefects,
  ], 4);
}

export function buildPurchaseInspectionAiPayload(context) {
  const profile = context?.profile || {};
  const identity = profile.identity || {};
  const technical = profile.technical || {};
  const payload = {
    identity: {
      brand: text(identity.brand, 100),
      model: text(identity.model, 100),
      generation: text(identity.version || technical.version, 120),
    },
    technical: {
      year: text(technical.productionYear || technical.year, 20),
      firstRegistration: text(technical.firstRegistration, 30),
      engine: text(technical.engine, 160),
      displacement: text(technical.displacement, 50),
      powerKw: text(technical.powerKw, 20),
      fuel: text(technical.fuel, 60),
      engineCode: text(technical.engineCode, 60),
      transmission: text(technical.transmission, 120),
      drive: text(technical.drive, 80),
      bodyType: text(technical.bodyType, 80),
      mileage: text(technical.mileage, 30),
    },
    knownDamage: getKnownDamage(profile),
    technicalNotes: getTechnicalNotes(profile),
  };

  if (JSON.stringify(payload).length > MAX_CONTEXT_LENGTH) {
    throw new PurchaseInspectionAiError(
      "payload-too-large",
      "Technické podklady jsou příliš rozsáhlé. Zkraťte poznámky ke stavu vozidla."
    );
  }

  return payload;
}

function validateIdentification(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba vrátila neplatnou identifikaci vozidla."
    );
  }

  return {
    brand: text(value.brand, 100),
    model: text(value.model, 100),
    generation: text(value.generation, 120),
    engine: text(value.engine, 160),
    transmission: text(value.transmission, 120),
    year: text(value.year, 20),
  };
}

function validateRisk(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba vrátila neplatný bod rizika."
    );
  }

  const risk = {
    id: text(value.id, 120),
    category: text(value.category, 30),
    priority: text(value.priority, 30),
    title: text(value.title, 180),
    reason: text(value.reason, 600),
    howToCheck: text(value.howToCheck, 600),
    specificity: text(value.specificity, 240),
  };

  if (
    !risk.id ||
    !allowedCategories.has(risk.category) ||
    !allowedPriorities.has(risk.priority) ||
    !risk.title ||
    !risk.reason ||
    !risk.howToCheck ||
    !risk.specificity
  ) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba vrátila neúplný nebo nepovolený bod rizika."
    );
  }

  if (forbiddenGenericPatterns.some((pattern) => pattern.test(risk.title))) {
    throw new PurchaseInspectionAiError(
      "unsafe-response",
      "AI služba vrátila obecný kontrolní bod místo specifického rizika."
    );
  }

  return risk;
}

export function validatePurchaseInspectionAiOutput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba vrátila neplatnou odpověď."
    );
  }
  if (!allowedConfidence.has(value.confidence)) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba vrátila neplatnou úroveň jistoty."
    );
  }
  if (!Array.isArray(value.risks) || value.risks.length > MAX_RISKS) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba vrátila neplatný počet rizik."
    );
  }

  const seenIds = new Set();
  const seenTitles = new Set();
  const risks = value.risks.map(validateRisk).filter((risk) => {
    const id = normalize(risk.id);
    const title = normalize(risk.title);
    if (seenIds.has(id) || seenTitles.has(title)) return false;
    seenIds.add(id);
    seenTitles.add(title);
    return true;
  });

  const confidenceReason = text(value.confidenceReason, 500);
  const disclaimer = text(value.disclaimer, 500);
  if (!confidenceReason || !disclaimer) {
    throw new PurchaseInspectionAiError(
      "invalid-response",
      "AI služba nevrátila vysvětlení jistoty nebo bezpečnostní upozornění."
    );
  }

  return {
    vehicleIdentification: validateIdentification(value.vehicleIdentification),
    confidence: value.confidence,
    confidenceReason,
    risks,
    disclaimer,
  };
}

async function getInvocationErrorDetails(error) {
  const fallback = error?.message || "AI služba není dostupná.";
  const response = error?.context;
  if (!response || typeof response.clone !== "function") {
    return { code: "unavailable", message: fallback };
  }

  try {
    const body = await response.clone().json();
    return {
      code: text(body?.code, 50) || "unavailable",
      message: text(body?.detail || body?.error, 500) || fallback,
    };
  } catch {
    return { code: "unavailable", message: fallback };
  }
}

export async function invokePurchaseInspectionAi(
  payload,
  { invoke, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  const invokeFunction =
    invoke ||
    ((body) =>
      supabase.functions.invoke(FUNCTION_NAME, {
        body: { vehicle: body },
      }));
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new PurchaseInspectionAiError(
            "timeout",
            "AI analýza překročila časový limit. Zkuste ji spustit znovu."
          )
        ),
      timeoutMs
    );
  });

  try {
    const response = await Promise.race([invokeFunction(payload), timeout]);
    if (response?.error) {
      const details = await getInvocationErrorDetails(response.error);
      throw new PurchaseInspectionAiError(
        details.code,
        details.message
      );
    }
    if (response?.data?.error) {
      throw new PurchaseInspectionAiError(
        text(response.data.code, 50) || "unavailable",
        text(response.data.detail || response.data.error, 500)
      );
    }
    return validatePurchaseInspectionAiOutput(
      response?.data?.output ?? response?.data
    );
  } catch (error) {
    if (error instanceof PurchaseInspectionAiError) throw error;
    throw new PurchaseInspectionAiError(
      "network",
      error instanceof Error
        ? `AI službu se nepodařilo kontaktovat: ${error.message}`
        : "AI službu se nepodařilo kontaktovat."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const purchaseInspectionAiConstants = {
  functionName: FUNCTION_NAME,
  maxContextLength: MAX_CONTEXT_LENGTH,
  maxRisks: MAX_RISKS,
};

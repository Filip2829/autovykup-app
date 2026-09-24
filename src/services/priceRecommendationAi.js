import { supabase } from "../supabase.js";

const FUNCTION_NAME = "estimate-vehicle-market-price";
const DEFAULT_TIMEOUT_MS = 45000;
const MAX_TEXT_LENGTH = 180;
const MAX_COMPARABLES = 10;
const MIN_SUFFICIENT_SAMPLE = 5;
const COMPARISON_LEVELS = [
  { yearTolerance: 1, mileageTolerance: 35000 },
  { yearTolerance: 1, mileageTolerance: 70000 },
  { yearTolerance: 2, mileageTolerance: 100000 },
];

export class PriceRecommendationAiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PriceRecommendationAiError";
    this.code = code;
  }
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function text(value, maxLength = MAX_TEXT_LENGTH) {
  return hasValue(value) ? String(value).trim().slice(0, maxLength) : "";
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalize(value) {
  return text(value, 600)
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getYear(value) {
  const match = text(value, 30).match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function matchesModelVariant(item, vehicle) {
  const model = normalize(vehicle?.model);
  if (!model) return true;

  const source = normalize(`${item.title} ${item.url}`);
  const targetDescriptor = normalize(
    `${vehicle?.brand || ""} ${vehicle?.model || ""} ${vehicle?.version || ""}`
  );
  if (!source.includes(model)) return false;

  const isScenicFamily = model.includes("scenic");
  if (isScenicFamily) {
    const targetIsGrand = targetDescriptor.includes("grand scenic");
    const sourceIsGrand = source.includes("grand scenic");
    if (targetIsGrand !== sourceIsGrand) return false;
  }

  return true;
}

function fitsComparisonLevel(item, vehicle, level) {
  const targetYear = getYear(vehicle?.year || vehicle?.firstRegistration);
  const itemYear = getYear(item.year);
  if (targetYear && (!itemYear || Math.abs(itemYear - targetYear) > level.yearTolerance)) {
    return false;
  }

  const targetMileage = positiveNumber(vehicle?.mileage);
  if (
    targetMileage &&
    (!item.mileage ||
      Math.abs(item.mileage - targetMileage) > level.mileageTolerance)
  ) {
    return false;
  }

  return true;
}

export function selectComparableVehicles(comparables, vehicle = {}) {
  const modelMatches = (Array.isArray(comparables) ? comparables : []).filter(
    (item) => matchesModelVariant(item, vehicle)
  );
  let selected = [];
  let selectedLevel = COMPARISON_LEVELS[COMPARISON_LEVELS.length - 1];
  let levelIndex = COMPARISON_LEVELS.length - 1;

  for (let index = 0; index < COMPARISON_LEVELS.length; index += 1) {
    const level = COMPARISON_LEVELS[index];
    const candidates = modelMatches.filter((item) =>
      fitsComparisonLevel(item, vehicle, level)
    );
    selected = candidates;
    selectedLevel = level;
    levelIndex = index;
    if (candidates.length >= MIN_SUFFICIENT_SAMPLE) break;
  }

  return {
    comparables: selected.slice(0, MAX_COMPARABLES),
    excludedVariantCount:
      (Array.isArray(comparables) ? comparables.length : 0) -
      modelMatches.length,
    selection: {
      yearTolerance: selectedLevel.yearTolerance,
      mileageTolerance: selectedLevel.mileageTolerance,
      expanded: levelIndex > 0,
      sufficientSample: selected.length >= MIN_SUFFICIENT_SAMPLE,
    },
  };
}

export function calculateMinimumMargin(salePrice) {
  const price = positiveNumber(salePrice);
  if (!price) return 0;
  return price > 300000 ? Math.round(price * 0.1) : 30000;
}

export function calculatePriceRecommendation(comparables, preparationCosts = 0) {
  const prices = (Array.isArray(comparables) ? comparables : [])
    .map((item) => positiveNumber(item?.price))
    .filter(Boolean)
    .sort((left, right) => left - right);

  if (prices.length === 0) {
    throw new PriceRecommendationAiError(
      "insufficient-data",
      "Na Sauto se nepodařilo najít porovnatelné inzeráty s platnou cenou."
    );
  }

  const middle = Math.floor(prices.length / 2);
  const rawMedian =
    prices.length % 2 === 0
      ? (prices[middle - 1] + prices[middle]) / 2
      : prices[middle];
  const recommendedSalePrice = Math.round(rawMedian / 1000) * 1000;
  const minimumMargin = calculateMinimumMargin(recommendedSalePrice);
  const normalizedPreparationCosts = Math.round(
    nonNegativeNumber(preparationCosts)
  );
  const recommendedPurchasePrice = Math.max(
    0,
    recommendedSalePrice - minimumMargin - normalizedPreparationCosts
  );

  return {
    medianPrice: rawMedian,
    recommendedSalePrice,
    recommendedPurchasePrice,
    minimumMargin,
    preparationCosts: normalizedPreparationCosts,
  };
}

export function buildPriceRecommendationPayload(context) {
  const profile = context?.profile || {};
  const identity = profile.identity || {};
  const technical = profile.technical || {};
  const purchaseEconomy = context?.internal?.purchaseEconomy || {};
  const payload = {
    vehicle: {
      brand: text(identity.brand, 100),
      model: text(identity.model, 100),
      version: text(identity.version || technical.version, 120),
      year: text(technical.productionYear || technical.year, 20),
      firstRegistration: text(technical.firstRegistration, 30),
      mileage: positiveNumber(technical.mileage),
      engine: text(technical.engine, 140),
      displacement: text(technical.displacement, 40),
      powerKw: positiveNumber(technical.powerKw),
      fuel: text(technical.fuel, 60),
      transmission: text(technical.transmission, 100),
      drive: text(technical.drive, 80),
      bodyType: text(technical.bodyType, 80),
    },
    preparationCosts: nonNegativeNumber(purchaseEconomy.totalCosts),
  };

  if (!payload.vehicle.brand || !payload.vehicle.model) {
    throw new PriceRecommendationAiError(
      "missing-data",
      "Pro nacenění doplňte značku a model vozidla."
    );
  }

  if (!payload.vehicle.year && !payload.vehicle.firstRegistration) {
    throw new PriceRecommendationAiError(
      "missing-data",
      "Pro nacenění doplňte rok výroby nebo první registraci."
    );
  }

  return payload;
}

function isSautoUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "sauto.cz" || url.hostname.endsWith(".sauto.cz"))
    );
  } catch {
    return false;
  }
}

function validateComparable(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const comparable = {
    title: text(value.title, 180),
    url: text(value.url, 500),
    price: positiveNumber(value.price),
    year: text(value.year, 20),
    mileage: positiveNumber(value.mileage),
    matchReason: text(value.matchReason, 300),
  };
  if (!comparable.title || !comparable.price || !isSautoUrl(comparable.url)) {
    return null;
  }
  return comparable;
}

export function validatePriceRecommendationOutput(
  value,
  preparationCosts = 0,
  vehicle = {}
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PriceRecommendationAiError(
      "invalid-response",
      "AI služba vrátila neplatný výsledek nacenění."
    );
  }

  const seenUrls = new Set();
  const validatedComparables = (Array.isArray(value.comparables) ? value.comparables : [])
    .map(validateComparable)
    .filter((item) => {
      if (!item || seenUrls.has(item.url)) return false;
      seenUrls.add(item.url);
      return true;
    });
  const selectionResult = selectComparableVehicles(
    validatedComparables,
    vehicle
  );
  const comparables = selectionResult.comparables;
  const calculation = calculatePriceRecommendation(
    comparables,
    preparationCosts
  );

  return {
    querySummary: text(value.querySummary, 500),
    comparables,
    sampleSize: comparables.length,
    confidence:
      comparables.length >= 8
        ? "high"
        : comparables.length >= 5
          ? "medium"
          : "low",
    warnings: [
      ...(Array.isArray(value.warnings) ? value.warnings : [])
        .map((warning) => text(warning, 300))
        .filter(Boolean)
        .slice(0, 5),
      ...(comparables.length < 5
        ? ["Výsledek vychází z malého počtu porovnatelných inzerátů."]
        : []),
      ...(selectionResult.excludedVariantCount > 0
        ? [
            `Vyřazeno ${selectionResult.excludedVariantCount} nabídek jiné modelové varianty.`,
          ]
        : []),
      ...(selectionResult.selection.expanded
        ? [
            `Kvůli malému vzorku bylo rozpětí rozšířeno na ±${selectionResult.selection.mileageTolerance.toLocaleString("cs-CZ")} km a ±${selectionResult.selection.yearTolerance} roky.`,
          ]
        : []),
      "Jde o nabídkové ceny z inzerce, nikoli potvrzené prodejní ceny.",
      "Samostatná riziková rezerva zatím není ve výpočtu zahrnuta.",
    ],
    selection: selectionResult.selection,
    ...calculation,
  };
}

async function getInvocationErrorDetails(error) {
  try {
    const response = error?.context;
    if (response && typeof response.json === "function") {
      const body = await response.json();
      return {
        code: text(body?.code, 50) || "unavailable",
        message: text(body?.detail || body?.error, 500) || error.message,
      };
    }
  } catch {
    // Původní chyba je užitečnější než chyba při čtení odpovědi.
  }
  return {
    code: "unavailable",
    message: error?.message || "Služba nacenění není dostupná.",
  };
}

export async function invokePriceRecommendationAi(
  payload,
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new PriceRecommendationAiError(
            "timeout",
            "Vyhledání porovnatelných vozů překročilo časový limit."
          )
        ),
      timeoutMs
    );
  });

  try {
    const response = await Promise.race([
      supabase.functions.invoke(FUNCTION_NAME, { body: payload }),
      timeout,
    ]);
    if (response?.error) {
      const details = await getInvocationErrorDetails(response.error);
      throw new PriceRecommendationAiError(details.code, details.message);
    }
    if (response?.data?.error) {
      throw new PriceRecommendationAiError(
        text(response.data.code, 50) || "unavailable",
        text(response.data.detail || response.data.error, 500)
      );
    }
    return validatePriceRecommendationOutput(
      response?.data?.output ?? response?.data,
      payload.preparationCosts,
      payload.vehicle
    );
  } catch (error) {
    if (error instanceof PriceRecommendationAiError) throw error;
    throw new PriceRecommendationAiError(
      "network",
      error instanceof Error
        ? `Službu nacenění se nepodařilo kontaktovat: ${error.message}`
        : "Službu nacenění se nepodařilo kontaktovat."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const priceRecommendationAiConstants = {
  functionName: FUNCTION_NAME,
  maxComparables: MAX_COMPARABLES,
  minSufficientSample: MIN_SUFFICIENT_SAMPLE,
  comparisonLevels: COMPARISON_LEVELS,
};

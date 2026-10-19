import { supabase } from "../supabase.js";
import {
  PriceRecommendationAiError,
  priceRecommendationCoreConstants,
  text,
  validatePriceRecommendationOutput,
} from "./priceRecommendationCore.js";

export {
  calculateMinimumMargin,
  calculatePriceRecommendation,
  PriceRecommendationAiError,
  selectComparableVehicles,
  validatePriceRecommendationOutput,
} from "./priceRecommendationCore.js";

const FUNCTION_NAME = "estimate-vehicle-market-price";
const DEFAULT_TIMEOUT_MS = 75000;

const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export function buildPriceRecommendationPayload(context) {
  const profile = context?.profile || {};
  const identity = profile.identity || {};
  const technical = profile.technical || {};
  const history = profile.history || {};
  const condition = profile.condition || {};
  const equipment = profile.equipment || {};
  const costs = Number(context?.internal?.purchaseEconomy?.totalCosts) || 0;
  const payload = {
    vehicle: {
      displayName: text(identity.name, 140),
      brand: text(identity.brand, 100),
      model: text(identity.model, 100),
      version: text(identity.version || technical.version, 140),
      equipmentLevel: text(technical.equipmentLevel, 100),
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
      origin: text(history.origin, 80),
      ownersCount: text(history.ownersCount, 30),
      equipment: Array.isArray(equipment.activeItems)
        ? equipment.activeItems.map((item) => text(item, 80)).filter(Boolean).slice(0, 20)
        : [],
      conditionSummary: text(
        [condition.publicDefects, condition.publicDamage?.overallCondition]
          .filter(Boolean).join("; "),
        300
      ),
    },
    preparationCosts: Math.max(0, costs),
  };
  if (!payload.vehicle.brand || !payload.vehicle.model) {
    throw new PriceRecommendationAiError("missing-data", "Pro nacenění doplňte značku a model vozidla.");
  }
  if (!payload.vehicle.year && !payload.vehicle.firstRegistration) {
    throw new PriceRecommendationAiError("missing-data", "Pro nacenění doplňte rok výroby nebo první registraci.");
  }
  return payload;
}

async function invocationError(error) {
  try {
    if (error?.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      return {
        code: text(body?.code, 50) || "unavailable",
        message: text(body?.detail || body?.error, 500) || error.message,
      };
    }
  } catch { /* zachováme původní chybu */ }
  return { code: "unavailable", message: error?.message || "Služba nacenění není dostupná." };
}

export async function invokePriceRecommendationAi(payload, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new PriceRecommendationAiError(
      "timeout", "Vyhledání porovnatelných vozů překročilo časový limit."
    )), timeoutMs);
  });
  try {
    const response = await Promise.race([
      supabase.functions.invoke(FUNCTION_NAME, { body: payload }),
      timeout,
    ]);
    if (response?.error) {
      const details = await invocationError(response.error);
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
      error instanceof Error ? `Službu nacenění se nepodařilo kontaktovat: ${error.message}` : "Službu nacenění se nepodařilo kontaktovat."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const priceRecommendationAiConstants = {
  functionName: FUNCTION_NAME,
  ...priceRecommendationCoreConstants,
};

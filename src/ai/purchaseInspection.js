import {
  ENGINE_CODE_INSPECTION_RULES,
  ENGINE_FAMILY_INSPECTION_RULES,
  MODEL_ENGINE_INSPECTION_RULES,
  MODEL_GENERATION_INSPECTION_RULES,
  TRANSMISSION_INSPECTION_RULES,
} from "./purchaseInspectionCatalog.js";

export const PURCHASE_INSPECTION_EMPTY_MESSAGE =
  "Pro tuto variantu zatím nemáme dostatek konkrétních modelových doporučení.";

const MAX_INSPECTION_ITEMS = 8;

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalize(value) {
  return hasValue(value)
    ? String(value)
        .trim()
        .toLocaleLowerCase("cs-CZ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    : "";
}

function normalizeEngineCode(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function includesAny(value, expectedValues) {
  const normalizedValue = normalize(value);
  return expectedValues.some((expected) =>
    normalizedValue.includes(normalize(expected))
  );
}

function matchesIdentity(identity, match) {
  return (
    (!match.brand || normalize(identity.brand) === normalize(match.brand)) &&
    (!match.model || normalize(identity.model) === normalize(match.model))
  );
}

function getVehicleYear(technical) {
  const value = technical.productionYear || technical.year || technical.firstRegistration;
  const match = String(value || "").match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function matchesRuleGroup(context, match) {
  const identity = context.profile?.identity || {};
  const technical = context.profile?.technical || {};
  const engineDescriptor = [
    technical.engine,
    technical.version,
    identity.version,
  ]
    .filter(hasValue)
    .join(" ");
  if (!matchesIdentity(identity, match)) return false;

  if (match.engineCodes) {
    const engineCode = normalizeEngineCode(technical.engineCode);
    if (
      !engineCode ||
      !match.engineCodes.some(
        (expected) => engineCode.startsWith(normalizeEngineCode(expected))
      )
    ) {
      return false;
    }
  }

  if (
    match.engineIncludes &&
    !includesAny(engineDescriptor, match.engineIncludes)
  ) {
    return false;
  }

  if (
    match.transmissionIncludes &&
    !includesAny(technical.transmission, match.transmissionIncludes)
  ) {
    return false;
  }

  if (match.driveIncludes && !includesAny(technical.drive, match.driveIncludes)) {
    return false;
  }

  if (match.minPowerKw || match.maxPowerKw) {
    const powerKw = Number(technical.powerKw);
    if (!Number.isFinite(powerKw)) return false;
    if (match.minPowerKw && powerKw < match.minPowerKw) return false;
    if (match.maxPowerKw && powerKw > match.maxPowerKw) return false;
  }

  if (match.minYear || match.maxYear) {
    const year = getVehicleYear(technical);
    if (!year) return false;
    if (match.minYear && year < match.minYear) return false;
    if (match.maxYear && year > match.maxYear) return false;
  }

  return true;
}

function collectRuleItems(context, groups) {
  return groups.flatMap((group) =>
    matchesRuleGroup(context, group.match) ? group.items : []
  );
}

function getKnownConditionItems(profile) {
  const damage = profile.condition?.publicDamage || {};
  const conditions = [
    profile.condition?.publicDefects,
    damage.overallCondition,
    damage.exterior,
    damage.interior,
    damage.technical,
    damage.tiresBrakes,
    damage.glassLights,
    damage.otherDamage,
  ]
    .filter(hasValue)
    .map((value) => String(value).trim());

  return [...new Set(conditions)].slice(0, 2).map((condition, index) => ({
    id: `known-condition-${index + 1}`,
    riskKey: `known-condition-${normalize(condition)}`,
    category: "knownCondition",
    priority: "critical",
    title: `Ověřit evidovaný stav: ${condition}`,
    reason:
      "Jde o konkrétní údaj evidovaný u tohoto vozu; při prohlídce je nutné ověřit jeho aktuální rozsah.",
    howToCheck:
      "Zaměřit se přímo na evidované místo, porovnat popis se skutečností a zapsat případnou odchylku.",
    specificity: {
      source: "vehicle-condition",
    },
  }));
}

function createItem(rule) {
  const publicRule = { ...rule };
  delete publicRule.riskKey;
  return { ...publicRule, status: "unchecked", note: "" };
}

function selectMostSpecificRules(rules) {
  const seenRiskKeys = new Set();
  const seenIds = new Set();

  return rules.filter((rule) => {
    const riskKey = normalize(rule.riskKey || rule.id);
    if (!rule.id || seenIds.has(rule.id) || seenRiskKeys.has(riskKey)) {
      return false;
    }
    seenIds.add(rule.id);
    seenRiskKeys.add(riskKey);
    return true;
  });
}

export function getPurchaseInspectionMissingData(context) {
  const missing = [];
  if (!hasValue(context?.profile?.identity?.brand)) missing.push("Značka vozidla");
  if (!hasValue(context?.profile?.identity?.model)) missing.push("Model vozidla");
  return missing;
}

export function buildPurchaseInspectionItems(context) {
  const profile = context?.profile || {};
  const orderedRules = [
    ...collectRuleItems(context, ENGINE_CODE_INSPECTION_RULES),
    ...collectRuleItems(context, MODEL_ENGINE_INSPECTION_RULES),
    ...collectRuleItems(context, MODEL_GENERATION_INSPECTION_RULES),
    ...collectRuleItems(context, ENGINE_FAMILY_INSPECTION_RULES),
    ...collectRuleItems(context, TRANSMISSION_INSPECTION_RULES),
    ...getKnownConditionItems(profile),
  ];

  return selectMostSpecificRules(orderedRules)
    .slice(0, MAX_INSPECTION_ITEMS)
    .map(createItem);
}

export function updatePurchaseInspectionItem(items, itemId, changes) {
  return items.map((item) =>
    item.id === itemId ? { ...item, ...changes } : item
  );
}

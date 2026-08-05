import {
  BASE_INSPECTION_RULES,
  MODEL_INSPECTION_RULES,
} from "./purchaseInspectionCatalog.js";

const MAX_INSPECTION_ITEMS = 12;

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalize(value) {
  return hasValue(value)
    ? String(value).trim().toLocaleLowerCase("cs-CZ")
    : "";
}

function includesAny(value, expressions) {
  const normalized = normalize(value);
  return expressions.some((expression) => normalized.includes(expression));
}

function createItem(rule) {
  return { ...rule, status: "unchecked", note: "" };
}

function getKnownConditionValues(profile) {
  const damage = profile.condition?.publicDamage || {};

  return [
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
}

function getConditionalRules(context) {
  const profile = context.profile || {};
  const technical = profile.technical || {};
  const rules = [];

  if (includesAny(technical.fuel, ["nafta", "diesel"] )) {
    rules.push({
      id: "diesel-emissions",
      category: "engine",
      priority: "critical",
      title: "Emisní systém vznětového motoru",
      reason:
        "Stav DPF, EGR nebo souvisejících prvků může upozornit na provozní či emisní problém.",
      howToCheck:
        "Ověřit kontrolky a diagnostiku, při jízdě sledovat výkon, kouřivost a případný nouzový režim.",
    });
  }

  if (includesAny(technical.transmission, ["automat", "dsg", "cvt", "dct"] )) {
    rules.push({
      id: "automatic-transmission",
      category: "testDrive",
      priority: "critical",
      title: "Řazení automatické převodovky",
      reason:
        "Prodleva, rázy nebo prokluz při řazení mohou upozornit na potřebu další kontroly převodovky.",
      howToCheck:
        "Vyzkoušet za studena i po zahřátí rozjezd, zpátečku a řazení při klidné i svižnější jízdě.",
    });
  }

  if (includesAny(technical.drive, ["4x4", "awd", "všech"] )) {
    rules.push({
      id: "all-wheel-drive",
      category: "testDrive",
      priority: "important",
      title: "Funkce pohonu všech kol",
      reason:
        "Vibrace nebo hluk při záběru může upozornit na problém některé části pohonu.",
      howToCheck:
        "Při bezpečné jízdě ověřit záběr bez vibrací a poslouchat hluk od převodů a náprav.",
    });
  }

  if (includesAny(technical.bodyType, ["dodáv", "van", "užitkov"] )) {
    rules.push(
      {
        id: "van-sliding-doors",
        category: "body",
        priority: "important",
        title: "Posuvné dveře a jejich vedení",
        reason:
          "U dodávkové karoserie jde o typické kontrolní místo namáhané častým používáním.",
        howToCheck:
          "Několikrát otevřít a zavřít posuvné dveře, ověřit zámky, dorazy a plynulost vedení.",
      },
      {
        id: "van-load-stress",
        category: "chassis",
        priority: "important",
        title: "Známky dlouhodobého zatěžování",
        reason:
          "U užitkového vozu může stav zadní části upozornit na dřívější přetěžování.",
        howToCheck:
          "Prohlédnout podlahu, prahy, zadní nápravu, pružiny a nerovnoměrné opotřebení pneumatik.",
      }
    );
  }

  getKnownConditionValues(profile).slice(0, 2).forEach((condition, index) => {
    rules.push({
      id: `known-condition-${index + 1}`,
      category: "body",
      priority: "critical",
      title: `Ověřit evidovaný stav: ${condition}`,
      reason:
        "Tento údaj je již u vozidla evidovaný, ale při fyzické prohlídce je nutné ověřit jeho aktuální rozsah.",
      howToCheck:
        "Porovnat evidovaný popis se skutečným stavem, pořídit fotografie a zapsat případné odchylky.",
    });
  });

  return rules;
}

function getModelRules(profile) {
  const key = normalize(
    `${profile.identity?.brand || ""} ${profile.identity?.model || ""}`
  );
  return MODEL_INSPECTION_RULES[key] || [];
}

function deduplicateRules(rules) {
  const seenIds = new Set();
  const seenTitles = new Set();

  return rules.filter((rule) => {
    const title = normalize(rule.title);
    if (!rule.id || seenIds.has(rule.id) || !title || seenTitles.has(title)) {
      return false;
    }
    seenIds.add(rule.id);
    seenTitles.add(title);
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
  const rules = [
    ...getModelRules(profile),
    ...getConditionalRules(context || {}),
    ...BASE_INSPECTION_RULES,
  ];

  return deduplicateRules(rules)
    .slice(0, MAX_INSPECTION_ITEMS)
    .map(createItem);
}

export function updatePurchaseInspectionItem(items, itemId, changes) {
  return items.map((item) =>
    item.id === itemId ? { ...item, ...changes } : item
  );
}

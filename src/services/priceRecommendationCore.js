const MAX_COMPARABLES = 16;
const MIN_SAMPLE = 5;
const LEVELS = [
  { yearTolerance: 1, mileageTolerance: 30000 },
  { yearTolerance: 1, mileageTolerance: 60000 },
  { yearTolerance: 2, mileageTolerance: 100000 },
  { yearTolerance: 3, mileageTolerance: 150000 },
];

export class PriceRecommendationAiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PriceRecommendationAiError";
    this.code = code;
  }
}

export function text(value, maxLength = 180) {
  return value === null || value === undefined
    ? ""
    : String(value).trim().slice(0, maxLength);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalize(value) {
  return text(value, 600).toLocaleLowerCase("cs-CZ").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function year(value) {
  const match = text(value, 30).match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function fuel(value) {
  const source = normalize(value);
  if (!source) return "";
  if (source.includes("lpg")) return "lpg";
  if (source.includes("hybrid")) return "hybrid";
  if (source.includes("elektr")) return "electric";
  if (source.includes("naft") || source.includes("diesel")) return "diesel";
  if (source.includes("benzin") || source.includes("petrol")) return "petrol";
  return source;
}

function transmission(value) {
  const source = normalize(value);
  if (!source) return "";
  if (/automat|dsg|edc|cvt/.test(source)) return "automatic";
  if (source.includes("manual")) return "manual";
  return source;
}

function marketplace(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === "sauto.cz" || host.endsWith(".sauto.cz")) return "sauto";
    if (host === "tipcars.com" || host.endsWith(".tipcars.com")) return "tipcars";
  } catch { return ""; }
  return "";
}

function tokens(value) {
  const ignored = new Set(["dacia", "renault", "skoda", "volkswagen", "auto", "cr", "dph", "top"]);
  return new Set(normalize(value).split(" ").filter((item) => item.length >= 2 && !ignored.has(item)));
}

function overlap(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count / Math.max(1, Math.min(a.size, b.size));
}

function matchesVehicle(item, vehicle) {
  const brand = normalize(vehicle.brand);
  const model = normalize(vehicle.model);
  const source = normalize(`${item.title} ${item.variant} ${item.url}`);
  const target = normalize(`${vehicle.displayName} ${vehicle.brand} ${vehicle.model} ${vehicle.version}`);
  if ((brand && !source.includes(brand)) || (model && !source.includes(model))) return false;
  if (model.includes("scenic") || target.includes("scenic")) {
    if (target.includes("grand scenic") !== source.includes("grand scenic")) return false;
  }
  const targetFuel = fuel(vehicle.fuel);
  const itemFuel = fuel(item.fuel);
  if (targetFuel && itemFuel && targetFuel !== itemFuel) return false;
  const targetGearbox = transmission(vehicle.transmission);
  const itemGearbox = transmission(item.transmission);
  if (targetGearbox && itemGearbox && targetGearbox !== itemGearbox) return false;
  const targetPower = number(vehicle.powerKw);
  const itemPower = number(item.powerKw);
  return !(targetPower && itemPower && Math.abs(itemPower - targetPower) / targetPower > 0.3);
}

function fitsLevel(item, vehicle, level) {
  const targetYear = year(vehicle.year || vehicle.firstRegistration);
  const itemYear = year(item.year);
  if (targetYear && (!itemYear || Math.abs(itemYear - targetYear) > level.yearTolerance)) return false;
  const targetMileage = number(vehicle.mileage);
  return !(targetMileage && (!item.mileage || Math.abs(item.mileage - targetMileage) > level.mileageTolerance));
}

function score(item, vehicle) {
  let result = 100;
  const targetYear = year(vehicle.year || vehicle.firstRegistration);
  const itemYear = year(item.year);
  result -= targetYear && itemYear ? Math.min(30, Math.abs(itemYear - targetYear) * 12) : targetYear ? 18 : 0;
  const targetMileage = number(vehicle.mileage);
  result -= targetMileage && item.mileage
    ? Math.min(35, Math.abs(item.mileage - targetMileage) / 10000 * 3)
    : targetMileage ? 20 : 0;
  const targetPower = number(vehicle.powerKw);
  const itemPower = number(item.powerKw);
  if (targetPower && itemPower) result -= Math.min(18, Math.abs(itemPower - targetPower) / targetPower * 45);
  const variantOverlap = overlap(`${vehicle.version} ${vehicle.engine} ${vehicle.equipmentLevel}`, `${item.variant} ${item.title} ${item.equipmentLevel}`);
  result += variantOverlap ? Math.min(5, variantOverlap * 5) : -10;
  if (vehicle.bodyType && item.bodyType && !overlap(vehicle.bodyType, item.bodyType)) result -= 10;
  return Math.max(1, Math.min(100, Math.round(result)));
}

function deduplicate(items) {
  const urls = new Set();
  const signatures = new Set();
  const output = [];
  for (const item of items) {
    const signature = [normalize(item.title).split(" ").slice(0, 5).join(" "), year(item.year), item.mileage ? Math.round(item.mileage / 100) : "", Math.round(item.price / 1000)].join("|");
    if (urls.has(item.url) || signatures.has(signature)) continue;
    urls.add(item.url);
    signatures.add(signature);
    output.push(item);
  }
  return { items: output, removed: items.length - output.length };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function removeOutliers(items) {
  if (items.length < 5) return { items, removed: 0 };
  const center = median(items.map((item) => item.price));
  const mad = median(items.map((item) => Math.abs(item.price - center)));
  const limit = Math.max(center * 0.18, mad * 3.5);
  const filtered = items.filter((item) => Math.abs(item.price - center) <= limit);
  return filtered.length >= 3
    ? { items: filtered, removed: items.length - filtered.length }
    : { items, removed: 0 };
}

function weightedQuantile(items, quantile) {
  const sorted = [...items].sort((a, b) => a.price - b.price);
  const total = sorted.reduce((sum, item) => sum + (item.qualityScore || 60) ** 2, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += (item.qualityScore || 60) ** 2;
    if (cumulative >= total * quantile) return item.price;
  }
  return sorted.at(-1)?.price || 0;
}

const round = (value) => Math.round(Number(value || 0) / 1000) * 1000;

export function selectComparableVehicles(comparables, vehicle = {}) {
  const input = Array.isArray(comparables) ? comparables : [];
  const matching = input.filter((item) => matchesVehicle(item, vehicle));
  let selected = [];
  let selectedLevel = LEVELS.at(-1);
  let levelIndex = LEVELS.length - 1;
  for (let index = 0; index < LEVELS.length; index += 1) {
    selectedLevel = LEVELS[index];
    selected = matching.filter((item) => fitsLevel(item, vehicle, selectedLevel));
    levelIndex = index;
    if (selected.length >= MIN_SAMPLE) break;
  }
  const scored = selected.map((item) => ({ ...item, qualityScore: score(item, vehicle) })).sort((a, b) => b.qualityScore - a.qualityScore);
  const unique = deduplicate(scored);
  const clean = removeOutliers(unique.items);
  return {
    comparables: clean.items.slice(0, MAX_COMPARABLES),
    excludedMismatchCount: input.length - matching.length,
    excludedVariantCount: input.length - matching.length,
    duplicateCount: unique.removed,
    outlierCount: clean.removed,
    selection: {
      yearTolerance: selectedLevel.yearTolerance,
      mileageTolerance: selectedLevel.mileageTolerance,
      expanded: levelIndex > 0,
      sufficientSample: clean.items.length >= MIN_SAMPLE,
    },
  };
}

export function calculateMinimumMargin(salePrice) {
  const price = number(salePrice);
  return price ? (price > 300000 ? Math.round(price * 0.1) : 30000) : 0;
}

export function calculatePriceRecommendation(comparables, preparationCosts = 0) {
  const items = (Array.isArray(comparables) ? comparables : []).filter((item) => number(item.price));
  if (!items.length) throw new PriceRecommendationAiError("insufficient-data", "Na Sauto ani TipCars se nepodařilo najít dostatečně porovnatelné aktivní nabídky.");
  const recommendedSalePrice = round(weightedQuantile(items, 0.5));
  const salePriceLow = round(weightedQuantile(items, 0.25));
  const salePriceHigh = round(weightedQuantile(items, 0.75));
  const averageQuality = Math.round(items.reduce((sum, item) => sum + (item.qualityScore || 60), 0) / items.length);
  const sourceCount = new Set(items.map((item) => item.source).filter(Boolean)).size;
  const spreadPercent = recommendedSalePrice ? (salePriceHigh - salePriceLow) / recommendedSalePrice : 1;
  const confidence = items.length >= 8 && sourceCount >= 2 && spreadPercent <= 0.2 && averageQuality >= 70
    ? "high" : items.length >= 5 && spreadPercent <= 0.3 && averageQuality >= 58 ? "medium" : "low";
  const riskReserve = round(Math.max(confidence === "high" ? 0 : confidence === "medium" ? 5000 : 10000, recommendedSalePrice * (confidence === "high" ? 0 : confidence === "medium" ? 0.015 : 0.03)));
  const costs = Math.max(0, Math.round(Number(preparationCosts) || 0));
  const purchase = (sale) => Math.max(0, sale - calculateMinimumMargin(sale) - costs - riskReserve);
  return {
    medianPrice: weightedQuantile(items, 0.5), recommendedSalePrice, salePriceLow, salePriceHigh,
    recommendedPurchasePrice: purchase(recommendedSalePrice), purchasePriceLow: purchase(salePriceLow), purchasePriceHigh: purchase(salePriceHigh),
    minimumMargin: calculateMinimumMargin(recommendedSalePrice), preparationCosts: costs, riskReserve,
    confidence, averageQuality, spreadPercent,
    sourceCounts: items.reduce((result, item) => ({ ...result, [item.source || "other"]: (result[item.source || "other"] || 0) + 1 }), {}),
  };
}

function validateComparable(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = marketplace(value.url);
  const item = {
    source, title: text(value.title), url: text(value.url, 600), price: number(value.price),
    year: text(value.year, 20), mileage: number(value.mileage), variant: text(value.variant, 140),
    fuel: text(value.fuel, 60), transmission: text(value.transmission, 80), powerKw: number(value.powerKw),
    bodyType: text(value.bodyType, 80), equipmentLevel: text(value.equipmentLevel, 100),
    sellerType: text(value.sellerType, 30), vatDeductible: value.vatDeductible === true,
    listingDate: text(value.listingDate, 30), matchReason: text(value.matchReason, 300),
  };
  return item.title && item.price && source && value.active !== false ? item : null;
}

export function validatePriceRecommendationOutput(value, preparationCosts = 0, vehicle = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PriceRecommendationAiError("invalid-response", "AI služba vrátila neplatný výsledek nacenění.");
  const valid = (Array.isArray(value.comparables) ? value.comparables : []).map(validateComparable).filter(Boolean);
  const selected = selectComparableVehicles(valid, vehicle);
  const calculation = calculatePriceRecommendation(selected.comparables, preparationCosts);
  const warnings = (Array.isArray(value.warnings) ? value.warnings : []).map((item) => text(item, 300)).filter(Boolean).slice(0, 6);
  if (selected.excludedMismatchCount) warnings.push(`Vyřazeno ${selected.excludedMismatchCount} nabídek kvůli jiné variantě, palivu, převodovce nebo výkonu.`);
  if (selected.duplicateCount) warnings.push(`Odstraněno ${selected.duplicateCount} duplicitních nabídek.`);
  if (selected.outlierCount) warnings.push(`Odstraněno ${selected.outlierCount} cenových odlehlostí.`);
  if (selected.comparables.length < MIN_SAMPLE) warnings.push("Výsledek vychází z malého počtu porovnatelných inzerátů.");
  if (selected.selection.expanded) warnings.push(`Rozpětí bylo rozšířeno na ±${selected.selection.mileageTolerance.toLocaleString("cs-CZ")} km a ±${selected.selection.yearTolerance} roky.`);
  warnings.push("Jde o nabídkové ceny, nikoli potvrzené realizované prodeje.");
  return { querySummary: text(value.querySummary, 600), comparables: selected.comparables, sampleSize: selected.comparables.length, warnings: [...new Set(warnings)], selection: selected.selection, ...calculation };
}

export const priceRecommendationCoreConstants = { maxComparables: MAX_COMPARABLES, minSufficientSample: MIN_SAMPLE, comparisonLevels: LEVELS };

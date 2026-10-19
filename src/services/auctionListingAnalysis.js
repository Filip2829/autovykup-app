const MAX_SOURCE_LENGTH = 30000;
const confidenceLevels = new Set(["high", "medium", "low"]);
const categories = new Set(["identity", "technical", "equipment", "condition", "history", "legal", "auction"]);

export class AuctionListingAnalysisError extends Error {
  constructor(code, message) { super(message); this.name = "AuctionListingAnalysisError"; this.code = code; }
}

const trim = (value, limit = 500) => value == null ? "" : String(value).trim().slice(0, limit);
const nullableNumber = (value) => value == null || value === "" ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const digits = (value) => value ? Number(String(value).replace(/[^0-9]/g, "")) : null;
const clean = (value) => trim(value, MAX_SOURCE_LENGTH).replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\r/g, "").replace(/[ \t]+/g, " ");
const unique = (values) => [...new Set(values.filter(Boolean).map((item) => trim(item, 300)))];
const match = (source, pattern) => source.match(pattern);
function normalizeDateTime(value) {
  const found = String(value || "").match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!found) return null;
  const [, day, month, year, hour = "00", minute = "00"] = found;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
}

export function validateAuctionListingAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuctionListingAnalysisError("invalid-response", "Čtečka vrátila neplatný výsledek.");
  if (!confidenceLevels.has(value.overallConfidence)) throw new AuctionListingAnalysisError("invalid-response", "Čtečka neuvedla platnou míru jistoty.");
  const facts = (Array.isArray(value.facts) ? value.facts : []).map((fact) => ({
    category: trim(fact?.category, 30), label: trim(fact?.label, 100), value: trim(fact?.value),
    evidence: trim(fact?.evidence), confidence: trim(fact?.confidence, 20),
  })).filter((fact) => categories.has(fact.category) && fact.label && fact.value && fact.evidence && confidenceLevels.has(fact.confidence)).slice(0, 80);
  const list = (items, limit) => unique(Array.isArray(items) ? items : []).slice(0, limit);
  return {
    overallConfidence: value.overallConfidence, confidenceReason: trim(value.confidenceReason, 600),
    identity: {
      brand: trim(value.identity?.brand, 80) || null, model: trim(value.identity?.model, 100) || null, trim: trim(value.identity?.trim, 140) || null,
      vin: trim(value.identity?.vin, 17) || null, year: nullableNumber(value.identity?.year), mileageKm: nullableNumber(value.identity?.mileageKm),
      fuel: trim(value.identity?.fuel, 80) || null, transmission: trim(value.identity?.transmission, 100) || null,
    },
    auction: { priceCzk: nullableNumber(value.auction?.priceCzk), auctionEndsAt: trim(value.auction?.auctionEndsAt, 40) || null, location: trim(value.auction?.location, 120) || null, sourceName: trim(value.auction?.sourceName, 120) || null },
    facts, equipment: list(value.equipment, 50), damages: list(value.damages, 30), risks: list(value.risks, 20), missingCritical: list(value.missingCritical, 20), warnings: list(value.warnings, 20),
  };
}

function addFact(facts, category, label, value, found, certainty = "high") {
  if (value == null || value === "" || !found) return;
  facts.push({ category, label, value: String(value), evidence: trim(found[0], 240), confidence: certainty });
}

export function extractAuctionListingLocally(sourceText) {
  const source = clean(sourceText);
  if (source.length < 80) throw new AuctionListingAnalysisError("insufficient-input", "Vložte alespoň základní text aukčního inzerátu.");
  const facts = [];
  const vinFound = match(source.toUpperCase(), /\b(?:VIN\s*[:#-]?\s*)?([A-HJ-NPR-Z0-9]{17})\b/);
  const mileageFound = match(source, /(?:nájezd|stav\s*(?:tachometru|km)|kilometry)\s*[:-]?\s*([\d .]{2,})\s*km\b/i) || match(source, /\b([1-9][\d .]{2,})\s*km\b/i);
  const yearFound = match(source, /(?:rok\s*(?:výroby)?|vyrobeno|modelový\s*rok)\s*[:-]?\s*((?:19|20)\d{2})\b/i);
  const registrationFound = match(source, /(?:první\s*registrace|1\.\s*registrace|datum\s*registrace)\s*[:-]?\s*(\d{1,2}[./-]\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
  const priceFound = match(source, /(?:aktuální\s*(?:cena|nabídka|příhoz)|aukční\s*cena|cena)\s*[:-]?\s*([\d .]{3,})\s*(?:Kč|CZK)/i);
  const endFound = match(source, /(?:konec|končí|ukončení)\s*(?:aukce)?\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4}(?:\s+\d{1,2}:\d{2})?)/i);
  const powerFound = match(source, /(?:výkon|power)\s*[:-]?\s*(\d{2,3})\s*kW\b/i);
  const capacityFound = match(source, /(?:objem|zdvihový\s*objem)\s*[:-]?\s*([\d .]{3,5})\s*(?:cm3|cm³|ccm)\b/i);
  const ownersFound = match(source, /(?:počet\s*(?:předchozích\s*)?majitelů|majitelé?)\s*[:-]?\s*(\d{1,2})\b/i);
  const keysFound = match(source, /(?:počet\s*)?klíč(?:e|ů)\s*[:-]?\s*(\d{1,2})\b/i);
  const stkFound = match(source, /(?:STK|technická\s*kontrola)\s*(?:platná)?\s*(?:do)?\s*[:-]?\s*(\d{1,2}[./-]\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
  const colorFound = match(source, /(?:barva|colour|color)\s*[:-]?\s*([^\n,;|]{3,40})/i);
  const locationFound = match(source, /(?:lokalita|umístění|místo\s*(?:prodeje|vozidla))\s*[:-]?\s*([^\n;|]{2,80})/i);
  const fuelFound = [["Benzín / LPG", /\b(?:LPG|benz[ií]n\s*\/\s*LPG)\b/i], ["Nafta", /\b(?:nafta|diesel)\b/i], ["Hybrid", /\b(?:hybrid|HEV|PHEV)\b/i], ["Elektro", /\b(?:elektro|electric|BEV)\b/i], ["Benzín", /\b(?:benz[ií]n|petrol)\b/i]].map(([value, pattern]) => [value, match(source, pattern)]).find(([, found]) => found);
  const transmissionFound = [["Automatická", /\b(?:automat(?:ická)?|EDC|CVT|DCT|DSG)\b/i], ["Manuální", /\b(?:manuální|manual)\b/i]].map(([value, pattern]) => [value, match(source, pattern)]).find(([, found]) => found);
  const brandFound = match(source, /\b(Renault|Dacia)\b/i);
  const brand = brandFound ? brandFound[1][0].toUpperCase() + brandFound[1].slice(1).toLowerCase() : null;
  const modelFound = brand ? match(source, new RegExp(`${brand}\\s+([A-Za-zÀ-ž0-9-]+(?:\\s+(?:Grand|Stepway|Grandtour|Van|Combi))?)`, "i")) : null;
  const vin = vinFound?.[1] || null; const mileageKm = digits(mileageFound?.[1]); const year = digits(yearFound?.[1]); const priceCzk = digits(priceFound?.[1]);
  addFact(facts, "identity", "značka", brand, brandFound); addFact(facts, "identity", "model", modelFound?.[1], modelFound); addFact(facts, "identity", "vin", vin, vinFound);
  addFact(facts, "identity", "rok výroby", year, yearFound); addFact(facts, "identity", "první registrace", registrationFound?.[1], registrationFound);
  addFact(facts, "identity", "barva", colorFound?.[1]?.trim(), colorFound); addFact(facts, "technical", "nájezd", mileageKm ? `${mileageKm} km` : null, mileageFound);
  addFact(facts, "technical", "palivo", fuelFound?.[0], fuelFound?.[1]); addFact(facts, "technical", "převodovka", transmissionFound?.[0], transmissionFound?.[1]);
  addFact(facts, "technical", "výkon", powerFound?.[1] ? `${powerFound[1]} kW` : null, powerFound); addFact(facts, "technical", "objem motoru", capacityFound?.[1] ? `${digits(capacityFound[1])} cm³` : null, capacityFound);
  addFact(facts, "history", "počet majitelů", ownersFound?.[1], ownersFound); addFact(facts, "legal", "počet klíčů", keysFound?.[1], keysFound); addFact(facts, "legal", "platnost STK", stkFound?.[1], stkFound);
  addFact(facts, "auction", "aukční cena", priceCzk ? `${priceCzk} Kč` : null, priceFound); addFact(facts, "auction", "konec aukce", endFound?.[1], endFound); addFact(facts, "auction", "lokalita", locationFound?.[1]?.trim(), locationFound);
  const equipmentPatterns = [
    ["Panoramatická střecha", /\b(?:panoramatická|panorama)\s*(?:střecha)?\b/i], ["LED světlomety", /\b(?:full\s*)?LED\s*(?:světla|světlomety)?\b/i],
    ["Adaptivní tempomat", /\badaptivní\s*tempomat|\bACC\b/i], ["Tempomat", /\btempomat\b/i], ["Automatická klimatizace", /\bautomatická\s*(?:dvouzonová\s*)?klimatizace|\bclimatronic\b/i],
    ["Vyhřívaná sedadla", /\bvyhřívan[áé]\s*(?:přední\s*)?sedadla\b/i], ["Navigace", /\bnavigace|navigační\s*systém\b/i], ["Parkovací kamera", /\b(?:zadní|parkovací|360°?)\s*kamera\b/i],
    ["Parkovací senzory", /\bparkovací\s*senzory\b/i], ["Tažné zařízení", /\btažné\s*zařízení\b/i], ["Bezklíčové odemykání", /\bbezklíčové|keyless\b/i],
    ["Hlídání mrtvého úhlu", /\bmrtv[ée]ho\s*úhlu|blind\s*spot\b/i], ["Apple CarPlay / Android Auto", /\bApple\s*CarPlay|Android\s*Auto\b/i], ["Kožené čalounění", /\bkožen[áé]\s*(?:sedadla|čalounění|interiér)\b/i],
  ];
  const equipment = [];
  for (const [label, pattern] of equipmentPatterns) {
    if (label === "Tempomat" && /adaptivní\s*tempomat/i.test(source)) continue;
    const found = match(source, pattern);
    if (found) { equipment.push(label); addFact(facts, "equipment", label, "uvedeno", found); }
  }
  const damageLines = source.split("\n").map((line) => line.trim()).filter((line) => /poškoz|škrában|oděrk|promáčk|prask|nehod|havári|nepojízd|závad|defekt/i.test(line)).slice(0, 20);
  const damages = unique(damageLines); damages.forEach((item) => addFact(facts, "condition", "uvedené poškození", item, [item]));
  const vatFound = match(source, /\b(?:odpočet\s*DPH|DPH\s*(?:odpočitatelné|deductible)|cena\s*bez\s*DPH)\b/i); if (vatFound) addFact(facts, "legal", "DPH", "možný odpočet / cena bez DPH uvedena", vatFound);
  const missingCritical = [];
  if (!vin) missingCritical.push("VIN"); if (!mileageKm) missingCritical.push("Přesný nájezd"); if (!priceCzk) missingCritical.push("Jednoznačná aukční cena"); if (!endFound) missingCritical.push("Konec aukce");
  if (!keysFound) missingCritical.push("Počet klíčů"); if (!stkFound) missingCritical.push("Platnost STK"); if (!/servis|servisní\s*kniha/i.test(source)) missingCritical.push("Servisní historie"); if (!/pojízd|provozuschop/i.test(source)) missingCritical.push("Provozuschopnost");
  const warnings = []; if (/bez\s*DPH/i.test(source) && /s\s*DPH/i.test(source)) warnings.push("Inzerát obsahuje cenu s DPH i bez DPH; ověřte použitou aukční cenu.");
  const ratio = facts.length / Math.max(1, facts.length + missingCritical.length);
  return validateAuctionListingAnalysis({
    overallConfidence: facts.length >= 10 && ratio >= .65 ? "high" : facts.length >= 5 ? "medium" : "low",
    confidenceReason: `${facts.length} údajů bylo nalezeno přímo v textu; ${missingCritical.length} důležitých údajů chybí.`,
    identity: { brand, model: modelFound?.[1] || null, trim: null, vin, year, mileageKm, fuel: fuelFound?.[0] || null, transmission: transmissionFound?.[0] || null },
    auction: { priceCzk, auctionEndsAt: normalizeDateTime(endFound?.[1]) || null, location: locationFound?.[1]?.trim() || null, sourceName: null },
    facts, equipment, damages, risks: warnings, missingCritical, warnings,
  });
}

export function applyAuctionAnalysisToForm(form, analysis) {
  const identity = analysis?.identity || {}; const auction = analysis?.auction || {};
  const confidenceByLabel = new Map((analysis?.facts || []).map((fact) => [fact.label.toLowerCase(), fact.confidence]));
  const safe = (label, value) => value && confidenceByLabel.get(label) !== "low" ? value : "";
  const city = String(auction.location || "").replace(/,?\s*(ČR|Česko|Czech Republic)$/i, "").trim();
  return { ...form, brand: ["Renault", "Dacia"].includes(identity.brand) ? identity.brand : form.brand,
    model: safe("model", identity.model) || form.model, trim: safe("verze", identity.trim) || form.trim, vin: safe("vin", identity.vin) || form.vin,
    year: safe("rok výroby", identity.year) || form.year, mileageKm: safe("nájezd", identity.mileageKm) || form.mileageKm, fuel: safe("palivo", identity.fuel) || form.fuel,
    transmission: safe("převodovka", identity.transmission) || form.transmission, priceCzk: safe("aukční cena", auction.priceCzk) || form.priceCzk,
    auctionEndsAt: String(safe("konec aukce", auction.auctionEndsAt) || "").slice(0, 16) || form.auctionEndsAt, locationCity: city || form.locationCity, sourceName: auction.sourceName || form.sourceName,
    positives: unique([...(form.positives ? form.positives.split("\n") : []), ...(analysis.equipment || []).slice(0, 8)]).join("\n"),
    negatives: unique([...(form.negatives ? form.negatives.split("\n") : []), ...(analysis.damages || []), ...(analysis.risks || [])]).slice(0, 20).join("\n"), extractionReport: analysis };
}

export async function analyzeAuctionListing(sourceText) { return extractAuctionListingLocally(sourceText); }
export const auctionListingAnalysisConstants = { maxSourceLength: MAX_SOURCE_LENGTH, processing: "local" };

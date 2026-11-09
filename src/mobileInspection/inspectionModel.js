export const INSPECTION_VERSION = 1;
export const technicalFields = [
  ["fuel", "Palivo", "Např. benzín"], ["engine", "Motorizace", "Např. 1.5 TSI"],
  ["powerKw", "Výkon (kW)", "110"], ["transmission", "Převodovka", "Manuální / automatická"],
  ["version", "Verze / výbava", "Např. Style"], ["drive", "Pohon", "Přední / 4×4"],
  ["bodyType", "Karoserie", "Např. kombi"], ["color", "Barva", "Např. modrá"],
  ["seats", "Počet míst", "5"], ["firstRegistration", "První registrace", ""],
  ["stkValidUntil", "STK do", ""],
];
export const priceFields = [
  ["customerExpectedPrice", "Představa zákazníka", "customer_expected_price"],
  ["customerExpectedPriceMax", "Představa zákazníka do", "customer_expected_price_max"],
  ["buyEstimate", "Návrh výkupu od", "buy_estimate"],
  ["buyEstimateMax", "Návrh výkupu do", "buy_estimate_max"],
  ["saleEstimate", "Prodejní cena od", "sale_estimate"],
  ["saleEstimateMax", "Prodejní cena do", "sale_estimate_max"],
  ["approvedPrice", "Schválená výkupní cena", "approved_price"],
  ["approvedPriceMax", "Schválená výkupní cena do", "approved_price_max"],
];
export const damageAreas = [
  ["exterior", "Karoserie"], ["interior", "Interiér"], ["technical", "Mechanika"],
  ["tiresBrakes", "Pneumatiky / brzdy"], ["glassLights", "Skla / světla"], ["otherDamage", "Ostatní"],
];
export const text = value => value == null ? "" : String(value).trim();
export const canonicalIdentity = value => text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
export function pragueDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(date);
}
export function readInspectionForm(car = {}) {
  const technical = car.technical_params || {};
  const contact = car.customer_info || {};
  return {
    brand: text(technical.brand), model: text(technical.model), vin: text(car.vin), spz: text(car.spz),
    year: text(car.year), km: text(car.km),
    ...Object.fromEntries(technicalFields.map(([key]) => [key, text(technical[key])])),
    customerName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    customerPhone: text(contact.phone), customerEmail: text(contact.email),
    ...Object.fromEntries(priceFields.map(([key, , dbKey]) => [key, text(car[dbKey])])),
    preparationCosts: text(car.damage_report?.repairCostEstimate),
    valuationDate: text(car.valuation_date) || pragueDate(),
  };
}
export function validateInspectionForm(form, { creating = false } = {}) {
  if (!text(form.brand) || !text(form.model)) return "Doplň značku a model vozu.";
  if (creating && !text(form.vin) && !text(form.spz)) return "Doplň alespoň VIN nebo SPZ, abychom vůz bezpečně poznali.";
  if (text(form.vin) && !/^[A-HJ-NPR-Z0-9]{17}$/.test(text(form.vin).toUpperCase())) return "VIN musí mít 17 znaků bez I, O a Q. Případně zatím vyplň pouze SPZ.";
  if (text(form.year) && (!/^\d{4}$/.test(text(form.year)) || Number(form.year) < 1886 || Number(form.year) > new Date().getFullYear() + 1)) return "Zkontroluj rok vozu.";
  if (text(form.km) && (!/^\d+$/.test(text(form.km)) || Number(form.km) > 5000000)) return "Nájezd zadej jako nezáporné celé číslo.";
  for (const key of [...priceFields.map(([key]) => key), "preparationCosts"]) {
    if (text(form[key]) && (!/^\d+(\.\d{1,2})?$/.test(text(form[key])) || Number(form[key]) > 100000000)) return "Ceny a náklady zadej jako nezápornou částku v Kč.";
  }
  for (const [min, max] of [["buyEstimate", "buyEstimateMax"], ["saleEstimate", "saleEstimateMax"], ["approvedPrice", "approvedPriceMax"], ["customerExpectedPrice", "customerExpectedPriceMax"]]) {
    if (text(form[max]) && (!text(form[min]) || Number(form[max]) < Number(form[min]))) return "Horní hranice ceny musí být stejná nebo vyšší než dolní.";
  }
  if (['saleEstimate','saleEstimateMax'].some(key => text(form[key]) && !Number.isInteger(Number(form[key])))) return 'Prodejní cenu zadej v celých Kč.';
  if (text(form.customerEmail) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(form.customerEmail))) return "Zkontroluj e-mail zákazníka.";
  return "";
}
export function changedFormFields(form, baseline) {
  return Object.fromEntries(Object.keys(readInspectionForm()).filter(key => text(form[key]) !== text(baseline[key])).map(key => [key, text(form[key])]));
}
const nullableNumber = value => text(value) === "" ? null : Number(value);
export function buildFormPatch(car, changes, baseline) {
  const current = readInspectionForm(car);
  const merged = { ...current, ...changes };
  const validation = validateInspectionForm(merged);
  if (validation) throw new Error(validation);
  for (const key of Object.keys(changes)) {
    if (!(key in current)) throw new Error("Neznámé pole prohlídky.");
    if (baseline && text(current[key]) !== text(baseline[key]) && text(current[key]) !== text(changes[key])) {
      throw new Error(`Údaj „${key}“ mezitím změnil kolega. Načti aktuální kartu a zkontroluj své změny.`);
    }
  }
  const patch = {};
  for (const [key, value] of Object.entries(changes)) {
    if (["vin", "spz"].includes(key)) patch[key] = text(value).toUpperCase();
    else if (key === "year") patch.year = text(value) || null;
    else if (key === "km") patch.km = nullableNumber(value);
    else if (key === "valuationDate") patch.valuation_date = value || null;
    else if (key === "preparationCosts") patch.damage_report = { ...car.damage_report, repairCostEstimate: nullableNumber(value) };
    else if (priceFields.some(([field]) => field === key)) {
      patch[priceFields.find(([field]) => field === key)[2]] = nullableNumber(value);
    } else if (["customerName", "customerPhone", "customerEmail"].includes(key)) {
      patch.customer_info ||= { ...car.customer_info };
      if (key === "customerName") Object.assign(patch.customer_info, { firstName: value, lastName: "" });
      if (key === "customerPhone") patch.customer_info.phone = value;
      if (key === "customerEmail") patch.customer_info.email = value;
    } else {
      patch.technical_params ||= { ...car.technical_params };
      patch.technical_params[key] = value;
    }
  }
  if ("brand" in changes || "model" in changes) patch.name = `${merged.brand} ${merged.model}`.trim();
  return patch;
}
export function buildNewInspection(form, { username, creationKey, now = new Date().toISOString() }) {
  const validation = validateInspectionForm(form, { creating: true });
  if (validation) throw new Error(validation);
  const patch = buildFormPatch({}, form);
  return {
    ...patch, name: `${text(form.brand)} ${text(form.model)}`, status: "valuation", lifecycle_stage: "valuation",
    deal_type: "buyout", created_by: username, updated_by: username, updated_at: now,
    technical_params: { ...patch.technical_params, mobileInspection: { version: INSPECTION_VERSION, creationKey, createdAt: now, completedAt: null } },
    photos: [], notes: [], equipment: {}, checklist: {}, technical_card_photos: [], cebia_files: [],
    customer_info: patch.customer_info || {},
  };
}
export function buildMarketPayload(car) {
  const f = readInspectionForm(car);
  const missing = [["brand", "značku"], ["model", "model"], ["year", "rok"], ["km", "nájezd"], ["fuel", "palivo"]].filter(([key]) => !text(f[key])).map(([, label]) => label);
  if (missing.length) throw new Error(`Před porovnáním doplň ${missing.join(", ")}.`);
  return {
    vehicle: {
      displayName: text(car.name), brand: f.brand, model: f.model, version: f.version,
      equipmentLevel: text(car.technical_params?.equipmentLevel), year: f.year, firstRegistration: f.firstRegistration,
      mileage: Number(f.km), engine: f.engine, displacement: text(car.technical_params?.displacement),
      powerKw: Number(f.powerKw) || null, fuel: f.fuel, transmission: f.transmission, drive: f.drive,
      bodyType: f.bodyType, seats: Number(f.seats) || null, origin: text(car.cebia_history?.origin), ownersCount: text(car.technical_params?.ownersCount),
      equipment: Object.entries(car.equipment || {}).filter(([, active]) => active === true).map(([key]) => key).slice(0, 20),
      conditionSummary: [car.damage_report?.overallCondition, ...damageAreas.map(([key]) => car.damage_report?.[key])].filter(Boolean).join("; ").slice(0, 300),
    },
    preparationCosts: Number(f.preparationCosts) || 0,
  };
}

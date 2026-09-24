import { supabase } from "../supabase.js";

export const tireSeasons = [
  { value: "summer", label: "Letní" },
  { value: "winter", label: "Zimní" },
  { value: "all_season", label: "Celoroční" },
];

export const tireAssemblyTypes = [
  { value: "tires_only", label: "Pouze pneumatiky" },
  { value: "steel_wheels", label: "Plechové disky" },
  { value: "alloy_wheels", label: "Lité disky" },
];

export const tireSetStatuses = [
  { value: "in_stock", label: "Skladem" },
  { value: "reserved", label: "Rezervováno" },
  { value: "retired", label: "Vyřazeno" },
];

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value) {
  return trimText(value) || null;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function mapTireSetRow(row = {}) {
  return {
    id: row.id ?? null,
    storageNumber: row.storage_number ?? "",
    name: row.name ?? "",
    tireSize: row.tire_size ?? "",
    treadDepthMm: row.tread_depth_mm ?? "",
    season: row.season ?? "winter",
    assemblyType: row.assembly_type ?? "tires_only",
    boltPattern: row.bolt_pattern ?? "",
    et: row.et ?? "",
    quantity: row.quantity ?? 4,
    status: row.status ?? "in_stock",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function mapTireSetToPayload(tireSet = {}) {
  const hasWheels = tireSet.assemblyType !== "tires_only";
  return {
    storage_number: nullableNumber(tireSet.storageNumber),
    name: trimText(tireSet.name),
    tire_size: trimText(tireSet.tireSize),
    tread_depth_mm: nullableNumber(tireSet.treadDepthMm),
    season: tireSet.season,
    assembly_type: tireSet.assemblyType,
    bolt_pattern: hasWheels ? nullableText(tireSet.boltPattern) : null,
    et: hasWheels ? nullableNumber(tireSet.et) : null,
    quantity: nullableNumber(tireSet.quantity),
    status: tireSet.status,
    notes: trimText(tireSet.notes),
  };
}

export function validateTireSet(tireSet = {}, existingSets = []) {
  const storageNumber = Number(tireSet.storageNumber);
  const quantity = Number(tireSet.quantity);
  const treadDepth = nullableNumber(tireSet.treadDepthMm);
  const et = nullableNumber(tireSet.et);

  if (!Number.isInteger(storageNumber) || storageNumber < 1 || storageNumber > 100) {
    return { valid: false, error: "Skladové číslo musí být celé číslo od 1 do 100." };
  }
  if (!trimText(tireSet.name)) {
    return { valid: false, error: "Vyplňte název pneumatik." };
  }
  if (!tireSeasons.some(({ value }) => value === tireSet.season)) {
    return { valid: false, error: "Vyberte platnou sezónu." };
  }
  if (!tireAssemblyTypes.some(({ value }) => value === tireSet.assemblyType)) {
    return { valid: false, error: "Vyberte platné provedení sady." };
  }
  if (!tireSetStatuses.some(({ value }) => value === tireSet.status)) {
    return { valid: false, error: "Vyberte platný stav sady." };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return { valid: false, error: "Počet kusů musí být celé číslo od 1 do 20." };
  }
  if (treadDepth !== null && treadDepth < 0) {
    return { valid: false, error: "Hloubka vzorku nesmí být záporná." };
  }
  if (tireSet.et !== "" && tireSet.et !== null && !Number.isInteger(et)) {
    return { valid: false, error: "ET musí být celé číslo." };
  }

  const numberOccupied = existingSets.some(
    (item) =>
      item.id !== tireSet.id &&
      item.status !== "retired" &&
      tireSet.status !== "retired" &&
      Number(item.storageNumber) === storageNumber
  );
  if (numberOccupied) {
    return { valid: false, error: `Skladové číslo ${storageNumber} už používá jiná sada.` };
  }

  return { valid: true, error: "" };
}

export function filterTireSets(tireSets = [], filters = {}) {
  const query = trimText(filters.query).toLocaleLowerCase("cs-CZ");
  return tireSets.filter((item) => {
    if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.season && filters.season !== "all" && item.season !== filters.season) return false;
    if (
      filters.assemblyType &&
      filters.assemblyType !== "all" &&
      item.assemblyType !== filters.assemblyType
    ) return false;
    if (!query) return true;

    return [item.storageNumber, item.name, item.tireSize, item.boltPattern, item.notes]
      .map((value) => String(value || "").toLocaleLowerCase("cs-CZ"))
      .some((value) => value.includes(query));
  });
}

function serviceError(action, error) {
  const detail = error?.message ? `: ${error.message}` : "";
  return new Error(`${action} se nepodařilo${detail}`);
}

export async function loadTireSets() {
  const { data, error } = await supabase
    .from("tire_sets")
    .select("*")
    .order("storage_number", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw serviceError("Načtení pneumatik", error);
  return (data || []).map(mapTireSetRow);
}

export async function createTireSet(tireSet) {
  const { data, error } = await supabase
    .from("tire_sets")
    .insert(mapTireSetToPayload(tireSet))
    .select()
    .single();
  if (error) throw serviceError("Vytvoření sady", error);
  return mapTireSetRow(data);
}

export async function updateTireSet(id, changes) {
  const { data, error } = await supabase
    .from("tire_sets")
    .update(mapTireSetToPayload(changes))
    .eq("id", id)
    .select()
    .single();
  if (error) throw serviceError("Uložení sady", error);
  return mapTireSetRow(data);
}

export async function retireTireSet(id) {
  const { data, error } = await supabase
    .from("tire_sets")
    .update({ status: "retired" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw serviceError("Vyřazení sady", error);
  return mapTireSetRow(data);
}

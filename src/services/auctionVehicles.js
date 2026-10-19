import { supabase } from "../supabase.js";

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function mapAuctionVehicleRow(row = {}) {
  return {
    id: row.id,
    dataStatus: "verified",
    brand: row.brand,
    model: row.model,
    trim: row.trim || "",
    year: row.year,
    mileageKm: row.mileage_km,
    fuel: row.fuel,
    transmission: row.transmission,
    location: row.location,
    priceCzk: row.price_czk,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    originalAuctionUrl: row.original_auction_url,
    vin: row.vin,
    auctionEndsAt: row.auction_ends_at,
    expectedSalePriceCzk: row.expected_sale_price_czk,
    auctionFeeCzk: row.auction_fee_czk || 0,
    transportCostCzk: row.transport_cost_czk || 0,
    preparationCostCzk: row.preparation_cost_czk || 0,
    targetProfitCzk: row.target_profit_czk || 30000,
    sourceSnapshot: row.source_snapshot || "",
    extractionReport: row.extracted_data || null,
    summary: row.summary,
    positives: row.positives || [],
    negatives: row.negatives || [],
    decision: row.decision || "undecided",
    createdManually: true,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAuctionVehicleToPayload(vehicle = {}) {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    trim: vehicle.trim || null,
    year: Number(vehicle.year),
    mileage_km: Number(vehicle.mileageKm),
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    location: vehicle.location,
    price_czk: Number(vehicle.priceCzk),
    source_name: vehicle.sourceName,
    source_url: vehicle.sourceUrl || null,
    original_auction_url: vehicle.originalAuctionUrl,
    vin: vehicle.vin || null,
    auction_ends_at: vehicle.auctionEndsAt || null,
    expected_sale_price_czk: nullableNumber(vehicle.expectedSalePriceCzk),
    auction_fee_czk: nullableNumber(vehicle.auctionFeeCzk) || 0,
    transport_cost_czk: nullableNumber(vehicle.transportCostCzk) || 0,
    preparation_cost_czk: nullableNumber(vehicle.preparationCostCzk) || 0,
    target_profit_czk: nullableNumber(vehicle.targetProfitCzk) || 30000,
    source_snapshot: vehicle.sourceSnapshot || null,
    extracted_data: vehicle.extractionReport || null,
    extraction_confidence: vehicle.extractionReport?.overallConfidence || null,
    extracted_at: vehicle.extractionReport ? new Date().toISOString() : null,
    summary: vehicle.summary,
    positives: vehicle.positives || [],
    negatives: vehicle.negatives || [],
    decision: vehicle.decision || "undecided",
    last_verified_at: vehicle.lastVerifiedAt || new Date().toISOString(),
  };
}

function serviceError(action, error) {
  return new Error(`${action} se nepodařilo${error?.message ? `: ${error.message}` : ""}`);
}

export async function loadAuctionVehicles() {
  const { data, error } = await supabase.from("auction_vehicles").select("*").order("created_at", { ascending: false });
  if (error) throw serviceError("Načtení aukcí", error);
  return (data || []).map(mapAuctionVehicleRow);
}

export async function createAuctionVehicle(vehicle) {
  const { data, error } = await supabase.from("auction_vehicles").insert(mapAuctionVehicleToPayload(vehicle)).select().single();
  if (error) throw serviceError(error.code === "23505" ? "Nabídka se stejným VIN nebo odkazem už existuje" : "Uložení aukce", error);
  return mapAuctionVehicleRow(data);
}

export async function importLegacyAuctionVehicles(vehicles = []) {
  if (!vehicles.length) return;
  const payload = vehicles.map(mapAuctionVehicleToPayload);
  const { error } = await supabase.from("auction_vehicles").upsert(payload, {
    onConflict: "original_auction_url",
    ignoreDuplicates: true,
  });
  if (error) throw serviceError("Přenos dříve uložených aukcí", error);
}

export async function updateAuctionDecision(id, decision) {
  const { data, error } = await supabase.from("auction_vehicles").update({ decision }).eq("id", id).select().single();
  if (error) throw serviceError("Uložení rozhodnutí", error);
  return mapAuctionVehicleRow(data);
}

export async function deleteAuctionVehicle(id) {
  const { error } = await supabase.from("auction_vehicles").delete().eq("id", id);
  if (error) throw serviceError("Odstranění aukce", error);
}

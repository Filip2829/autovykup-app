import { supabase } from "../supabase.js";

export const PRICE_RECOMMENDATION_CACHE_MS = 12 * 60 * 60 * 1000;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
  );
}

export function createPriceRecommendationInputHash(payload) {
  const source = JSON.stringify(stableValue(payload));
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function mapSnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    vehicleId: row.car_id,
    inputHash: row.input_hash,
    output: row.result,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
  };
}

export function createPriceRecommendationSnapshotStore(client = supabase) {
  async function findFresh(vehicleId, payload, now = new Date()) {
    const { data, error } = await client
      .from("vehicle_price_recommendations")
      .select("id,car_id,input_hash,result,generated_at,expires_at")
      .eq("car_id", vehicleId)
      .eq("input_hash", createPriceRecommendationInputHash(payload))
      .gt("expires_at", now.toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return mapSnapshot(data);
  }

  async function save(vehicleId, payload, output, now = new Date()) {
    const generatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + PRICE_RECOMMENDATION_CACHE_MS).toISOString();
    const { data, error } = await client
      .from("vehicle_price_recommendations")
      .insert({
        car_id: vehicleId,
        input_hash: createPriceRecommendationInputHash(payload),
        result: output,
        generated_at: generatedAt,
        expires_at: expiresAt,
      })
      .select("id,car_id,input_hash,result,generated_at,expires_at")
      .single();
    if (error) throw error;
    return mapSnapshot(data);
  }

  async function list(vehicleId, limit = 6) {
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 6));
    const { data, error } = await client
      .from("vehicle_price_recommendations")
      .select("id,car_id,input_hash,result,generated_at,expires_at")
      .eq("car_id", vehicleId)
      .order("generated_at", { ascending: false })
      .limit(safeLimit);
    if (error) throw error;
    return (data || []).map(mapSnapshot);
  }

  return { findFresh, save, list };
}

export const priceRecommendationSnapshots = createPriceRecommendationSnapshotStore();


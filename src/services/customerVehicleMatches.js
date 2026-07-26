import { supabase } from "../supabase.js";
import { mapCustomerRow } from "./customers.js";
import { mapCustomerDemandRow } from "./customerDemands.js";

export const customerVehicleMatchStatuses = [
  { value: "new", label: "Nová" },
  { value: "reviewed", label: "Zkontrolovaná" },
  { value: "contacted", label: "Kontaktováno" },
  { value: "dismissed", label: "Zamítnutá" },
];

export const relevantVehicleMatchStatuses = [
  "approved_for_purchase",
  "purchased",
  "preparation",
  "ready_for_advertising",
  "advertised",
  "reserved",
];

const allowedMatchStatuses = new Set(
  customerVehicleMatchStatuses.map((status) => status.value)
);

const allowedStatusTransitions = {
  new: new Set(["reviewed", "contacted", "dismissed"]),
  reviewed: new Set(["contacted", "dismissed"]),
  contacted: new Set(),
  dismissed: new Set(),
};

const matchRelations = `
  *,
  customer:customers (
    id,
    first_name,
    last_name,
    phone,
    email,
    notes,
    status,
    last_contact_at,
    next_contact_at,
    created_at,
    updated_at
  ),
  demand:customer_demands (
    *
  ),
  car:cars (
    *
  )
`;

function relatedRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function mapCustomerVehicleMatchRow(row = {}) {
  const customer = relatedRow(row.customer);
  const demand = relatedRow(row.demand);
  const car = relatedRow(row.car);

  return {
    id: row.id ?? null,
    customerId: row.customer_id ?? null,
    customerDemandId: row.customer_demand_id ?? null,
    carId: row.car_id ?? null,
    score: Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
    level: row.level ?? "poor",
    matchedCriteria: Array.isArray(row.matched_criteria)
      ? row.matched_criteria
      : [],
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    failedCriteria: Array.isArray(row.failed_criteria)
      ? row.failed_criteria
      : [],
    status: row.status ?? "new",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    lastMatchedAt: row.last_matched_at ?? null,
    customer: customer ? mapCustomerRow(customer) : null,
    demand: demand ? mapCustomerDemandRow(demand) : null,
    car: car || null,
  };
}

export function mapCustomerVehicleMatchToPayload(match = {}) {
  return {
    customer_id: match.customerId,
    customer_demand_id: match.customerDemandId,
    car_id: match.carId,
    score: match.score,
    level: match.level,
    matched_criteria: match.matchedCriteria || [],
    warnings: match.warnings || [],
    failed_criteria: match.failedCriteria || [],
    last_matched_at: match.lastMatchedAt,
  };
}

function serviceError(action, error) {
  const detail = error?.message ? `: ${error.message}` : "";
  return new Error(`${action} se nepodařilo${detail}`);
}

function validateIdentifier(value, message) {
  if (!value) throw new Error(message);
}

export function canTransitionCustomerVehicleMatch(currentStatus, nextStatus) {
  return Boolean(allowedStatusTransitions[currentStatus]?.has(nextStatus));
}

export function createCustomerVehicleMatchesService(client = supabase) {
  return {
    async loadMatches({
      carId,
      customerId,
      customerDemandId,
      status,
      includeDismissed = false,
    } = {}) {
      let query = client
        .from("customer_vehicle_matches")
        .select(matchRelations);

      if (carId) query = query.eq("car_id", carId);
      if (customerId) query = query.eq("customer_id", customerId);
      if (customerDemandId) {
        query = query.eq("customer_demand_id", customerDemandId);
      }
      if (status) {
        if (!allowedMatchStatuses.has(status)) {
          throw new Error("Neplatný stav shody.");
        }
        query = query.eq("status", status);
      } else if (!includeDismissed) {
        query = query.neq("status", "dismissed");
      }

      const { data, error } = await query
        .order("score", { ascending: false })
        .order("last_matched_at", { ascending: false });

      if (error) throw serviceError("Načtení uložených shod", error);
      return (data || []).map(mapCustomerVehicleMatchRow);
    },

    async loadExistingMatches({ carId, customerDemandId } = {}) {
      let query = client
        .from("customer_vehicle_matches")
        .select(
          "id, customer_id, customer_demand_id, car_id, score, level, status"
        );

      if (carId) query = query.eq("car_id", carId);
      if (customerDemandId) {
        query = query.eq("customer_demand_id", customerDemandId);
      }

      const { data, error } = await query;
      if (error) throw serviceError("Načtení existujících shod", error);
      return (data || []).map(mapCustomerVehicleMatchRow);
    },

    async upsertMatches(matches) {
      if (!Array.isArray(matches) || matches.length === 0) return [];

      const payload = matches.map(mapCustomerVehicleMatchToPayload);
      const { data, error } = await client
        .from("customer_vehicle_matches")
        .upsert(payload, {
          onConflict: "customer_demand_id,car_id",
        })
        .select();

      if (error) throw serviceError("Uložení shod", error);
      return (data || []).map(mapCustomerVehicleMatchRow);
    },

    async deleteMatches(matchIds) {
      const ids = [...new Set((matchIds || []).filter(Boolean))];
      if (ids.length === 0) return;

      const { error } = await client
        .from("customer_vehicle_matches")
        .delete()
        .in("id", ids);

      if (error) throw serviceError("Odstranění neplatných shod", error);
    },

    async loadRelevantVehicles() {
      const { data, error } = await client
        .from("cars")
        .select("*")
        .in("status", relevantVehicleMatchStatuses);

      if (error) {
        throw serviceError("Načtení vozidel pro párování", error);
      }

      return data || [];
    },

    async countNewMatches() {
      const { count, error } = await client
        .from("customer_vehicle_matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");

      if (error) throw serviceError("Načtení počtu nových shod", error);
      return count || 0;
    },

    async updateMatchStatus(matchId, currentStatus, nextStatus) {
      validateIdentifier(matchId, "Pro změnu stavu chybí ID shody.");

      if (!allowedMatchStatuses.has(currentStatus)) {
        throw new Error("Současný stav shody není platný.");
      }
      if (!allowedMatchStatuses.has(nextStatus)) {
        throw new Error("Nový stav shody není platný.");
      }
      if (!canTransitionCustomerVehicleMatch(currentStatus, nextStatus)) {
        throw new Error("Tento přechod stavu shody není povolený.");
      }

      const { data, error } = await client
        .from("customer_vehicle_matches")
        .update({ status: nextStatus })
        .eq("id", matchId)
        .eq("status", currentStatus)
        .select(matchRelations)
        .single();

      if (error) throw serviceError("Změna stavu shody", error);
      return mapCustomerVehicleMatchRow(data);
    },
  };
}

const customerVehicleMatchesService = createCustomerVehicleMatchesService();

export function loadCustomerVehicleMatches(filters) {
  return customerVehicleMatchesService.loadMatches(filters);
}

export function loadExistingCustomerVehicleMatches(filters) {
  return customerVehicleMatchesService.loadExistingMatches(filters);
}

export function upsertCustomerVehicleMatches(matches) {
  return customerVehicleMatchesService.upsertMatches(matches);
}

export function deleteCustomerVehicleMatches(matchIds) {
  return customerVehicleMatchesService.deleteMatches(matchIds);
}

export function loadRelevantVehiclesForMatching() {
  return customerVehicleMatchesService.loadRelevantVehicles();
}

export function countNewCustomerVehicleMatches() {
  return customerVehicleMatchesService.countNewMatches();
}

export function updateCustomerVehicleMatchStatus(
  matchId,
  currentStatus,
  nextStatus
) {
  return customerVehicleMatchesService.updateMatchStatus(
    matchId,
    currentStatus,
    nextStatus
  );
}

import { buildVehicleProfile } from "../utils/buildVehicleProfile.js";
import { loadActiveCustomerDemandsWithCustomers } from "./customerDemands.js";
import {
  createCustomerVehicleMatchesService,
  relevantVehicleMatchStatuses,
} from "./customerVehicleMatches.js";
import { matchVehicleToDemand } from "./vehicleMatching.js";

const relevantStatusSet = new Set(relevantVehicleMatchStatuses);

function matchKey(customerDemandId, carId) {
  return `${customerDemandId}:${carId}`;
}

function isRelevantVehicleStatus(status) {
  return relevantStatusSet.has(String(status ?? "").trim());
}

function buildStoredMatch({
  vehicle,
  vehicleProfile,
  demand,
  result,
  matchedAt,
}) {
  return {
    customerId: demand.customerId,
    customerDemandId: demand.id,
    carId: vehicleProfile.identity.id,
    score: result.score,
    level: result.level,
    matchedCriteria: result.matchedCriteria,
    warnings: result.warnings,
    failedCriteria: result.failedCriteria,
    lastMatchedAt: matchedAt,
    customer: demand.customer || null,
    demand,
    car: vehicle,
  };
}

export function evaluateCustomerVehicleMatches({
  vehicles = [],
  demands = [],
  profileBuilder = buildVehicleProfile,
  matcher = matchVehicleToDemand,
  minimumScore = 50,
  matchedAt = new Date().toISOString(),
} = {}) {
  const results = [];

  vehicles.forEach((vehicle) => {
    const vehicleProfile = profileBuilder(vehicle);
    if (
      !vehicleProfile.identity.id
      || !isRelevantVehicleStatus(vehicleProfile.identity.status)
    ) {
      return;
    }

    demands.forEach((demand) => {
      if (!demand?.id || !demand?.customerId || demand.status !== "active") {
        return;
      }

      const result = matcher(vehicleProfile, demand);
      if (!result.isEligible || result.score < minimumScore) return;

      results.push(
        buildStoredMatch({
          vehicle,
          vehicleProfile,
          demand,
          result,
          matchedAt,
        })
      );
    });
  });

  return results;
}

export function planCustomerVehicleMatchReconciliation(
  desiredMatches = [],
  existingMatches = []
) {
  const existingByKey = new Map(
    existingMatches.map((match) => [
      matchKey(match.customerDemandId, match.carId),
      match,
    ])
  );
  const desiredKeys = new Set(
    desiredMatches.map((match) =>
      matchKey(match.customerDemandId, match.carId)
    )
  );
  const newMatches = desiredMatches.filter(
    (match) =>
      !existingByKey.has(matchKey(match.customerDemandId, match.carId))
  );
  const removedMatches = existingMatches.filter(
    (match) =>
      !desiredKeys.has(matchKey(match.customerDemandId, match.carId))
  );

  return {
    upsertMatches: desiredMatches,
    deleteMatchIds: removedMatches.map((match) => match.id).filter(Boolean),
    newMatches,
    createdCount: newMatches.length,
    updatedCount: desiredMatches.length - newMatches.length,
    removedCount: removedMatches.length,
  };
}

function buildMatchingSnapshot(car) {
  const profile = buildVehicleProfile(car);

  return {
    status: profile.identity.status,
    brand: profile.identity.brand,
    model: profile.identity.model,
    year: profile.technical.year,
    mileage: profile.technical.mileage,
    fuel: profile.technical.fuel,
    transmission: profile.technical.transmission,
    drive: profile.technical.drive,
    powerKw: profile.technical.powerKw,
    bodyType: profile.technical.bodyType,
    color: profile.technical.color,
    effectiveSalePrice: profile.pricing.effectiveSalePrice,
    equipment: profile.equipment.activeItems,
  };
}

export function hasVehicleMatchingRelevantChanges(previousCar, nextCar) {
  if (!previousCar || !nextCar) return true;
  return (
    JSON.stringify(buildMatchingSnapshot(previousCar))
    !== JSON.stringify(buildMatchingSnapshot(nextCar))
  );
}

export function createCustomerVehicleMatchSyncService({
  matchesService = createCustomerVehicleMatchesService(),
  loadActiveDemands = loadActiveCustomerDemandsWithCustomers,
  profileBuilder = buildVehicleProfile,
  matcher = matchVehicleToDemand,
  now = () => new Date().toISOString(),
} = {}) {
  async function reconcile(desiredMatches, existingMatches) {
    const plan = planCustomerVehicleMatchReconciliation(
      desiredMatches,
      existingMatches
    );

    await matchesService.upsertMatches(plan.upsertMatches);
    await matchesService.deleteMatches(plan.deleteMatchIds);

    return {
      createdCount: plan.createdCount,
      updatedCount: plan.updatedCount,
      removedCount: plan.removedCount,
      newMatches: plan.newMatches,
    };
  }

  return {
    async syncMatchesForVehicle(vehicle) {
      const profile = profileBuilder(vehicle);
      const carId = profile.identity.id;
      if (!carId) throw new Error("Pro párování chybí ID vozidla.");

      const existingMatches = await matchesService.loadExistingMatches({
        carId,
      });

      if (!isRelevantVehicleStatus(profile.identity.status)) {
        return reconcile([], existingMatches);
      }

      const demands = await loadActiveDemands();
      const desiredMatches = evaluateCustomerVehicleMatches({
        vehicles: [vehicle],
        demands,
        profileBuilder,
        matcher,
        matchedAt: now(),
      });

      return reconcile(desiredMatches, existingMatches);
    },

    async syncMatchesForDemand(demand) {
      if (!demand?.id) throw new Error("Pro párování chybí ID poptávky.");
      if (!demand?.customerId) {
        throw new Error("Pro párování chybí zákazník poptávky.");
      }

      const existingMatches = await matchesService.loadExistingMatches({
        customerDemandId: demand.id,
      });

      if (demand.status !== "active") {
        return reconcile([], existingMatches);
      }

      const vehicles = await matchesService.loadRelevantVehicles();
      const desiredMatches = evaluateCustomerVehicleMatches({
        vehicles,
        demands: [demand],
        profileBuilder,
        matcher,
        matchedAt: now(),
      });

      return reconcile(desiredMatches, existingMatches);
    },

    async syncAllCustomerVehicleMatches() {
      const [demands, vehicles, existingMatches] = await Promise.all([
        loadActiveDemands(),
        matchesService.loadRelevantVehicles(),
        matchesService.loadExistingMatches(),
      ]);
      const desiredMatches = evaluateCustomerVehicleMatches({
        vehicles,
        demands,
        profileBuilder,
        matcher,
        matchedAt: now(),
      });

      return reconcile(desiredMatches, existingMatches);
    },
  };
}

const customerVehicleMatchSyncService =
  createCustomerVehicleMatchSyncService();

export function syncMatchesForVehicle(vehicle) {
  return customerVehicleMatchSyncService.syncMatchesForVehicle(vehicle);
}

export function syncMatchesForDemand(demand) {
  return customerVehicleMatchSyncService.syncMatchesForDemand(demand);
}

export function syncAllCustomerVehicleMatches() {
  return customerVehicleMatchSyncService.syncAllCustomerVehicleMatches();
}

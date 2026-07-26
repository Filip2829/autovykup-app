import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  createCustomerVehicleMatchSyncService,
  evaluateCustomerVehicleMatches,
  hasVehicleMatchingRelevantChanges,
} from "./customerVehicleMatchSync.js"

const baseVehicle = {
  id: 101,
  name: "Škoda Octavia",
  status: "purchased",
  year: 2021,
  km: 60000,
  expectedSalePrice: 500000,
  technicalParams: {
    brand: "Škoda",
    model: "Octavia",
    bodyType: "Kombi",
    fuel: "Benzín",
    transmission: "Automatická",
    drive: "Přední",
    powerKw: 110,
    color: "Modrá",
  },
  equipment: {
    Navigace: true,
  },
}

const baseDemand = {
  id: "demand-1",
  customerId: "customer-1",
  title: "Rodinné kombi",
  status: "active",
  makes: ["Škoda"],
  models: [],
  bodyTypes: ["Kombi"],
  fuelTypes: [],
  transmissions: [],
  drivetrains: [],
  minPrice: null,
  maxPrice: 550000,
  minYear: null,
  maxYear: null,
  maxMileage: null,
  minPowerKw: null,
  maxPowerKw: null,
  requiredEquipment: [],
  preferredEquipment: [],
  preferredColors: [],
  excludedColors: [],
}

function createMemoryMatchesService({
  vehicles = [baseVehicle],
  existingMatches = [],
} = {}) {
  const calls = {
    loadExistingMatches: [],
    loadRelevantVehicles: 0,
    upsertMatches: [],
    deleteMatches: [],
  }
  const state = existingMatches.map((match) => ({ ...match }))

  return {
    calls,
    state,
    service: {
      async loadExistingMatches(filters = {}) {
        calls.loadExistingMatches.push(filters)
        return state.filter(
          (match) =>
            (!filters.carId || match.carId === filters.carId)
            && (
              !filters.customerDemandId
              || match.customerDemandId === filters.customerDemandId
            )
        )
      },
      async loadRelevantVehicles() {
        calls.loadRelevantVehicles += 1
        return vehicles
      },
      async upsertMatches(matches) {
        calls.upsertMatches.push(matches)
        matches.forEach((match) => {
          const index = state.findIndex(
            (item) =>
              item.customerDemandId === match.customerDemandId
              && item.carId === match.carId
          )

          if (index === -1) {
            state.push({
              ...match,
              id: `match-${state.length + 1}`,
              status: "new",
            })
          } else {
            const preservedStatus = state[index].status
            state[index] = {
              ...state[index],
              ...match,
              status: preservedStatus,
            }
          }
        })
        return matches
      },
      async deleteMatches(ids) {
        calls.deleteMatches.push(ids)
        ids.forEach((id) => {
          const index = state.findIndex((match) => match.id === id)
          if (index >= 0) state.splice(index, 1)
        })
      },
    },
  }
}

function createSync({
  vehicles,
  existingMatches,
  demands = [baseDemand],
} = {}) {
  const memory = createMemoryMatchesService({ vehicles, existingMatches })
  let demandLoads = 0
  const sync = createCustomerVehicleMatchSyncService({
    matchesService: memory.service,
    loadActiveDemands: async () => {
      demandLoads += 1
      return demands
    },
    now: () => "2026-07-26T12:00:00.000Z",
  })

  return {
    ...memory,
    sync,
    getDemandLoads: () => demandLoads,
  }
}

describe("customerVehicleMatchSync – vyhodnocení", () => {
  test("ukládá pouze způsobilé shody se skóre alespoň 50", () => {
    const matches = evaluateCustomerVehicleMatches({
      vehicles: [baseVehicle],
      demands: [
        baseDemand,
        {
          ...baseDemand,
          id: "demand-2",
          makes: ["Ford"],
        },
      ],
      matchedAt: "2026-07-26T12:00:00.000Z",
    })

    assert.equal(matches.length, 1)
    assert.equal(matches[0].customerDemandId, baseDemand.id)
    assert.ok(matches[0].score >= 50)
    assert.equal(matches[0].lastMatchedAt, "2026-07-26T12:00:00.000Z")
  })

  test("vozidla mimo povolené stavy nevyhodnocuje", () => {
    const matches = evaluateCustomerVehicleMatches({
      vehicles: [{ ...baseVehicle, status: "valuation" }],
      demands: [baseDemand],
    })

    assert.deepEqual(matches, [])
  })

  test("poznámka sama nevyvolá synchronizaci, relevantní údaj ano", () => {
    assert.equal(
      hasVehicleMatchingRelevantChanges(baseVehicle, {
        ...baseVehicle,
        notes: ["Interní poznámka"],
      }),
      false
    )
    assert.equal(
      hasVehicleMatchingRelevantChanges(baseVehicle, {
        ...baseVehicle,
        km: 70000,
      }),
      true
    )
  })
})

describe("customerVehicleMatchSync – idempotence a workflow", () => {
  test("opakovaná synchronizace nevytvoří duplicitu", async () => {
    const context = createSync()

    const first = await context.sync.syncMatchesForVehicle(baseVehicle)
    const second = await context.sync.syncMatchesForVehicle(baseVehicle)

    assert.equal(first.createdCount, 1)
    assert.equal(second.createdCount, 0)
    assert.equal(second.updatedCount, 1)
    assert.equal(context.state.length, 1)
    assert.equal(context.getDemandLoads(), 2)
  })

  test("při přepočtu zachová stav dismissed", async () => {
    const context = createSync({
      existingMatches: [
        {
          id: "match-1",
          customerId: "customer-1",
          customerDemandId: "demand-1",
          carId: 101,
          score: 80,
          level: "good",
          status: "dismissed",
        },
      ],
    })

    const result = await context.sync.syncMatchesForVehicle(baseVehicle)

    assert.equal(result.createdCount, 0)
    assert.equal(context.state[0].status, "dismissed")
    assert.equal(context.state.length, 1)
  })

  test("neplatnou shodu odstraní", async () => {
    const context = createSync({
      demands: [{ ...baseDemand, makes: ["Ford"] }],
      existingMatches: [
        {
          id: "match-1",
          customerId: "customer-1",
          customerDemandId: "demand-1",
          carId: 101,
          status: "new",
        },
      ],
    })

    const result = await context.sync.syncMatchesForVehicle(baseVehicle)

    assert.equal(result.removedCount, 1)
    assert.deepEqual(context.state, [])
  })

  test("vyřazení vozidla odstraní jeho uložené shody bez načtení poptávek", async () => {
    const context = createSync({
      existingMatches: [
        {
          id: "match-1",
          customerId: "customer-1",
          customerDemandId: "demand-1",
          carId: 101,
          status: "reviewed",
        },
      ],
    })

    const result = await context.sync.syncMatchesForVehicle({
      ...baseVehicle,
      status: "sold",
    })

    assert.equal(result.removedCount, 1)
    assert.equal(context.getDemandLoads(), 0)
  })

  test("pozastavení poptávky odstraní její uložené shody", async () => {
    const context = createSync({
      existingMatches: [
        {
          id: "match-1",
          customerId: "customer-1",
          customerDemandId: "demand-1",
          carId: 101,
          status: "contacted",
        },
      ],
    })

    const result = await context.sync.syncMatchesForDemand({
      ...baseDemand,
      status: "paused",
    })

    assert.equal(result.removedCount, 1)
    assert.equal(context.calls.loadRelevantVehicles, 0)
  })

  test("globální synchronizace načte každou datovou množinu pouze jednou", async () => {
    const context = createSync()

    const result = await context.sync.syncAllCustomerVehicleMatches()

    assert.equal(result.createdCount, 1)
    assert.equal(context.getDemandLoads(), 1)
    assert.equal(context.calls.loadRelevantVehicles, 1)
    assert.equal(context.calls.loadExistingMatches.length, 1)
    assert.equal(context.calls.upsertMatches.length, 1)
  })
})

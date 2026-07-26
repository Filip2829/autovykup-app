import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  canTransitionCustomerVehicleMatch,
  createCustomerVehicleMatchesService,
  mapCustomerVehicleMatchRow,
  mapCustomerVehicleMatchToPayload,
  relevantVehicleMatchStatuses,
} from "./customerVehicleMatches.js"

function createSupabaseMock(responses = []) {
  const calls = []
  let responseIndex = 0

  return {
    calls,
    client: {
      from(table) {
        const call = { table }
        calls.push(call)
        const builder = {
          select(columns, options) {
            call.select = columns
            call.selectOptions = options
            return builder
          },
          eq(column, value) {
            call.eq = [...(call.eq || []), [column, value]]
            return builder
          },
          neq(column, value) {
            call.neq = [...(call.neq || []), [column, value]]
            return builder
          },
          in(column, value) {
            call.in = [...(call.in || []), [column, value]]
            return builder
          },
          order(column, options) {
            call.order = [...(call.order || []), [column, options]]
            return builder
          },
          upsert(payload, options) {
            call.operation = "upsert"
            call.payload = payload
            call.upsertOptions = options
            return builder
          },
          update(payload) {
            call.operation = "update"
            call.payload = payload
            return builder
          },
          delete() {
            call.operation = "delete"
            return builder
          },
          single() {
            call.single = true
            return builder
          },
          then(resolve, reject) {
            const response = responses[responseIndex] || { data: [], error: null }
            responseIndex += 1
            return Promise.resolve(response).then(resolve, reject)
          },
        }

        return builder
      },
    },
  }
}

describe("customerVehicleMatches – mapování", () => {
  test("mapuje databázový řádek a související entity", () => {
    const match = mapCustomerVehicleMatchRow({
      id: "match-1",
      customer_id: "customer-1",
      customer_demand_id: "demand-1",
      car_id: 101,
      score: 82,
      level: "good",
      matched_criteria: [{ key: "make", message: "Shoda značky." }],
      warnings: [],
      failed_criteria: [],
      status: "new",
      customer: {
        id: "customer-1",
        first_name: "Jan",
        last_name: "Novák",
      },
      demand: {
        id: "demand-1",
        customer_id: "customer-1",
        title: "Kombi",
      },
      car: { id: 101, name: "Škoda Octavia" },
    })

    assert.equal(match.customerId, "customer-1")
    assert.equal(match.customer.firstName, "Jan")
    assert.equal(match.demand.title, "Kombi")
    assert.equal(match.carId, 101)
    assert.equal(match.car.name, "Škoda Octavia")
    assert.equal(match.score, 82)
  })

  test("upsert payload záměrně neobsahuje workflow status", () => {
    const payload = mapCustomerVehicleMatchToPayload({
      customerId: "customer-1",
      customerDemandId: "demand-1",
      carId: 101,
      score: 75,
      level: "good",
      status: "dismissed",
      matchedCriteria: [],
      warnings: [],
      failedCriteria: [],
      lastMatchedAt: "2026-07-26T12:00:00.000Z",
    })

    assert.equal(Object.hasOwn(payload, "status"), false)
    assert.equal(payload.customer_demand_id, "demand-1")
  })
})

describe("customerVehicleMatches – dotazy a workflow", () => {
  test("detail vozu načítá uložené nezamítnuté shody jedním dotazem", async () => {
    const mock = createSupabaseMock([{ data: [], error: null }])
    const service = createCustomerVehicleMatchesService(mock.client)

    await service.loadMatches({ carId: 101 })

    assert.equal(mock.calls.length, 1)
    assert.deepEqual(mock.calls[0].eq, [["car_id", 101]])
    assert.deepEqual(mock.calls[0].neq, [["status", "dismissed"]])
    assert.equal(mock.calls[0].order.length, 2)
  })

  test("dávkový upsert používá unikátní dvojici poptávka + vozidlo", async () => {
    const mock = createSupabaseMock([{ data: [], error: null }])
    const service = createCustomerVehicleMatchesService(mock.client)

    await service.upsertMatches([
      {
        customerId: "customer-1",
        customerDemandId: "demand-1",
        carId: 101,
        score: 90,
        level: "excellent",
        matchedCriteria: [],
        warnings: [],
        failedCriteria: [],
        lastMatchedAt: "2026-07-26T12:00:00.000Z",
      },
    ])

    assert.equal(mock.calls[0].operation, "upsert")
    assert.equal(
      mock.calls[0].upsertOptions.onConflict,
      "customer_demand_id,car_id"
    )
    assert.equal(Object.hasOwn(mock.calls[0].payload[0], "status"), false)
  })

  test("načte relevantní vozidla jedním filtrem stavů", async () => {
    const mock = createSupabaseMock([{ data: [], error: null }])
    const service = createCustomerVehicleMatchesService(mock.client)

    await service.loadRelevantVehicles()

    assert.deepEqual(mock.calls[0].in, [
      ["status", relevantVehicleMatchStatuses],
    ])
  })

  test("workflow povoluje pouze definované přechody", () => {
    assert.equal(canTransitionCustomerVehicleMatch("new", "reviewed"), true)
    assert.equal(canTransitionCustomerVehicleMatch("new", "contacted"), true)
    assert.equal(canTransitionCustomerVehicleMatch("reviewed", "dismissed"), true)
    assert.equal(canTransitionCustomerVehicleMatch("contacted", "new"), false)
    assert.equal(canTransitionCustomerVehicleMatch("dismissed", "reviewed"), false)
  })

  test("změna stavu filtruje ID i současný stav", async () => {
    const mock = createSupabaseMock([
      {
        data: {
          id: "match-1",
          customer_id: "customer-1",
          customer_demand_id: "demand-1",
          car_id: 101,
          score: 80,
          level: "good",
          status: "reviewed",
        },
        error: null,
      },
    ])
    const service = createCustomerVehicleMatchesService(mock.client)

    await service.updateMatchStatus("match-1", "new", "reviewed")

    assert.equal(mock.calls[0].operation, "update")
    assert.deepEqual(mock.calls[0].payload, { status: "reviewed" })
    assert.deepEqual(mock.calls[0].eq, [
      ["id", "match-1"],
      ["status", "new"],
    ])
  })

  test("neplatný přechod zastaví před databázovým dotazem", async () => {
    const mock = createSupabaseMock()
    const service = createCustomerVehicleMatchesService(mock.client)

    await assert.rejects(
      service.updateMatchStatus("match-1", "dismissed", "new"),
      /není povolený/
    )
    assert.equal(mock.calls.length, 0)
  })
})

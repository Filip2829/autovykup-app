import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createCustomerDemandsService,
  mapCustomerDemandChangesToPayload,
  mapCustomerDemandRow,
  mapCustomerDemandWithCustomer,
  normalizeDemandTextArray,
  validateCustomerDemand,
} from "./customerDemands.js";

function createSupabaseMock(response) {
  const calls = [];

  return {
    calls,
    client: {
      from(table) {
        const call = { table };
        calls.push(call);

        const builder = {
          select(columns) {
            call.select = columns ?? true;
            return builder;
          },
          eq(column, value) {
            call.eq = [...(call.eq || []), [column, value]];
            return builder;
          },
          order(column, options) {
            call.order = [column, options];
            return builder;
          },
          insert(payload) {
            call.operation = "insert";
            call.payload = payload;
            return builder;
          },
          update(payload) {
            call.operation = "update";
            call.payload = payload;
            return builder;
          },
          delete() {
            call.operation = "delete";
            return builder;
          },
          single() {
            call.single = true;
            return Promise.resolve(response);
          },
          then(resolve, reject) {
            return Promise.resolve(response).then(resolve, reject);
          },
        };

        return builder;
      },
    },
  };
}

const validDemand = {
  customerId: "customer-1",
  title: "Rodinné SUV",
  status: "active",
  priority: "high",
  notes: "Automatická převodovka",
  minPrice: "300000",
  maxPrice: "500000",
  makes: "Škoda, Toyota",
  models: ["Kodiaq"],
  minYear: "2020",
  maxYear: "2025",
  maxMileage: "100000",
  minPowerKw: "100",
  maxPowerKw: "160",
};

describe("customerDemands – mapování a normalizace", () => {
  test("mapuje databázový řádek do camelCase UI modelu", () => {
    const demand = mapCustomerDemandRow({
      id: "demand-1",
      customer_id: "customer-1",
      title: "Rodinné SUV",
      status: "paused",
      priority: "urgent",
      notes: null,
      min_price: 300000,
      max_price: 500000,
      makes: ["Škoda"],
      models: ["Kodiaq"],
      body_types: ["SUV"],
      fuel_types: ["Benzín"],
      transmissions: ["Automatická"],
      drivetrains: ["4x4"],
      min_year: 2020,
      max_year: 2025,
      max_mileage: 100000,
      min_power_kw: 100,
      max_power_kw: 160,
      required_equipment: ["Tažné zařízení"],
      preferred_equipment: ["Vyhřívaná sedadla"],
      preferred_colors: ["Modrá"],
      excluded_colors: ["Bílá"],
      created_at: "2026-07-26T08:00:00.000Z",
      updated_at: "2026-07-26T09:00:00.000Z",
    });

    assert.equal(demand.customerId, "customer-1");
    assert.equal(demand.priority, "urgent");
    assert.equal(demand.notes, "");
    assert.deepEqual(demand.requiredEquipment, ["Tažné zařízení"]);
    assert.equal(demand.maxMileage, 100000);
    assert.equal(demand.updatedAt, "2026-07-26T09:00:00.000Z");
  });

  test("trimuje, odstraňuje prázdné hodnoty a duplicity textových polí", () => {
    assert.deepEqual(
      normalizeDemandTextArray(" Škoda, Toyota; škoda\n , BMW "),
      ["Škoda", "Toyota", "BMW"]
    );
  });

  test("mapuje UI model do snake_case payloadu", () => {
    const payload = mapCustomerDemandChangesToPayload(validDemand);

    assert.equal(payload.customer_id, "customer-1");
    assert.equal(payload.title, "Rodinné SUV");
    assert.equal(payload.min_price, 300000);
    assert.equal(payload.max_mileage, 100000);
    assert.deepEqual(payload.makes, ["Škoda", "Toyota"]);
    assert.deepEqual(payload.models, ["Kodiaq"]);
  });

  test("mapuje číselnou hodnotu obsahující jen mezery na null", () => {
    assert.deepEqual(
      mapCustomerDemandChangesToPayload({
        minPrice: "   ",
        maxMileage: "\t",
      }),
      {
        min_price: null,
        max_mileage: null,
      }
    );
  });

  test("mapuje poptávku včetně souvisejícího zákazníka", () => {
    const demand = mapCustomerDemandWithCustomer({
      id: "demand-1",
      customer_id: "customer-1",
      title: "SUV",
      customer: {
        id: "customer-1",
        first_name: "Jan",
        last_name: "Novák",
        phone: "+420 777 123 456",
      },
    });

    assert.equal(demand.customer.firstName, "Jan");
    assert.equal(demand.customer.lastName, "Novák");
    assert.equal(demand.customer.phone, "+420 777 123 456");
  });
});

describe("customerDemands – validace", () => {
  test("odmítne prázdný název", () => {
    assert.equal(
      validateCustomerDemand({ ...validDemand, title: " " }).valid,
      false
    );
  });

  test("odmítne záporné hodnoty a obrácené rozsahy", () => {
    assert.equal(
      validateCustomerDemand({ ...validDemand, maxMileage: -1 }).valid,
      false
    );
    assert.equal(
      validateCustomerDemand({
        ...validDemand,
        minPrice: 600000,
        maxPrice: 500000,
      }).valid,
      false
    );
  });

  test("přijme platnou poptávku", () => {
    assert.deepEqual(validateCustomerDemand(validDemand), {
      valid: true,
      error: "",
    });
  });
});

describe("customerDemands – CRUD service", () => {
  test("načítá aktivní poptávky se zákazníky jedním dotazem", async () => {
    const mock = createSupabaseMock({
      data: [
        {
          id: "demand-1",
          customer_id: "customer-1",
          title: "SUV",
          status: "active",
          customer: {
            id: "customer-1",
            first_name: "Jan",
            last_name: "Novák",
          },
        },
      ],
      error: null,
    });
    const service = createCustomerDemandsService(mock.client);

    const demands =
      await service.loadActiveCustomerDemandsWithCustomers();

    assert.equal(mock.calls.length, 1);
    assert.deepEqual(mock.calls[0].eq, [["status", "active"]]);
    assert.equal(mock.calls[0].select.includes("customer:customers"), true);
    assert.equal(demands[0].customer.firstName, "Jan");
  });

  test("načítá pouze poptávky konkrétního customer_id", async () => {
    const mock = createSupabaseMock({
      data: [
        {
          id: "demand-1",
          customer_id: "customer-1",
          title: "SUV",
        },
      ],
      error: null,
    });
    const service = createCustomerDemandsService(mock.client);

    const demands = await service.loadCustomerDemands("customer-1");

    assert.equal(demands[0].customerId, "customer-1");
    assert.deepEqual(mock.calls[0].eq, [["customer_id", "customer-1"]]);
    assert.deepEqual(mock.calls[0].order, [
      "created_at",
      { ascending: false },
    ]);
  });

  test("vytváří poptávku s normalizovaným payloadem", async () => {
    const mock = createSupabaseMock({
      data: {
        id: "demand-1",
        customer_id: "customer-1",
        title: "Rodinné SUV",
        status: "active",
        priority: "high",
      },
      error: null,
    });
    const service = createCustomerDemandsService(mock.client);

    const created = await service.createCustomerDemand(validDemand);

    assert.equal(created.id, "demand-1");
    assert.equal(mock.calls[0].operation, "insert");
    assert.equal(mock.calls[0].payload.customer_id, "customer-1");
    assert.deepEqual(mock.calls[0].payload.makes, ["Škoda", "Toyota"]);
  });

  test("upravuje poptávku podle id bez změny customer_id", async () => {
    const mock = createSupabaseMock({
      data: {
        id: "demand-1",
        customer_id: "customer-1",
        title: "Rodinné SUV",
        status: "fulfilled",
        priority: "high",
      },
      error: null,
    });
    const service = createCustomerDemandsService(mock.client);

    const updated = await service.updateCustomerDemand(
      "demand-1",
      "customer-1",
      {
        ...validDemand,
        customerId: "customer-other",
        status: "fulfilled",
      }
    );

    assert.equal(updated.status, "fulfilled");
    assert.equal(mock.calls[0].operation, "update");
    assert.deepEqual(mock.calls[0].eq, [
      ["id", "demand-1"],
      ["customer_id", "customer-1"],
    ]);
    assert.equal("customer_id" in mock.calls[0].payload, false);
  });

  test("maže poptávku podle id", async () => {
    const mock = createSupabaseMock({ data: null, error: null });
    const service = createCustomerDemandsService(mock.client);

    await service.deleteCustomerDemand("demand-1", "customer-1");

    assert.equal(mock.calls[0].operation, "delete");
    assert.deepEqual(mock.calls[0].eq, [
      ["id", "demand-1"],
      ["customer_id", "customer-1"],
    ]);
  });

  test("bez customer_id neposílá update ani delete dotaz", async () => {
    const mock = createSupabaseMock({ data: null, error: null });
    const service = createCustomerDemandsService(mock.client);

    await assert.rejects(
      service.updateCustomerDemand("demand-1", "", validDemand),
      /chybí zákazník/
    );
    await assert.rejects(
      service.deleteCustomerDemand("demand-1", null),
      /chybí zákazník/
    );

    assert.equal(mock.calls.length, 0);
  });
});

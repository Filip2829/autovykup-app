import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  filterCustomers,
  mapCustomerChangesToPayload,
  mapCustomerRow,
  validateCustomer,
} from "./customers.js";

const customers = [
  {
    id: "1",
    firstName: "Jan",
    lastName: "Novák",
    phone: "+420 777 123 456",
    email: "Jan.Novak@example.cz",
    status: "active",
  },
  {
    id: "2",
    firstName: "Petra",
    lastName: "Svobodová",
    phone: "608 987 654",
    email: "petra@example.cz",
    status: "inactive",
  },
];

describe("customers – mapování", () => {
  test("mapuje databázový řádek na camelCase UI objekt", () => {
    assert.deepEqual(
      mapCustomerRow({
        id: "customer-1",
        first_name: "Jan",
        last_name: "Novák",
        phone: null,
        email: "jan@example.cz",
        notes: "Poznámka",
        status: "active",
        demand_date: "2026-08-04",
        last_contact_at: "2026-07-20T10:00:00.000Z",
        next_contact_at: null,
        created_at: "2026-07-01T10:00:00.000Z",
        updated_at: "2026-07-02T10:00:00.000Z",
      }),
      {
        id: "customer-1",
        firstName: "Jan",
        lastName: "Novák",
        phone: "",
        email: "jan@example.cz",
        notes: "Poznámka",
        status: "active",
        demandDate: "2026-08-04",
        lastContactAt: "2026-07-20T10:00:00.000Z",
        nextContactAt: null,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-02T10:00:00.000Z",
      }
    );
  });

  test("mapuje a trimuje UI změny na snake_case payload", () => {
    assert.deepEqual(
      mapCustomerChangesToPayload({
        firstName: "  Jan ",
        lastName: " Novák  ",
        phone: " +420 777 123 456 ",
        email: " jan@example.cz ",
        notes: " Poznámka ",
        status: "active",
        demandDate: "2026-08-04",
        lastContactAt: "",
      }),
      {
        first_name: "Jan",
        last_name: "Novák",
        phone: "+420 777 123 456",
        email: "jan@example.cz",
        notes: "Poznámka",
        status: "active",
        demand_date: "2026-08-04",
        last_contact_at: null,
      }
    );
  });

  test("starší zákazník bez data poptávky zůstává kompatibilní", () => {
    assert.equal(mapCustomerRow({ id: "customer-old" }).demandDate, null);
  });
});

describe("customers – vyhledávání a filtrace", () => {
  test("vyhledává podle jména", () => {
    assert.deepEqual(
      filterCustomers(customers, { query: "  novák ", status: "all" }).map(
        (customer) => customer.id
      ),
      ["1"]
    );
  });

  test("vyhledává e-mail bez ohledu na velikost písmen", () => {
    assert.deepEqual(
      filterCustomers(customers, {
        query: "JAN.NOVAK@EXAMPLE.CZ",
        status: "all",
      }).map((customer) => customer.id),
      ["1"]
    );
  });

  test("vyhledává telefon pouze podle číslic", () => {
    assert.deepEqual(
      filterCustomers(customers, {
        query: "777123",
        status: "all",
      }).map((customer) => customer.id),
      ["1"]
    );
  });

  test("filtruje podle statusu", () => {
    assert.deepEqual(
      filterCustomers(customers, { status: "inactive" }).map(
        (customer) => customer.id
      ),
      ["2"]
    );
  });
});

describe("customers – validace", () => {
  test("odmítne prázdného zákazníka", () => {
    assert.equal(
      validateCustomer({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        status: "active",
      }).valid,
      false
    );
  });

  test("přijme zákazníka pouze s telefonem", () => {
    assert.deepEqual(
      validateCustomer({
        firstName: "",
        lastName: "",
        phone: "+420 777 123 456",
        email: "",
        status: "active",
      }),
      { valid: true, error: "" }
    );
  });
});

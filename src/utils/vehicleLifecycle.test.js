import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  VEHICLE_LIFECYCLE_SECTIONS,
  VEHICLE_STATUSES_BY_SECTION,
  filterVehiclesByLifecycleSection,
  getVehicleLifecycleSection,
} from "./vehicleLifecycle.js";

describe("vehicleLifecycle – rozdělení evidence podle statusů", () => {
  test("každý současný status patří právě do jedné hlavní sekce", () => {
    const expectedSections = {
      valuation: "valuation",
      approved_for_purchase: "approved_purchase",
      purchased: "stock",
      commission: "stock",
      preparation: "stock",
      ready_for_advertising: "stock",
      advertised: "stock",
      reserved: "stock",
      sold: "sold",
      archived: "archived",
    };

    for (const [status, section] of Object.entries(expectedSections)) {
      assert.equal(getVehicleLifecycleSection(status), section);
      assert.equal(
        Object.values(VEHICLE_STATUSES_BY_SECTION).filter((statuses) =>
          statuses.includes(status)
        ).length,
        1
      );
    }
  });

  test("filtrování nezobrazí stejné vozidlo ve více sekcích", () => {
    const vehicles = Object.values(VEHICLE_STATUSES_BY_SECTION)
      .flat()
      .map((status, index) => ({ id: index + 1, status }));
    const visibleIds = Object.values(VEHICLE_LIFECYCLE_SECTIONS).flatMap(
      (section) =>
        filterVehiclesByLifecycleSection(vehicles, section).map(
          (vehicle) => vehicle.id
        )
    );

    assert.equal(visibleIds.length, vehicles.length);
    assert.equal(new Set(visibleIds).size, vehicles.length);
  });

  test("starší a neznámé statusy zůstávají bezpečně v evidenci", () => {
    assert.equal(
      getVehicleLifecycleSection("Výkupní cena potvrzena"),
      VEHICLE_LIFECYCLE_SECTIONS.APPROVED_PURCHASE
    );
    assert.equal(
      getVehicleLifecycleSection("Chybí podklady"),
      VEHICLE_LIFECYCLE_SECTIONS.VALUATION
    );
    assert.equal(
      getVehicleLifecycleSection(undefined),
      VEHICLE_LIFECYCLE_SECTIONS.VALUATION
    );
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeVehicleTechnicalIdentity,
  validateVehicleIdentityForMatching,
  validateVehicleTechnicalIdentity,
} from "./vehicleTechnicalValidation.js";

describe("vehicleTechnicalValidation", () => {
  test("přijme vyplněnou značku a model a ořízne mezery", () => {
    const result = validateVehicleTechnicalIdentity({
      brand: "  Dacia ",
      model: " Dokker  ",
      fuel: "Nafta",
    });

    assert.equal(result.valid, true);
    assert.equal(result.error, "");
    assert.deepEqual(result.normalized, {
      brand: "Dacia",
      model: "Dokker",
      fuel: "Nafta",
    });
  });

  test("odmítne chybějící značku", () => {
    const result = validateVehicleTechnicalIdentity({
      brand: "   ",
      model: "Dokker",
    });

    assert.equal(result.valid, false);
    assert.match(result.error, /značku/);
  });

  test("odmítne chybějící model", () => {
    const result = validateVehicleTechnicalIdentity({
      brand: "Dacia",
      model: "",
    });

    assert.equal(result.valid, false);
    assert.match(result.error, /model/);
  });

  test("bez technických parametrů vrátí bezpečnou chybu místo výjimky", () => {
    const result = validateVehicleTechnicalIdentity();

    assert.equal(result.valid, false);
    assert.deepEqual(result.normalized, {
      brand: "",
      model: "",
    });
  });

  test("normalizace zachová ostatní technické údaje", () => {
    assert.deepEqual(
      normalizeVehicleTechnicalIdentity({
        brand: " Škoda ",
        model: " Octavia ",
        powerKw: "110",
      }),
      {
        brand: "Škoda",
        model: "Octavia",
        powerKw: "110",
      }
    );
  });

  test("odmítne neúplné vozidlo ve stavu používaném pro CRM párování", () => {
    const result = validateVehicleIdentityForMatching(
      {
        status: "purchased",
        technicalParams: { brand: "Dacia", model: "" },
      },
      ["purchased"]
    );

    assert.equal(result.valid, false);
    assert.equal(result.skipped, false);
    assert.match(result.error, /model/);
  });

  test("starší záznam mimo CRM stavy zůstane kompatibilní", () => {
    const result = validateVehicleIdentityForMatching(
      {
        status: "valuation",
        technicalParams: {},
      },
      ["purchased"]
    );

    assert.deepEqual(result, {
      valid: true,
      error: "",
      skipped: true,
    });
  });
});

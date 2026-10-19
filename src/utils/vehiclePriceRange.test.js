import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildVehiclePriceRangePayload,
  formatVehiclePriceRange,
  readPriceRange,
  validateVehiclePriceRanges,
  vehiclePriceRangeFields,
} from "./vehiclePriceRange.js";

describe("cenové rozmezí vozidla", () => {
  test("starý záznam s jedinou cenou se načte beze změny", () => {
    const range = readPriceRange(
      { buy_estimate: 300000 },
      vehiclePriceRangeFields[0]
    );
    assert.deepEqual(range, { min: 300000, max: null });
    assert.equal(formatVehiclePriceRange(range.min, range.max), "300 000 Kč");
  });

  test("rozmezí se formátuje včetně obou hranic", () => {
    assert.equal(
      formatVehiclePriceRange(300000, 310000),
      "300 000–310 000 Kč"
    );
  });

  test("ukládací payload převádí prázdné hodnoty na null a čísla zachová", () => {
    const payload = buildVehiclePriceRangePayload({
      buyEstimate: "300000",
      buyEstimateMax: "310000",
      customerExpectedPrice: "275000",
      customerExpectedPriceMax: "",
    });
    assert.equal(payload.buy_estimate, 300000);
    assert.equal(payload.buy_estimate_max, 310000);
    assert.equal(payload.customer_expected_price, 275000);
    assert.equal(payload.customer_expected_price_max, null);
  });

  test("uložené rozmezí se po znovunačtení obnoví", () => {
    const payload = buildVehiclePriceRangePayload({
      saleEstimate: "420000",
      saleEstimateMax: "440000",
    });
    const range = readPriceRange(payload, vehiclePriceRangeFields[2]);
    assert.deepEqual(range, { min: 420000, max: 440000 });
  });

  test("odmítne obrácené rozmezí i horní hranici bez spodní", () => {
    assert.match(
      validateVehiclePriceRanges({ buyEstimate: 310000, buyEstimateMax: 300000 }),
      /vyšší nebo stejná/
    );
    assert.match(
      validateVehiclePriceRanges({ saleEstimate: "", saleEstimateMax: 400000 }),
      /vyplňte částku „Od“/
    );
  });

  test("platná jediná cena i platné rozmezí projdou", () => {
    assert.equal(validateVehiclePriceRanges({ approvedPrice: 300000 }), "");
    assert.equal(
      validateVehiclePriceRanges({ approvedPrice: 300000, approvedPriceMax: 310000 }),
      ""
    );
  });
});

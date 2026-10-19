import test from "node:test";
import assert from "node:assert/strict";
import { validatePriceRecommendationOutput } from "./priceRecommendationCore.js";

const vehicle = {
  displayName: "Renault Grand Scenic",
  brand: "Renault",
  model: "Scenic",
  version: "dCi 150 Intens",
  year: "2019",
  mileage: 181635,
  fuel: "Nafta",
  transmission: "Automatická",
  powerKw: 110,
};

function item(index, overrides = {}) {
  const source = index % 2 ? "sauto" : "tipcars";
  return {
    title: `Renault Grand Scenic dCi 150 Intens ${index}`,
    url: source === "sauto"
      ? `https://www.sauto.cz/osobni/detail/renault/grand-scenic/${index}`
      : `https://www.tipcars.com/renault-grand-scenic/osobni/nafta/${index}`,
    price: 300000 + index * 3000,
    year: "2019",
    mileage: 180000 + index * 500,
    variant: "Grand Scenic dCi 150 Intens",
    fuel: "Nafta",
    transmission: "Automatická",
    powerKw: 110,
    bodyType: "MPV",
    equipmentLevel: "Intens",
    sellerType: "dealer",
    active: true,
    matchReason: "Shodná motorizace a výbava.",
    ...overrides,
  };
}

test("combines both markets and produces transparent sale and purchase ranges", () => {
  const result = validatePriceRecommendationOutput(
    { comparables: Array.from({ length: 10 }, (_, index) => item(index + 1)) },
    12000,
    vehicle
  );

  assert.equal(result.sampleSize, 10);
  assert.ok(result.sourceCounts.sauto > 0);
  assert.ok(result.sourceCounts.tipcars > 0);
  assert.ok(result.salePriceLow <= result.recommendedSalePrice);
  assert.ok(result.recommendedSalePrice <= result.salePriceHigh);
  assert.ok(result.purchasePriceLow <= result.recommendedPurchasePrice);
  assert.ok(result.recommendedPurchasePrice <= result.purchasePriceHigh);
  assert.equal(result.confidence, "high");
  assert.equal(result.riskReserve, 0);
});

test("rejects a different fuel, regular Scenic and a statistical price outlier", () => {
  const comparables = [
    ...Array.from({ length: 7 }, (_, index) => item(index + 1)),
    item(20, { fuel: "Benzín" }),
    item(21, { title: "Renault Scenic dCi", variant: "Scenic dCi" }),
    item(22, { price: 900000 }),
  ];
  const result = validatePriceRecommendationOutput(
    { comparables },
    0,
    vehicle
  );

  assert.equal(result.comparables.some((entry) => entry.price === 900000), false);
  assert.ok(result.warnings.some((warning) => warning.includes("jiné variantě")));
  assert.ok(result.warnings.some((warning) => warning.includes("cenových odlehlostí")));
});

test("removes a cross-listed duplicate before calculation", () => {
  const original = item(1);
  const duplicate = {
    ...original,
    url: "https://www.tipcars.com/renault-grand-scenic/osobni/nafta/duplicate",
  };
  const result = validatePriceRecommendationOutput(
    { comparables: [original, duplicate, item(2), item(3), item(4), item(5)] },
    0,
    vehicle
  );

  assert.equal(result.sampleSize, 5);
  assert.ok(result.warnings.some((warning) => warning.includes("duplicitních")));
});

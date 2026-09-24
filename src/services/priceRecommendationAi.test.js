import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildVehicleAiContext } from "../ai/buildVehicleAiContext.js";
import { createVehicleAiService } from "./vehicleAi.js";
import {
  buildPriceRecommendationPayload,
  calculateMinimumMargin,
  calculatePriceRecommendation,
  selectComparableVehicles,
  validatePriceRecommendationOutput,
} from "./priceRecommendationAi.js";

const car = {
  id: 69,
  status: "valuation",
  name: "Dacia Dokker",
  year: 2019,
  km: 124000,
  technicalParams: {
    brand: "Dacia",
    model: "Dokker",
    version: "1.5 dCi",
    engine: "1.5 dCi",
    powerKw: 66,
    fuel: "Nafta",
    transmission: "Manuální",
    bodyType: "MPV",
  },
  postPurchaseCosts: {
    service: 10000,
    tires: 5000,
    cleaning: 2000,
  },
  customerInfo: {
    firstName: "Tajný zákazník",
    phone: "+420777111222",
  },
  purchasePrice: 190000,
  notes: ["Interní poznámka"],
};

function comparable(index, price) {
  return {
    title: `Dacia Dokker nabídka ${index}`,
    url: `https://www.sauto.cz/osobni/detail/dacia/dokker/${index}`,
    price,
    year: "2019",
    mileage: 120000 + index,
    matchReason: "Stejný model, rok a motorizace.",
  };
}

function scenicComparable(index, {
  grand = false,
  year = 2018,
  mileage = 181000,
  price = 250000,
} = {}) {
  const variant = grand ? "grand-scenic" : "scenic";
  return {
    title: `Renault ${grand ? "Grand Scénic" : "Scénic"} dCi nabídka ${index}`,
    url: `https://www.sauto.cz/osobni/detail/renault/${variant}/${index}`,
    price,
    year: String(year),
    mileage,
    matchReason: "Stejný model a podobný rok a nájezd.",
  };
}

describe("AI nacenění podle trhu", () => {
  test("marže je 30 000 Kč do 300 000 Kč včetně", () => {
    assert.equal(calculateMinimumMargin(250000), 30000);
    assert.equal(calculateMinimumMargin(300000), 30000);
  });

  test("nad 300 000 Kč je minimální marže 10 %", () => {
    assert.equal(calculateMinimumMargin(301000), 30100);
    assert.equal(calculateMinimumMargin(650000), 65000);
  });

  test("medián a výkupní cena se počítají deterministicky", () => {
    const result = calculatePriceRecommendation(
      [
        comparable(1, 240000),
        comparable(2, 250000),
        comparable(3, 260000),
        comparable(4, 270000),
      ],
      17000
    );

    assert.equal(result.medianPrice, 255000);
    assert.equal(result.recommendedSalePrice, 255000);
    assert.equal(result.minimumMargin, 30000);
    assert.equal(result.preparationCosts, 17000);
    assert.equal(result.recommendedPurchasePrice, 208000);
  });

  test("payload používá jen technické údaje a součet přípravy", () => {
    const payload = buildPriceRecommendationPayload(buildVehicleAiContext(car));
    const serialized = JSON.stringify(payload);

    assert.equal(payload.vehicle.brand, "Dacia");
    assert.equal(payload.vehicle.model, "Dokker");
    assert.equal(payload.vehicle.mileage, 124000);
    assert.equal(payload.preparationCosts, 17000);
    assert.doesNotMatch(
      serialized,
      /Tajný zákazník|\+420777111222|Interní poznámka|190000|purchasePrice/
    );
  });

  test("vyžaduje značku, model a rok nebo registraci", () => {
    assert.throws(
      () =>
        buildPriceRecommendationPayload(
          buildVehicleAiContext({ id: 1, status: "valuation" })
        ),
      /značku a model/i
    );
    assert.throws(
      () =>
        buildPriceRecommendationPayload(
          buildVehicleAiContext({
            id: 1,
            status: "valuation",
            technicalParams: { brand: "Dacia", model: "Dokker" },
          })
        ),
      /rok výroby nebo první registraci/i
    );
  });

  test("propustí nejvýše 10 unikátních Sauto inzerátů", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      comparable(index + 1, 220000 + index * 5000)
    );
    items.push(items[0]);
    items.push({ ...comparable(99, 250000), url: "https://example.com/auto" });

    const result = validatePriceRecommendationOutput(
      { querySummary: "Test", comparables: items, warnings: [] },
      10000
    );

    assert.equal(result.comparables.length, 10);
    assert.equal(new Set(result.comparables.map((item) => item.url)).size, 10);
    assert.ok(result.comparables.every((item) => item.url.includes("sauto.cz")));
    assert.equal(result.confidence, "high");
  });

  test("běžný Scenic nikdy nesmíchá s Grand Scenic", () => {
    const input = [
      scenicComparable(1),
      scenicComparable(2, { mileage: 170000 }),
      scenicComparable(3, { mileage: 190000 }),
      scenicComparable(4, { year: 2017 }),
      scenicComparable(5, { year: 2019 }),
      scenicComparable(6, { grand: true }),
    ];
    const result = selectComparableVehicles(input, {
      brand: "Renault",
      model: "Scenic",
      year: "2018",
      mileage: 181635,
    });

    assert.equal(result.comparables.length, 5);
    assert.equal(result.excludedVariantCount, 1);
    assert.ok(result.comparables.every((item) => !item.title.includes("Grand")));
    assert.equal(result.selection.mileageTolerance, 35000);
    assert.equal(result.selection.expanded, false);
  });

  test("Grand Scenic používá pouze prodlouženou variantu", () => {
    const input = [
      scenicComparable(1, { grand: true }),
      scenicComparable(2, { grand: true, mileage: 170000 }),
      scenicComparable(3, { grand: true, mileage: 190000 }),
      scenicComparable(4, { grand: true, year: 2017 }),
      scenicComparable(5, { grand: true, year: 2019 }),
      scenicComparable(6),
    ];
    const result = selectComparableVehicles(input, {
      brand: "Renault",
      model: "Grand Scenic",
      year: "2018",
      mileage: 181635,
    });

    assert.equal(result.comparables.length, 5);
    assert.ok(result.comparables.every((item) => item.title.includes("Grand")));
    assert.equal(result.excludedVariantCount, 1);
  });

  test("začne na roku ±1 a nájezdu ±35 000 km", () => {
    const input = [
      scenicComparable(1, { year: 2017, mileage: 146635 }),
      scenicComparable(2, { year: 2018, mileage: 181635 }),
      scenicComparable(3, { year: 2019, mileage: 216635 }),
      scenicComparable(4, { year: 2018, mileage: 180000 }),
      scenicComparable(5, { year: 2017, mileage: 190000 }),
      scenicComparable(6, { year: 2016, mileage: 181635 }),
      scenicComparable(7, { year: 2018, mileage: 216636 }),
    ];
    const result = selectComparableVehicles(input, {
      brand: "Renault",
      model: "Scenic",
      year: "2018",
      mileage: 181635,
    });

    assert.deepEqual(
      result.comparables.map((item) => item.url),
      input.slice(0, 5).map((item) => item.url)
    );
    assert.deepEqual(result.selection, {
      yearTolerance: 1,
      mileageTolerance: 35000,
      expanded: false,
      sufficientSample: true,
    });
  });

  test("při malém vzorku rozšíří nejprve jen nájezd", () => {
    const input = [
      scenicComparable(1),
      scenicComparable(2, { mileage: 170000 }),
      scenicComparable(3, { year: 2017 }),
      scenicComparable(4, { year: 2019 }),
      scenicComparable(5, { mileage: 230000 }),
    ];
    const result = selectComparableVehicles(input, {
      brand: "Renault",
      model: "Scenic",
      year: "2018",
      mileage: 181635,
    });

    assert.equal(result.comparables.length, 5);
    assert.equal(result.selection.yearTolerance, 1);
    assert.equal(result.selection.mileageTolerance, 70000);
    assert.equal(result.selection.expanded, true);
  });

  test("service vrátí pouze kontrolní návrh bez změn vozidla", async () => {
    const context = buildVehicleAiContext(car);
    const original = structuredClone(context);
    let receivedPayload;
    const service = createVehicleAiService({
      priceRecommendationInvoker: async (payload) => {
        receivedPayload = payload;
        return validatePriceRecommendationOutput(
          {
            querySummary: "Dacia Dokker 1.5 dCi, rok 2019",
            comparables: [
              comparable(1, 240000),
              comparable(2, 250000),
              comparable(3, 260000),
            ],
            warnings: [],
          },
          payload.preparationCosts
        );
      },
    });

    const result = await service.runModule({
      moduleId: "price-recommendation",
      vehicleId: 69,
      context,
      options: { generatedAt: "2026-09-24T12:00:00.000Z" },
    });

    assert.equal(receivedPayload.preparationCosts, 17000);
    assert.equal(result.output.recommendedSalePrice, 250000);
    assert.equal(result.output.recommendedPurchasePrice, 203000);
    assert.deepEqual(result.proposedChanges, []);
    assert.deepEqual(context, original);
  });
});

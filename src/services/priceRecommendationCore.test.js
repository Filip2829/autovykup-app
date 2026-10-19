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
      : `https://www.tipcars.com/renault-grand-scenic/osobni/nafta/${index}.html`,
    price: 300000 + index * 3000,
    year: "2019",
    mileage: 180000 + index * 500,
    variant: "Grand Scenic dCi 150 Intens",
    fuel: "Nafta",
    transmission: "Automatická",
    powerKw: 110,
    bodyType: "MPV",
    seats: 5,
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
    url: "https://www.tipcars.com/renault-grand-scenic/osobni/nafta/duplicate.html",
  };
  const result = validatePriceRecommendationOutput(
    { comparables: [original, duplicate, item(2), item(3), item(4), item(5)] },
    0,
    vehicle
  );

  assert.equal(result.sampleSize, 5);
  assert.ok(result.warnings.some((warning) => warning.includes("duplicitních")));
});

test("rejects a passenger minibus when the target is a cargo van", () => {
  const cargoVehicle = {
    displayName: "Renault Master",
    brand: "Renault",
    model: "Master",
    year: "2012",
    mileage: 165000,
    bodyType: "BB SKŘÍŇOVÝ",
  };
  const cargo = item(31, {
    title: "Renault Master 2.3 dCi skříň",
    variant: "Master 2.3 dCi",
    bodyType: "skříňová dodávka",
    year: "2012",
    mileage: 160000,
    fuel: "",
    transmission: "",
  });
  const minibus = item(32, {
    title: "Renault Master 2.3 dCi 9-míst",
    variant: "Master minibus",
    bodyType: "minibus",
    year: "2012",
    mileage: 160000,
    fuel: "",
    transmission: "",
  });

  const result = validatePriceRecommendationOutput({ comparables: [cargo, minibus] }, 0, cargoVehicle);
  assert.equal(result.sampleSize, 1);
  assert.match(result.comparables[0].title, /skříň/);
});

test("shows an uncertainty range instead of false precision for one listing", () => {
  const result = validatePriceRecommendationOutput({ comparables: [item(40)] }, 0, vehicle);
  assert.ok(result.salePriceLow < result.recommendedSalePrice);
  assert.ok(result.salePriceHigh > result.recommendedSalePrice);
});

test("rejects search pages, low-quality matches and a specialized tow truck", () => {
  const cargoVehicle = {
    displayName: "Renault Master",
    brand: "Renault",
    model: "Master",
    year: "2012",
    mileage: 165000,
    bodyType: "BB SKŘÍŇOVÝ",
  };
  const searchPage = item(51, {
    title: "Renault Master skříň",
    url: "https://www.sauto.cz/inzerce/uzitkova/renault/master",
    year: "2012",
    mileage: 160000,
  });
  const towTruck = item(52, {
    title: "Renault Master odtahovka",
    url: "https://www.tipcars.com/uzitkove/renault-master/odtahovy-vuz/nafta/master-52.html",
    variant: "odtahový vůz",
    bodyType: "odtahový vůz",
    year: "2012",
    mileage: 160000,
  });
  const good = item(53, {
    title: "Renault Master 2.3 dCi skříň",
    url: "https://www.tipcars.com/uzitkove/renault-master/skrin/nafta/master-53.html",
    variant: "L2H2",
    bodyType: "skříň",
    year: "2012",
    mileage: 160000,
  });

  const result = validatePriceRecommendationOutput({ comparables: [searchPage, towTruck, good] }, 0, cargoVehicle);
  assert.equal(result.sampleSize, 1);
  assert.equal(result.comparables[0].url, good.url);
});

test("understands Czech registry fuel and gearbox codes", () => {
  const codedVehicle = {
    displayName: "Volkswagen Tiguan",
    brand: "Volkswagen",
    model: "Tiguan",
    year: "2023",
    mileage: 33000,
    fuel: "NM",
    transmission: "AUT",
  };
  const matching = item(61, {
    title: "Volkswagen Tiguan 2.0 TDI DSG",
    url: "https://www.tipcars.com/volkswagen-tiguan/suv/nafta/tiguan-61.html",
    variant: "2.0 TDI",
    fuel: "nafta",
    transmission: "automatická DSG",
    year: "2023",
    mileage: 34000,
  });
  const result = validatePriceRecommendationOutput({ comparables: [matching] }, 0, codedVehicle);
  assert.equal(result.sampleSize, 1);
});

test("deduplicates the same cross-listed car even when prices differ", () => {
  const first = item(71, { mileage: 44535, price: 688999 });
  const second = item(72, {
    title: first.title,
    mileage: 44535,
    price: 599000,
  });
  const result = validatePriceRecommendationOutput({ comparables: [first, second] }, 0, vehicle);
  assert.equal(result.sampleSize, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("duplicitních")));
});

test("does not mix a seven-seat Tiguan Allspace with a standard Tiguan", () => {
  const sevenSeatTiguan = {
    displayName: "Volkswagen Tiguan",
    brand: "Volkswagen",
    model: "Tiguan",
    year: "2023",
    mileage: 33000,
    seats: 7,
  };
  const standard = item(81, {
    title: "Volkswagen Tiguan 2.0 TDI",
    url: "https://www.tipcars.com/volkswagen-tiguan/suv/nafta/tiguan-81.html",
    year: "2023",
    mileage: 33000,
    seats: 5,
  });
  const allspace = item(82, {
    title: "Volkswagen Tiguan Allspace 2.0 TDI",
    url: "https://www.tipcars.com/volkswagen-tiguan-allspace/suv/nafta/tiguan-82.html",
    year: "2023",
    mileage: 33000,
    seats: 7,
  });
  const result = validatePriceRecommendationOutput({ comparables: [standard, allspace] }, 0, sevenSeatTiguan);
  assert.equal(result.sampleSize, 1);
  assert.match(result.comparables[0].title, /Allspace/);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  AUCTION_DECISION,
  auctionRadarCriteria,
  buildVerifiedAuctionVehicle,
  calculateAuctionEconomics,
  demoAuctionVehicles,
  emptyAuctionVehicleForm,
  filterAuctionVehicles,
  getAuctionUrgency,
  validateAuctionVehicleForm,
} from "./auctionRadarData.js";

const defaultFilters = {
  query: "",
  brand: "all",
  decision: "all",
  maxPriceCzk: auctionRadarCriteria.maxPriceCzk,
  decisions: {},
};

test("demo data respects the hard Renault/Dacia, Czech and price criteria", () => {
  assert.ok(demoAuctionVehicles.length > 0);
  for (const vehicle of demoAuctionVehicles) {
    assert.ok(auctionRadarCriteria.brands.includes(vehicle.brand));
    assert.match(vehicle.location, /ČR$/);
    assert.ok(vehicle.priceCzk <= auctionRadarCriteria.maxPriceCzk);
    assert.equal(vehicle.originalAuctionUrl, null);
  }
});

test("filters candidates by brand, text and manual decision", () => {
  const dacia = filterAuctionVehicles(demoAuctionVehicles, {
    ...defaultFilters,
    brand: "Dacia",
  });
  assert.equal(dacia.length, 1);
  assert.equal(dacia[0].brand, "Dacia");

  const byLocation = filterAuctionVehicles(demoAuctionVehicles, {
    ...defaultFilters,
    query: "Ostrava",
  });
  assert.equal(byLocation.length, 1);

  const suitable = filterAuctionVehicles(demoAuctionVehicles, {
    ...defaultFilters,
    decision: AUCTION_DECISION.SUITABLE,
    decisions: { "demo-renault-captur": AUCTION_DECISION.SUITABLE },
  });
  assert.deepEqual(suitable.map((vehicle) => vehicle.id), ["demo-renault-captur"]);
});

test("rejects an unverified or out-of-scope manual offer", () => {
  const errors = validateAuctionVehicleForm({
    ...emptyAuctionVehicleForm,
    brand: "Škoda",
    model: "Octavia",
    year: "2022",
    mileageKm: "30000",
    priceCzk: "650000",
    locationCity: "Praha",
    sourceName: "Test",
    originalAuctionUrl: "not-a-url",
    summary: "Test",
  });

  assert.ok(errors.brand);
  assert.ok(errors.priceCzk);
  assert.ok(errors.originalAuctionUrl);
  assert.ok(errors.verificationConfirmed);
});

test("requires mileage instead of silently interpreting an empty field as zero", () => {
  const errors = validateAuctionVehicleForm({ ...emptyAuctionVehicleForm });
  assert.ok(errors.mileageKm);
});

test("builds a verified Czech Renault offer with its original link", () => {
  const { vehicle, errors } = buildVerifiedAuctionVehicle({
    ...emptyAuctionVehicleForm,
    model: "Austral",
    trim: "E-Tech",
    year: "2024",
    mileageKm: "12000",
    priceCzk: "499000",
    locationCity: "Praha",
    sourceName: "Ověřený zdroj",
    originalAuctionUrl: "https://example.com/auction/123",
    summary: "Údaje ručně zkontrolované proti zdroji.",
    positives: "Nízký nájezd\nČeský původ",
    negatives: "Prověřit lak",
    verificationConfirmed: true,
  }, "verified-test");

  assert.deepEqual(errors, {});
  assert.equal(vehicle.id, "verified-test");
  assert.equal(vehicle.dataStatus, "verified");
  assert.equal(vehicle.location, "Praha, ČR");
  assert.equal(vehicle.priceCzk, 499000);
  assert.equal(vehicle.originalAuctionUrl, "https://example.com/auction/123");
  assert.deepEqual(vehicle.positives, ["Nízký nájezd", "Český původ"]);
});

test("calculates complete auction economics and a safe maximum bid", () => {
  const result = calculateAuctionEconomics({
    priceCzk: 300000,
    expectedSalePriceCzk: 390000,
    auctionFeeCzk: 8000,
    transportCostCzk: 5000,
    preparationCostCzk: 17000,
    targetProfitCzk: 30000,
  });

  assert.equal(result.totalCost, 330000);
  assert.equal(result.expectedProfit, 60000);
  assert.equal(result.recommendedMaxBid, 330000);
  assert.equal(Math.round(result.marginPercent * 10) / 10, 15.4);
});

test("labels auction deadlines and orders the nearest deadline first", () => {
  const now = new Date("2026-10-19T10:00:00Z");
  assert.equal(getAuctionUrgency("2026-10-19T13:00:00Z", now).key, "critical");
  assert.equal(getAuctionUrgency("2026-10-20T06:00:00Z", now).key, "soon");
  assert.equal(getAuctionUrgency("2026-10-18T10:00:00Z", now).key, "ended");

  const ordered = filterAuctionVehicles([
    { ...demoAuctionVehicles[0], id: "later", auctionEndsAt: "2026-10-21T10:00:00Z" },
    { ...demoAuctionVehicles[1], id: "sooner", auctionEndsAt: "2026-10-20T10:00:00Z" },
  ], { ...defaultFilters, sort: "deadline" });
  assert.deepEqual(ordered.map(({ id }) => id), ["sooner", "later"]);
});

test("rejects an invalid VIN and negative operating costs", () => {
  const errors = validateAuctionVehicleForm({
    ...emptyAuctionVehicleForm,
    model: "Captur",
    year: "2022",
    mileageKm: "20000",
    priceCzk: "300000",
    locationCity: "Praha",
    sourceName: "Aukce",
    originalAuctionUrl: "https://example.com/offer/1",
    summary: "Ověřeno",
    vin: "INVALID",
    auctionFeeCzk: "-1",
    verificationConfirmed: true,
  });
  assert.ok(errors.vin);
  assert.ok(errors.auctionFeeCzk);
});

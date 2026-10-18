import test from "node:test";
import assert from "node:assert/strict";

import {
  AUCTION_DECISION,
  auctionRadarCriteria,
  buildVerifiedAuctionVehicle,
  demoAuctionVehicles,
  emptyAuctionVehicleForm,
  filterAuctionVehicles,
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

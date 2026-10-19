import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAuctionListing, applyAuctionAnalysisToForm, extractAuctionListingLocally, validateAuctionListingAnalysis } from "./auctionListingAnalysis.js";

const response = {
  overallConfidence: "high", confidenceReason: "Údaje jsou přímo uvedené.",
  identity: { brand: "Renault", model: "Captur", trim: "TCe 90", vin: "VF1AAAAAA12345678", year: 2022, mileageKm: 25000, fuel: "Benzín", transmission: "Manuální" },
  auction: { priceCzk: 300000, auctionEndsAt: "2026-10-21T10:00:00", location: "Praha, ČR", sourceName: "Test aukce" },
  facts: [
    { category: "identity", label: "model", value: "Captur", evidence: "Model: Captur", confidence: "high" },
    { category: "identity", label: "rok výroby", value: "2022", evidence: "Rok 2022", confidence: "high" },
    { category: "technical", label: "nájezd", value: "25 000 km", evidence: "25 000 km", confidence: "high" },
    { category: "auction", label: "aukční cena", value: "300 000 Kč", evidence: "Cena 300 000 Kč", confidence: "high" },
  ], equipment: ["LED světlomety", "Automatická klimatizace"], damages: ["Oděrka pravých dveří"],
  risks: ["Chybí údaj o počtu klíčů"], missingCritical: ["Počet klíčů"], warnings: [],
};

test("validates and keeps evidence-backed auction facts", () => {
  const result = validateAuctionListingAnalysis(response);
  assert.equal(result.identity.model, "Captur"); assert.equal(result.facts.length, 4);
  assert.deepEqual(result.equipment, ["LED světlomety", "Automatická klimatizace"]);
});

test("fills safe form fields and keeps extracted details", () => {
  const result = applyAuctionAnalysisToForm({ brand: "Renault", positives: "", negatives: "" }, response);
  assert.equal(result.model, "Captur"); assert.equal(result.year, 2022); assert.equal(result.locationCity, "Praha");
  assert.match(result.positives, /LED světlomety/); assert.match(result.negatives, /Oděrka/);
});

test("rejects too short input before analysis", async () => {
  let called = false;
  await assert.rejects(() => analyzeAuctionListing("krátké", { invoke: async () => { called = true; } }), /základní text/);
  assert.equal(called, false);
});

test("extracts technical, legal, equipment and condition facts locally", () => {
  const result = extractAuctionListingLocally(`
    Renault Captur
    VIN: VF1AAAAAA12345678
    Rok výroby: 2022
    Nájezd: 25 000 km
    Palivo: benzín, převodovka manuální, výkon 67 kW
    Aukční cena: 300 000 Kč
    Konec aukce: 21.10.2026 10:00
    Lokalita: Praha, ČR
    Klíče: 2, STK platná do 10/2027
    Výbava: LED světlomety, adaptivní tempomat, automatická klimatizace.
    Stav: provozuschopné, oděrka pravých dveří.
  `);
  assert.equal(result.identity.brand, "Renault");
  assert.equal(result.identity.model, "Captur");
  assert.equal(result.identity.mileageKm, 25000);
  assert.equal(result.auction.priceCzk, 300000);
  assert.equal(result.auction.auctionEndsAt, "2026-10-21T10:00");
  assert.ok(result.equipment.includes("LED světlomety"));
  assert.ok(result.equipment.includes("Adaptivní tempomat"));
  assert.ok(result.facts.some((fact) => fact.label === "platnost STK"));
});

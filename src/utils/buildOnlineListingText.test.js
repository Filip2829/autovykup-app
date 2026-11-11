import test from "node:test";
import assert from "node:assert/strict";
import { buildOnlineListingText } from "./buildOnlineListingText.js";

test("generates only available listing phrases and preserves sale terms", () => {
  const text = buildOnlineListingText({
    name: "Renault Arkana", km: 124844, expectedSalePrice: 400000,
    technicalParams: { engine: "1332 cm³", warranty: "do 20. 12. 2027 / 150 000 km" },
    checklist: { "Počet klíčů 2x": true, "Servisní historie": true },
    cebiaFiles: ["report.pdf"],
    cebiaHistory: { countryOfOrigin: "Česká republika" },
    advertisingData: {
      highlights: "2x karta\n2 sada kol\npravidelný servis\nbohatá výbava",
      listingNote: "zakoupeno v autorizované prodejně; bonus při financování: 20 000 Kč; možnost vozu na protiúčet",
      defects: "drobné kosmetické vady",
      internalSaleNote: "Interní poznámka",
    },
  });
  assert.deepEqual(text.split("\n"), [
    "2× karta", "2 sady kol", "Pravidelný servis",
    "Zakoupeno v autorizované prodejně", "bonus při financování: 20 000 Kč",
    "Možnost vozu na protiúčet", "Protokol CEBIA", "Český původ",
    "Záruka: do 20. 12. 2027 / 150 000 km",
  ]);
});

test("does not turn negative, uncertain or unrelated information into selling points", () => {
  assert.equal(buildOnlineListingText({
    checklist: { "Počet klíčů 2x": false, "Servisní historie": "false" },
    cebiaHistory: { financing: "leasing", countryOfOrigin: "Německo" },
    dealType: "trade_in",
    advertisingData: {
      highlights: "bez pravidelného servisu; chybí 2 sada kol; 2 karty?",
      repairs: "po servisní kontrole",
      listingNote: "bonus při financování není dostupný; možnost protiúčtu neověřena",
    },
  }), "");
  assert.equal(buildOnlineListingText(), "");
});

test("supports stored card data and deduplicates confirmed facts", () => {
  assert.equal(buildOnlineListingText({
    technical_params: { advertisingData: { highlights: "servisní historie; český původ; protokol CEBIA" } },
    checklist: { "Servisní historie": true, "Počet klíčů 2x": true },
    cebia_files: ["report.pdf"],
    cebia_history: { countryOfOrigin: "CZ", warranty: "12 měsíců" },
  }), "Servisní historie\nProtokol CEBIA\nČeský původ\n2× klíč\nZáruka: 12 měsíců");
});

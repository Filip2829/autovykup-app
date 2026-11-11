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
  assert.equal(text, [
    "2× karta", "2 sady kol", "Pravidelný servis",
    "Zakoupeno v autorizované prodejně", "bonus při financování: 20 000 Kč",
    "Možnost vozu na protiúčet", "Protokol CEBIA", "Český původ",
    "Záruka: do 20. 12. 2027 / 150 000 km",
  ].join(", ") + ",");
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
  }), "Servisní historie, Protokol CEBIA, Český původ, 2× klíč, Záruka: 12 měsíců,");
});

test("extracts concise public facts from authored notes without copying private text", () => {
  const result = buildOnlineListingText({
    notes: [
      "Filip: K vozu je k dispozici protokol od Cebia. Při využití financování získá zákazník bonus 20 000 Kč. Telefon zákazníka 777123456.",
      "Filip: Vůz byl zakoupen v autorizované prodejně Renault; auto lze vzít na protiúčet.",
      "Filip: Vůz má 2 karty a dvě sady kol; pravidelně servisovaný; záruka na 12 měsíců / 20 000 km.",
    ],
  });
  assert.equal(result, [
    "Protokol CEBIA", "Bonus při financování: 20 000 Kč",
    "Zakoupeno v autorizované prodejně", "Možnost vozu na protiúčet",
    "2× karta", "2 sady kol", "Pravidelný servis", "Záruka: 12 měsíců / 20 000 km",
  ].join(", ") + ",");
});

test("rejects negated and uncertain note claims and internal commission bonuses", () => {
  const result = buildOnlineListingText({
    notes: [
      "Filip: Cebia protokol není k dispozici.",
      "Filip: Ověřit bonus 20 000 Kč při využití financování.",
      "Filip: Bonus při financování byl zrušen.",
      "Filip: Interní provize bonus 10 000 Kč při financování.",
      "Filip: Má vůz dvě sady kol?", "Filip: Záruka na 12 měsíců neplatí.",
    ],
  });
  assert.equal(result, "");
});

test("reads sale notes, preserves bonus limits and enriches a generic financing phrase", () => {
  assert.equal(buildOnlineListingText({
    advertisingData: {
      highlights: "bonus při financování",
      listingNote: "K vozu přiložen CEBIA protokol",
      internalSaleNote: "Zákazník může získat bonus až 20 000 Kč při využití financování.",
    },
  }), "Bonus při financování: až 20 000 Kč, Protokol CEBIA,");
});

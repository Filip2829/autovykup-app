import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildMarketingVehicle } from "./buildMarketingVehicle.js";

const fallbackText = "Neuvedeno";

function completeVehicle(overrides = {}) {
  return {
    name: "Škoda Octavia",
    year: 2021,
    km: 85000,
    vin: "TMBJK7NE7J0123456",
    expectedSalePrice: 450000,
    saleEstimate: 430000,
    photos: ["https://example.test/photo-1.jpg", "https://example.test/photo-2.jpg"],
    technicalParams: {
      version: "Style",
      equipmentLevel: "Ambition",
      engine: "1.5 TSI",
      powerKw: 110,
      fuel: "Benzín",
      transmission: "Automatická",
      drive: "Přední",
      consumption: "5,6 l/100 km",
      emissions: "Euro 6",
      color: "Modrá",
      bodyType: "Kombi",
      stkValidUntil: "2027-05-01",
      warranty: "12 měsíců",
    },
    equipment: {
      Navigace: true,
      Bluetooth: true,
      "Adaptivní tempomat": true,
      "Vyhřívaná sedadla": true,
      "Dělená zadní sedadla": true,
    },
    checklist: {
      "Servisní historie": true,
      "Kontrola CEBIA / CarVertical": true,
      "Mechanická prohlídka + diagnostika": true,
    },
    advertisingData: {
      highlights: "první majitel\nservisní historie",
      defects: "Kosmetická vada na dveřích",
      listingNote: "Poznámka pro inzerát",
    },
    damageReport: {
      overallCondition: "Dobrý stav",
    },
    cebiaHistory: {
      countryOfOrigin: "ČR",
      warranty: "6 měsíců",
    },
    ...overrides,
  };
}

function readinessCheck(vehicle, key) {
  return vehicle.readiness.checks.find((check) => check.key === key);
}

describe("buildMarketingVehicle – základní marketingový model", () => {
  test("mapuje kompletně vyplněné vozidlo", () => {
    const vehicle = buildMarketingVehicle(completeVehicle());

    assert.equal(vehicle.title, "Škoda Octavia");
    assert.equal(vehicle.subtitle, "Style");
    assert.equal(vehicle.specs.year, "2021");
    assert.equal(vehicle.specs.mileage, "85 000 km");
    assert.equal(vehicle.technical.engine, "1.5 TSI");
    assert.equal(vehicle.specs.power, "110 kW");
    assert.equal(vehicle.specs.fuel, "Benzín");
    assert.equal(vehicle.specs.transmission, "Automatická");
    assert.equal(vehicle.price, "450 000 Kč");
    assert.equal(vehicle.heroImage, "https://example.test/photo-1.jpg");
    assert.equal(vehicle.vin, "TMBJK7....3456");
    assert.deepEqual(vehicle.equipment, [
      "Navigace",
      "Adaptivní tempomat",
      "Vyhřívaná sedadla",
      "Bluetooth",
      "Dělená zadní sedadla",
    ]);
    assert.equal(vehicle.condition, "Dobrý stav");
    assert.deepEqual(vehicle.guarantees, [
      "Pravidelný servis",
      "Známé vady uvedeny transparentně",
      "CEBIA / ověřená historie",
      "Stav vozu prověřen",
    ]);
    assert.equal(vehicle.readiness.percent, 100);
    assert.deepEqual(vehicle.readiness.missing, []);
  });

  test("bezpečně mapuje prázdný záznam a zachovává fallbacky", () => {
    const vehicle = buildMarketingVehicle({});

    assert.equal(vehicle.title, fallbackText);
    assert.equal(vehicle.subtitle, fallbackText);
    assert.equal(vehicle.price, fallbackText);
    assert.equal(vehicle.heroImage, "");
    assert.equal(vehicle.vin, fallbackText);
    assert.equal(vehicle.specs.year, fallbackText);
    assert.equal(vehicle.specs.mileage, fallbackText);
    assert.equal(vehicle.specs.fuel, fallbackText);
    assert.equal(vehicle.technical.engine, fallbackText);
    assert.deepEqual(vehicle.equipment, []);
    assert.equal(vehicle.condition, fallbackText);
    assert.deepEqual(vehicle.guarantees, ["Ověřená historie vozu"]);
    assert.equal(vehicle.readiness.percent, 10);
    assert.equal(vehicle.readiness.missing.length, 9);
  });

  test("zachovává současné chování pro ne-normalizovaný snake_case záznam", () => {
    const vehicle = buildMarketingVehicle({
      name: "Starší vůz",
      year: 2018,
      km: 140000,
      expected_sale_price: "",
      sale_estimate: 275000,
      technical_params: {
        version: "Snake verze",
        fuel: "Nafta",
      },
      damage_report: {
        overallCondition: "Snake stav",
      },
      cebia_history: {
        countryOfOrigin: "ČR",
      },
    });

    assert.equal(vehicle.title, "Starší vůz");
    assert.equal(vehicle.price, "275 000 Kč");
    assert.equal(vehicle.specs.year, "2018");
    assert.equal(vehicle.specs.mileage, "140 000 km");
    assert.equal(vehicle.subtitle, fallbackText);
    assert.equal(vehicle.specs.fuel, fallbackText);
    assert.equal(vehicle.specs.origin, fallbackText);
    assert.equal(vehicle.condition, fallbackText);
  });
});

describe("buildMarketingVehicle – title, subtitle a cena", () => {
  test("subtitle používá pořadí version, equipmentLevel, engine", () => {
    assert.equal(
      buildMarketingVehicle({
        technicalParams: {
          version: "Version",
          equipmentLevel: "Equipment",
          engine: "Engine",
        },
      }).subtitle,
      "Version"
    );
    assert.equal(
      buildMarketingVehicle({
        technicalParams: {
          equipmentLevel: "Equipment",
          engine: "Engine",
        },
      }).subtitle,
      "Equipment"
    );
    assert.equal(
      buildMarketingVehicle({
        technicalParams: { engine: "Engine" },
      }).subtitle,
      "Engine"
    );
    assert.equal(buildMarketingVehicle({}).subtitle, fallbackText);
  });

  test("title používá pouze name a bez něj vrací fallback", () => {
    assert.equal(
      buildMarketingVehicle({
        name: "Pojmenovaný vůz",
        technicalParams: { brand: "Škoda", model: "Octavia" },
      }).title,
      "Pojmenovaný vůz"
    );
    assert.equal(
      buildMarketingVehicle({
        technicalParams: { brand: "Škoda", model: "Octavia" },
      }).title,
      fallbackText
    );
  });

  test("validní expectedSalePrice má přednost před saleEstimate", () => {
    const vehicle = buildMarketingVehicle({
      expectedSalePrice: 450000,
      saleEstimate: 390000,
    });

    assert.equal(vehicle.price, "450 000 Kč");
  });

  test("nulová expectedSalePrice zastaví fallback na saleEstimate", () => {
    const vehicle = buildMarketingVehicle({
      expectedSalePrice: 0,
      saleEstimate: 390000,
    });

    assert.equal(vehicle.price, fallbackText);
  });

  test("neplatná expectedSalePrice zastaví fallback na saleEstimate", () => {
    const vehicle = buildMarketingVehicle({
      expectedSalePrice: "neplatná cena",
      saleEstimate: 390000,
    });

    assert.equal(vehicle.price, fallbackText);
  });

  test("saleEstimate se použije, pokud expectedSalePrice není vyplněná", () => {
    const vehicle = buildMarketingVehicle({
      expectedSalePrice: "",
      saleEstimate: 390000,
    });

    assert.equal(vehicle.price, "390 000 Kč");
  });
});

describe("buildMarketingVehicle – výbava a fotografie", () => {
  test("zachovává marketingové priority, Boolean interpretaci a limit 10", () => {
    const vehicle = buildMarketingVehicle({
      equipment: {
        "Zadní extra": true,
        Navigace: true,
        "Automatická klimatizace": true,
        "Apple CarPlay": "ano",
        "Android Auto": 1,
        "Couvací kamera": {},
        "Parkovací senzory přední": [],
        "Parkovací senzory zadní": "false",
        "Adaptivní tempomat": true,
        "LED světlomety": true,
        "Matrix LED": true,
        Bluetooth: true,
        Vypnuto: false,
        Nula: 0,
      },
    });

    assert.deepEqual(vehicle.equipment, [
      "Automatická klimatizace",
      "Navigace",
      "Apple CarPlay",
      "Android Auto",
      "Couvací kamera",
      "Parkovací senzory přední",
      "Parkovací senzory zadní",
      "Adaptivní tempomat",
      "LED světlomety",
      "Matrix LED",
    ]);
    assert.equal(vehicle.equipment.length, 10);
  });

  test("case varianty názvu výbavy dnes nejsou deduplikovány", () => {
    const vehicle = buildMarketingVehicle({
      equipment: {
        Navigace: true,
        navigace: true,
      },
    });

    assert.deepEqual(vehicle.equipment, ["Navigace", "navigace"]);
  });

  test("používá první fotografii a fotografie ovlivňuje readiness", () => {
    const withoutPhoto = buildMarketingVehicle({});
    const withPhoto = buildMarketingVehicle({
      photos: ["first.jpg", "second.jpg"],
    });

    assert.equal(withPhoto.heroImage, "first.jpg");
    assert.equal(readinessCheck(withPhoto, "heroImage").done, true);
    assert.equal(withPhoto.readiness.percent, 20);
    assert.equal(withoutPhoto.heroImage, "");
    assert.equal(readinessCheck(withoutPhoto, "heroImage").done, false);
    assert.equal(withoutPhoto.readiness.percent, 10);
  });
});

describe("buildMarketingVehicle – stav, CEBIA a servis", () => {
  test("condition používá overallCondition, defects a listingNote v tomto pořadí", () => {
    assert.equal(
      buildMarketingVehicle({
        damageReport: { overallCondition: "Celkový stav" },
        advertisingData: {
          defects: "Známé vady",
          listingNote: "Poznámka",
        },
      }).condition,
      "Celkový stav"
    );
    assert.equal(
      buildMarketingVehicle({
        damageReport: {},
        advertisingData: {
          defects: "Známé vady",
          listingNote: "Poznámka",
        },
      }).condition,
      "Známé vady"
    );
    assert.equal(
      buildMarketingVehicle({
        advertisingData: { listingNote: "Poznámka" },
      }).condition,
      "Poznámka"
    );
    assert.equal(buildMarketingVehicle({}).condition, fallbackText);
  });

  test("historický CEBIA checklist přidává CEBIA garanci", () => {
    const vehicle = buildMarketingVehicle({
      checklist: { "Kontrola CEBIA / CarVertical": true },
    });

    assert.deepEqual(vehicle.guarantees, [
      "Ověřená historie vozu",
      "CEBIA / ověřená historie",
    ]);
  });

  test("AI CEBIA report přidává CEBIA garanci", () => {
    const vehicle = buildMarketingVehicle({
      aiCebiaReport: "Report je dostupný",
    });

    assert.deepEqual(vehicle.guarantees, [
      "Ověřená historie vozu",
      "CEBIA / ověřená historie",
    ]);
  });

  test("bez checklistu a AI reportu se CEBIA garance nepřidává", () => {
    const vehicle = buildMarketingVehicle({
      cebiaFiles: ["cebia.pdf"],
      cebiaHistory: { countryOfOrigin: "ČR" },
    });

    assert.deepEqual(vehicle.guarantees, ["Ověřená historie vozu"]);
  });

  test("servisní checklist má přednost a vytváří doloženou historii", () => {
    const vehicle = buildMarketingVehicle({
      checklist: { "Servisní historie": true },
    });

    assert.equal(vehicle.specs.serviceHistory, "Doložená");
    assert.ok(vehicle.guarantees.includes("Pravidelný servis"));
    assert.ok(vehicle.highlights.includes("Pravidelný servis"));
  });

  test("text o servisu v highlights vytváří hodnotu Uvedena", () => {
    const vehicle = buildMarketingVehicle({
      advertisingData: { highlights: "servisní historie" },
    });

    assert.equal(vehicle.specs.serviceHistory, "Uvedena");
    assert.ok(vehicle.guarantees.includes("Pravidelný servis"));
  });

  test("bez servisních zdrojů vrací servisní fallback", () => {
    const vehicle = buildMarketingVehicle({});

    assert.equal(vehicle.specs.serviceHistory, fallbackText);
    assert.ok(!vehicle.guarantees.includes("Pravidelný servis"));
  });

  test("první majitel se detekuje pouze textově v highlights", () => {
    assert.equal(
      buildMarketingVehicle({
        advertisingData: { highlights: "PRVNÍ MAJITEL" },
      }).specs.firstOwner,
      "Ano"
    );
    assert.equal(
      buildMarketingVehicle({}).specs.firstOwner,
      fallbackText
    );
  });

  test("současné garance rozlišují servis, stav, CEBIA a prázdná data", () => {
    assert.deepEqual(buildMarketingVehicle({}).guarantees, [
      "Ověřená historie vozu",
    ]);
    assert.deepEqual(
      buildMarketingVehicle({
        checklist: { "Servisní historie": true },
      }).guarantees,
      ["Pravidelný servis", "Ověřená historie vozu"]
    );
    assert.deepEqual(
      buildMarketingVehicle({
        damageReport: { overallCondition: "Známý stav" },
      }).guarantees,
      [
        "Známé vady uvedeny transparentně",
        "Stav vozu prověřen",
      ]
    );
    assert.deepEqual(
      buildMarketingVehicle({
        advertisingData: { highlights: "první majitel" },
      }).guarantees,
      ["Ověřená historie vozu"]
    );
  });
});

describe("buildMarketingVehicle – readiness", () => {
  test("kompletní vůz má readiness 100 %", () => {
    const vehicle = buildMarketingVehicle(completeVehicle());

    assert.equal(vehicle.readiness.percent, 100);
    assert.equal(vehicle.readiness.checks.length, 10);
    assert.deepEqual(vehicle.readiness.missing, []);
  });

  test("bez ceny chybí pouze Cena", () => {
    const vehicle = buildMarketingVehicle(
      completeVehicle({
        expectedSalePrice: "",
        saleEstimate: "",
      })
    );

    assert.equal(vehicle.readiness.percent, 90);
    assert.deepEqual(vehicle.readiness.missing, ["Cena"]);
  });

  test("bez fotografie chybí pouze Hlavní fotografie", () => {
    const vehicle = buildMarketingVehicle(
      completeVehicle({ photos: [] })
    );

    assert.equal(vehicle.readiness.percent, 90);
    assert.deepEqual(vehicle.readiness.missing, ["Hlavní fotografie"]);
  });

  test("bez výbavy chybí pouze Výbava", () => {
    const vehicle = buildMarketingVehicle(
      completeVehicle({ equipment: {} })
    );

    assert.equal(vehicle.readiness.percent, 90);
    assert.deepEqual(vehicle.readiness.missing, ["Výbava"]);
  });

  test("bez stavu chybí pouze Stav / poškození", () => {
    const base = completeVehicle();
    const vehicle = buildMarketingVehicle({
      ...base,
      damageReport: {},
      advertisingData: {
        highlights: base.advertisingData.highlights,
      },
    });

    assert.equal(vehicle.readiness.percent, 90);
    assert.deepEqual(vehicle.readiness.missing, ["Stav / poškození"]);
  });

  test("minimální záznam má stabilní readiness 10 %", () => {
    const vehicle = buildMarketingVehicle({});

    assert.equal(vehicle.readiness.percent, 10);
    assert.equal(readinessCheck(vehicle, "guarantees").done, true);
    assert.deepEqual(vehicle.readiness.missing, [
      "Hlavní fotografie",
      "Cena",
      "Nájezd",
      "Rok výroby",
      "Motor / palivo / převodovka",
      "Výbava",
      "Stav / poškození",
      "Servisní historie",
      "Původ vozu",
    ]);
  });
});

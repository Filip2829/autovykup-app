import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getVehicleMatchLevel,
  matchVehicleToDemand,
  safelyMatchesModel,
} from "./vehicleMatching.js";

const fullVehicleProfile = {
  identity: {
    brand: "Škoda",
    model: "Kodiaq RS",
  },
  technical: {
    year: 2022,
    mileage: 65000,
    fuel: "Nafta",
    transmission: "Automatická",
    drive: "4x4",
    bodyType: "SUV",
    powerKw: 180,
    color: "Modrá metalíza",
  },
  pricing: {
    effectiveSalePrice: 850000,
  },
  equipment: {
    activeItems: [
      "Adaptivní tempomat",
      "Tažné zařízení",
      "Vyhřívaná sedadla",
    ],
  },
};

const fullDemand = {
  makes: ["ŠKODA"],
  models: ["Kodiaq"],
  bodyTypes: ["suv"],
  fuelTypes: ["nafta"],
  transmissions: ["automaticka"],
  drivetrains: ["4X4"],
  minPrice: 800000,
  maxPrice: 900000,
  minYear: 2020,
  maxYear: 2024,
  maxMileage: 80000,
  minPowerKw: 150,
  maxPowerKw: 200,
  requiredEquipment: ["tažné zařízení"],
  preferredEquipment: ["Adaptivní tempomat", "Vyhřívaná sedadla"],
  preferredColors: ["modrá metalíza"],
  excludedColors: ["Bílá"],
};

describe("vehicleMatching – základní a blokující kritéria", () => {
  test("vrací přesnou plnou shodu", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, fullDemand);

    assert.equal(result.score, 100);
    assert.equal(result.level, "excellent");
    assert.equal(result.isEligible, true);
    assert.equal(result.failedCriteria.length, 0);
  });

  test("prázdná obecná poptávka má možnou shodu místo 100 bodů", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {});

    assert.equal(result.score, 50);
    assert.equal(result.level, "possible");
    assert.equal(result.isEligible, true);
    assert.deepEqual(result.matchedCriteria, []);
    assert.match(
      result.warnings[0].message,
      /málo konkrétních požadavků/
    );
  });

  test("poptávka pouze se značkou zůstává obecnou možnou shodou", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      makes: ["Škoda"],
    });

    assert.equal(result.isEligible, true);
    assert.equal(result.score, 50);
    assert.equal(result.level, "possible");
    assert.equal(result.matchedCriteria[0].key, "make");
    assert.match(
      result.warnings[0].message,
      /málo konkrétních požadavků/
    );
  });

  test("porovnává bez ohledu na velikost písmen a českou diakritiku", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      makes: ["skoda"],
      fuelTypes: ["NAFTA"],
      transmissions: ["automatická"],
    });

    assert.equal(result.score, 100);
    assert.equal(result.isEligible, true);
  });

  test("jiná značka je blokující chyba", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      makes: ["Toyota"],
    });

    assert.equal(result.isEligible, false);
    assert.equal(result.score, 0);
    assert.equal(result.failedCriteria[0].key, "make");
  });

  test("jiný model je blokující chyba", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      models: ["Octavia"],
    });

    assert.equal(result.isEligible, false);
    assert.equal(result.failedCriteria[0].key, "model");
  });

  test("chybějící povinná výbava je blokující chyba", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      requiredEquipment: ["Panoramatická střecha"],
    });

    assert.equal(result.isEligible, false);
    assert.match(result.failedCriteria[0].message, /Panoramatická střecha/);
  });

  test("vyloučená barva je blokující chyba", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      excludedColors: ["modra metaliza"],
    });

    assert.equal(result.isEligible, false);
    assert.equal(result.failedCriteria[0].key, "excludedColor");
  });
});

describe("vehicleMatching – bezpečné porovnání modelu", () => {
  test("porovnává celé normalizované tokeny, nikoli substring", () => {
    assert.equal(safelyMatchesModel("Astra", "A"), false);
    assert.equal(safelyMatchesModel("Kodiaq RS", "kodiaq"), true);
    assert.equal(safelyMatchesModel("Kodiaq", "Kodiaq RS"), false);
  });
});

describe("vehicleMatching – vážené skóre a upozornění", () => {
  test("shodný typ karoserie získá plnou dostupnou váhu", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      bodyTypes: ["suv"],
    });

    assert.equal(result.score, 100);
    assert.equal(result.isEligible, true);
    assert.equal(result.matchedCriteria[0].key, "bodyType");
  });

  test("neshodný typ karoserie není blokující, ale snižuje skóre", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      bodyTypes: ["kombi"],
    });

    assert.equal(result.score, 0);
    assert.equal(result.level, "poor");
    assert.equal(result.isEligible, true);
    assert.equal(result.warnings[0].key, "bodyType");
  });

  test("cena mimo rozsah není blokující, ale snižuje skóre", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      minPrice: 100000,
      maxPrice: 500000,
    });

    assert.equal(result.isEligible, true);
    assert.equal(result.score, 0);
    assert.equal(result.warnings[0].key, "price");
  });

  test("nájezd nad limitem uvádí přesný rozdíl kilometrů", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      maxMileage: 45000,
    });

    assert.equal(result.score, 0);
    assert.match(result.warnings[0].message, /20\s000 km/);
  });

  test("preferovaná výbava získává poměrnou část bodů", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      preferredEquipment: [
        "Adaptivní tempomat",
        "Panoramatická střecha",
      ],
    });

    assert.equal(result.score, 50);
    assert.equal(result.level, "possible");
    assert.match(result.matchedCriteria[0].message, /1 z 2/);
  });

  test("preferovaná barva přidá plný počet dostupných bodů", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      preferredColors: ["Modrá metalíza"],
    });

    assert.equal(result.score, 100);
    assert.equal(result.matchedCriteria[0].key, "preferredColor");
  });

  test("poptávka s jediným splněným váženým kritériem má 100 bodů", () => {
    const result = matchVehicleToDemand(fullVehicleProfile, {
      minYear: 2020,
    });

    assert.equal(result.score, 100);
    assert.equal(result.level, "excellent");
  });

  test("skóre zůstává vždy v rozsahu 0 až 100", () => {
    for (const demand of [
      {},
      fullDemand,
      { maxMileage: 0 },
      { preferredEquipment: ["A", "B", "C"] },
    ]) {
      const { score } = matchVehicleToDemand(fullVehicleProfile, demand);
      assert.equal(score >= 0 && score <= 100, true);
    }
  });

  test("správně rozlišuje všechny úrovně skóre", () => {
    assert.equal(getVehicleMatchLevel(100), "excellent");
    assert.equal(getVehicleMatchLevel(85), "excellent");
    assert.equal(getVehicleMatchLevel(84), "good");
    assert.equal(getVehicleMatchLevel(70), "good");
    assert.equal(getVehicleMatchLevel(69), "possible");
    assert.equal(getVehicleMatchLevel(50), "possible");
    assert.equal(getVehicleMatchLevel(49), "poor");
    assert.equal(getVehicleMatchLevel(0), "poor");
  });

  test("stejný vstup vrací deterministicky stejný výsledek", () => {
    assert.deepEqual(
      matchVehicleToDemand(fullVehicleProfile, fullDemand),
      matchVehicleToDemand(fullVehicleProfile, fullDemand)
    );
  });
});

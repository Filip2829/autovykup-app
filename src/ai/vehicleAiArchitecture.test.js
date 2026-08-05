import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getAiModule,
  getAvailableAiModules,
  getPlannedAiModules,
} from "./aiModuleRegistry.js";
import { buildVehicleAiContext } from "./buildVehicleAiContext.js";
import { sanitizeVehicleAiContext } from "./sanitizeVehicleAiContext.js";
import { evaluateVehicleAiCapabilities } from "./vehicleAiCapabilities.js";
import {
  createVehicleAiResponse,
  isVehicleAiResponse,
} from "./vehicleAiContracts.js";
import {
  buildPurchaseInspectionItems,
  getPurchaseInspectionMissingData,
  updatePurchaseInspectionItem,
} from "./purchaseInspection.js";
import {
  createDeterministicPurchaseInspection,
  createDeterministicVehicleSummary,
  vehicleAi,
} from "../services/vehicleAi.js";

const currentCar = {
  id: 87,
  name: "Seat Toledo",
  status: "purchased",
  updated_at: "2026-08-05T10:00:00Z",
  vin: "TESTVIN123",
  spz: "1A2 3456",
  year: "2019",
  km: 85000,
  technicalParams: {
    brand: "Seat",
    model: "Toledo",
    fuel: "Benzín",
    transmission: "Manuální",
  },
  customerInfo: {
    firstName: "Tajné",
    email: "zakaznik@example.cz",
  },
  equipment: { Klimatizace: true },
  damageReport: { overallCondition: "Běžné opotřebení" },
  notes: ["Interní poznámka"],
  photos: ["photo-a.jpg", "photo-a.jpg", "photo-b.jpg"],
  saleEstimate: 249000,
};

describe("AI registry", () => {
  test("aktivní souhrn je dostupný ve všech lifecycle sekcích", () => {
    for (const section of [
      "valuation",
      "approved_purchase",
      "stock",
      "sold",
      "archived",
    ]) {
      assert.ok(
        getAvailableAiModules(section)
          .map((module) => module.id)
          .includes("vehicle-summary")
      );
    }
  });

  test("plánované moduly nejsou vráceny jako aktivní", () => {
    assert.ok(
      getPlannedAiModules("stock").some(
        (module) => module.id === "sales-card"
      )
    );
    assert.ok(
      !getAvailableAiModules("stock").some(
        (module) => module.id === "sales-card"
      )
    );
  });
});

describe("buildVehicleAiContext", () => {
  test("normalizuje současný záznam a vynechá kontaktní údaje", () => {
    const context = buildVehicleAiContext(currentCar, {
      documents: [
        { id: "doc-1", filePath: "87/tp.pdf", title: "TP" },
        { id: "doc-2", filePath: "87/tp.pdf", title: "TP kopie" },
      ],
    });

    assert.equal(context.schemaVersion, 1);
    assert.equal(context.vehicleId, 87);
    assert.equal(context.lifecycleSection, "stock");
    assert.equal(context.profile.identity.brand, "Seat");
    assert.equal(context.sources.documents.length, 1);
    assert.equal(context.sources.photos.length, 2);
    assert.doesNotMatch(JSON.stringify(context), /zakaznik@example\.cz|Tajné/);
  });

  test("podporuje starší snake_case záznam", () => {
    const context = buildVehicleAiContext({
      id: 12,
      status: "valuation",
      updated_at: "2025-01-01T00:00:00Z",
      technical_params: {
        brand: "Dacia",
        model: "Dokker",
        fuel: "Nafta",
      },
      technical_card_photos: ["legacy-tp.jpg", "legacy-tp.jpg"],
      cebia_files: ["legacy-cebia.pdf"],
      buy_estimate: 200000,
    });

    assert.equal(context.profile.identity.brand, "Dacia");
    assert.equal(context.profile.identity.model, "Dokker");
    assert.equal(context.internal.valuation.buyEstimate, 200000);
    assert.equal(context.sources.documents.length, 2);
  });

  test("veřejný modul nedostane interní data", () => {
    const context = buildVehicleAiContext(currentCar);
    const sanitized = sanitizeVehicleAiContext(context, {
      dataScope: "public",
    });

    assert.equal(sanitized.internal, undefined);
    assert.equal(sanitized.profile.identity.name, "Seat Toledo");
  });
});

describe("AI capabilities a response kontrakt", () => {
  test("ohlásí chybějící povinné zdroje", () => {
    const context = buildVehicleAiContext({ id: 1, status: "valuation" });
    const capabilities = evaluateVehicleAiCapabilities(
      context,
      getAiModule("vehicle-summary")
    );

    assert.equal(capabilities.canRun, false);
    assert.deepEqual(capabilities.missingRequiredSources, [
      "identity",
      "technical",
    ]);
  });

  test("vytvoří verzovanou response strukturu", () => {
    const response = createVehicleAiResponse({
      moduleId: "vehicle-summary",
      generatedAt: "2026-08-05T12:00:00.000Z",
    });

    assert.equal(isVehicleAiResponse(response), true);
    assert.deepEqual(response.proposedChanges, []);
  });
});

describe("deterministický AI souhrn", () => {
  test("vrací stejný obsah pro stejný kontext a nic nemění", async () => {
    const context = buildVehicleAiContext(currentCar, {
      documents: [{ id: "doc-1", filePath: "87/cebia.pdf", title: "CEBIA" }],
    });
    const originalContext = structuredClone(context);
    const generatedAt = "2026-08-05T12:00:00.000Z";
    const directResult = createDeterministicVehicleSummary(context, generatedAt);
    const serviceResult = await vehicleAi.runModule({
      moduleId: "vehicle-summary",
      vehicleId: 87,
      context,
      options: { generatedAt },
    });

    assert.deepEqual(serviceResult, directResult);
    assert.equal(serviceResult.output.identification[0].value, "Seat Toledo");
    assert.match(serviceResult.output.summary, /Seat Toledo/);
    assert.deepEqual(serviceResult.proposedChanges, []);
    assert.deepEqual(context, originalContext);
  });

  test("nepoužívá backend ani zápis do Supabase", async () => {
    const context = buildVehicleAiContext(currentCar);
    const result = await vehicleAi.runModule({
      moduleId: "vehicle-summary",
      vehicleId: 87,
      context,
      options: { generatedAt: "2026-08-05T12:00:00.000Z" },
    });

    assert.equal(result.status, "completed");
    assert.deepEqual(result.proposedChanges, []);
  });
});

describe("Kontrola při výkupu", () => {
  const inspectionCar = {
    id: 101,
    name: "Dacia Dokker",
    status: "valuation",
    km: 145000,
    year: 2019,
    technicalParams: {
      brand: "Dacia",
      model: "Dokker",
      engine: "1.5 dCi",
      fuel: "Nafta",
      transmission: "Automatická",
      drive: "4x4",
      bodyType: "Dodávka",
      powerKw: 66,
    },
    damageReport: {
      exterior: "Promáčklina pravých posuvných dveří",
    },
    customerInfo: {
      firstName: "Tajný kontakt",
      phone: "+420777111222",
      email: "kontakt@example.cz",
    },
    notes: ["Prověřit zvuk od zadní nápravy"],
    equipment: { Klimatizace: true },
    photos: ["photo.jpg"],
  };

  test("je dostupná pouze pro valuation a approved_for_purchase lifecycle", () => {
    assert.ok(
      getAvailableAiModules("valuation").some(
        (module) => module.id === "purchase-inspection"
      )
    );
    assert.ok(
      getAvailableAiModules("approved_purchase").some(
        (module) => module.id === "purchase-inspection"
      )
    );

    for (const section of ["stock", "sold", "archived"]) {
      assert.ok(
        !getAvailableAiModules(section).some(
          (module) => module.id === "purchase-inspection"
        )
      );
    }

    const approvedContext = buildVehicleAiContext({
      ...inspectionCar,
      status: "approved_for_purchase",
    });
    assert.equal(approvedContext.lifecycleSection, "approved_purchase");
  });

  test("chybějící značka nebo model vytvoření zablokují konkrétní chybou", async () => {
    const context = buildVehicleAiContext({
      id: 102,
      status: "valuation",
      technicalParams: { fuel: "Nafta" },
    });

    assert.deepEqual(getPurchaseInspectionMissingData(context), [
      "Značka vozidla",
      "Model vozidla",
    ]);
    await assert.rejects(
      vehicleAi.runModule({
        moduleId: "purchase-inspection",
        vehicleId: 102,
        context,
      }),
      /Značka vozidla, Model vozidla/
    );
  });

  test("diesel, automat a dodávka přidají relevantní kontrolní body", () => {
    const context = buildVehicleAiContext(inspectionCar);
    const items = buildPurchaseInspectionItems(context);

    assert.ok(items.some((item) => item.id === "diesel-emissions"));
    assert.ok(items.some((item) => item.id === "automatic-transmission"));
    assert.ok(items.some((item) => item.id === "van-sliding-doors"));
    assert.ok(items.some((item) => item.id === "van-load-stress"));
  });

  test("evidované poškození se promítne jako bod k ověření", () => {
    const items = buildPurchaseInspectionItems(
      buildVehicleAiContext(inspectionCar)
    );
    const conditionItem = items.find((item) =>
      item.id.startsWith("known-condition-")
    );

    assert.match(conditionItem.title, /Promáčklina pravých posuvných dveří/);
    assert.match(conditionItem.reason, /ověřit/);
  });

  test("výstup má nejvýše 12 unikátních bodů a validní kontrakt", () => {
    const context = buildVehicleAiContext(inspectionCar);
    const response = createDeterministicPurchaseInspection(
      context,
      "2026-08-05T15:00:00.000Z"
    );
    const ids = response.output.items.map((item) => item.id);

    assert.equal(isVehicleAiResponse(response), true);
    assert.ok(response.output.items.length <= 12);
    assert.equal(new Set(ids).size, ids.length);
    for (const item of response.output.items) {
      assert.ok(
        ["engine", "chassis", "body", "interior", "testDrive"].includes(
          item.category
        )
      );
      assert.ok(
        ["critical", "important", "recommended"].includes(item.priority)
      );
      assert.equal(item.status, "unchecked");
      assert.equal(item.note, "");
    }
  });

  test("service nemění kontext, nezapisuje a nepropustí kontaktní údaje", async () => {
    const context = buildVehicleAiContext(inspectionCar);
    const originalContext = structuredClone(context);
    const result = await vehicleAi.runModule({
      moduleId: "purchase-inspection",
      vehicleId: 101,
      context,
      options: { generatedAt: "2026-08-05T15:00:00.000Z" },
    });
    const serialized = JSON.stringify({ context, result });

    assert.deepEqual(context, originalContext);
    assert.deepEqual(result.proposedChanges, []);
    assert.doesNotMatch(
      serialized,
      /Tajný kontakt|\+420777111222|kontakt@example\.cz/
    );
  });

  test("lokální změna stavu vytvoří nový seznam bez updateCar", () => {
    const originalItems = buildPurchaseInspectionItems(
      buildVehicleAiContext(inspectionCar)
    );
    const nextItems = updatePurchaseInspectionItem(
      originalItems,
      originalItems[0].id,
      { status: "passed", note: "Ověřeno" }
    );

    assert.equal(originalItems[0].status, "unchecked");
    assert.equal(nextItems[0].status, "passed");
    assert.equal(nextItems[0].note, "Ověřeno");
  });
});

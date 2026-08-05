import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildVehicleAiContext } from "../ai/buildVehicleAiContext.js";
import { createSingleFlightGuard } from "../ai/singleFlight.js";
import {
  buildPurchaseInspectionAiPayload,
  invokePurchaseInspectionAi,
  PurchaseInspectionAiError,
  validatePurchaseInspectionAiOutput,
} from "./purchaseInspectionAi.js";
import { createVehicleAiService } from "./vehicleAi.js";

function createRisk(overrides = {}) {
  return {
    id: "specific-risk",
    category: "engine",
    priority: "critical",
    title: "Korekce vstřikovačů konkrétního motoru",
    reason: "Odchylky mohou upozornit na opotřebení vstřikovací soustavy.",
    howToCheck: "Ověřit korekce jednotlivých vstřikovačů diagnostikou.",
    specificity: "Dacia Dokker, motor K9K",
    ...overrides,
  };
}

function createOutput(overrides = {}) {
  return {
    vehicleIdentification: {
      brand: "Dacia",
      model: "Dokker",
      generation: "2012–2021",
      engine: "1.5 dCi K9K",
      transmission: "Easy-R",
      year: "2019",
    },
    confidence: "high",
    confidenceReason: "Varianta je přesně identifikovaná.",
    risks: [createRisk()],
    disclaimer: "Jde o doporučení k ověření, nikoli potvrzení závady.",
    ...overrides,
  };
}

function createCar(overrides = {}) {
  return {
    id: 201,
    status: "valuation",
    year: 2019,
    km: 120000,
    technicalParams: {
      brand: "Dacia",
      model: "Dokker",
      engine: "1.5 dCi",
      engineCode: "K9K 612",
      powerKw: 66,
      fuel: "Nafta",
      transmission: "Easy-R",
      drive: "Přední",
      bodyType: "Dodávka",
    },
    damageReport: { technical: "Hluk od motoru za studena" },
    customerInfo: {
      firstName: "Citlivé jméno",
      phone: "+420777123456",
      email: "citlive@example.cz",
    },
    customerExpectedPrice: 250000,
    buyEstimate: 210000,
    saleEstimate: 280000,
    notes: ["Kontaktovat zákazníka v pátek"],
    ...overrides,
  };
}

describe("purchaseInspectionAi – sanitizovaný payload", () => {
  test("obsahuje jen technická data bez kontaktů, cen a ekonomiky", () => {
    const context = buildVehicleAiContext(createCar());
    const payload = buildPurchaseInspectionAiPayload(context);
    const serialized = JSON.stringify(payload);

    assert.equal(payload.identity.brand, "Dacia");
    assert.equal(payload.identity.model, "Dokker");
    assert.equal(payload.technical.engineCode, "K9K 612");
    assert.doesNotMatch(
      serialized,
      /Citlivé jméno|\+420777123456|citlive@example\.cz|Kontaktovat zákazníka/
    );
    assert.doesNotMatch(
      serialized,
      /customerExpectedPrice|buyEstimate|saleEstimate|purchaseEconomy|250000|210000|280000/
    );
  });
});

describe("purchaseInspectionAi – validace odpovědi", () => {
  test("přijme validní strukturovanou odpověď", () => {
    const output = validatePurchaseInspectionAiOutput(createOutput());
    assert.equal(output.confidence, "high");
    assert.equal(output.risks.length, 1);
  });

  test("odstraní rizika se stejným ID nebo názvem", () => {
    const output = validatePurchaseInspectionAiOutput(
      createOutput({
        risks: [
          createRisk(),
          createRisk({ title: "Jiný název" }),
          createRisk({ id: "other-id" }),
        ],
      })
    );
    assert.equal(output.risks.length, 1);
  });

  test("odmítne více než 8 rizik", () => {
    assert.throws(
      () =>
        validatePurchaseInspectionAiOutput(
          createOutput({
            risks: Array.from({ length: 9 }, (_, index) =>
              createRisk({ id: `risk-${index}`, title: `Riziko ${index}` })
            ),
          })
        ),
      /neplatný počet rizik/
    );
  });

  test("odmítne obecný zakázaný bod", () => {
    assert.throws(
      () =>
        validatePurchaseInspectionAiOutput(
          createOutput({ risks: [createRisk({ title: "Kontrola brzd" })] })
        ),
      /obecný kontrolní bod/
    );
  });

  test("neplatný JSON nebo jiný neobjektový výstup vrátí bezpečnou chybu", async () => {
    await assert.rejects(
      invokePurchaseInspectionAi(
        { identity: { brand: "Dacia", model: "Dokker" } },
        {
          invoke: async () => ({ data: "{neplatny-json", error: null }),
          timeoutMs: 50,
        }
      ),
      (error) =>
        error instanceof PurchaseInspectionAiError &&
        error.code === "invalid-response"
    );
  });

  test("chybový kód Edge Function zachová invalid-response bez fallbacku", async () => {
    const context = {
      clone: () => ({
        json: async () => ({
          code: "invalid-response",
          error: "OpenAI vrátil neplatný JSON.",
        }),
      }),
    };

    await assert.rejects(
      invokePurchaseInspectionAi(
        { identity: { brand: "Dacia", model: "Dokker" } },
        {
          invoke: async () => ({
            data: null,
            error: { message: "FunctionsHttpError", context },
          }),
          timeoutMs: 50,
        }
      ),
      (error) =>
        error instanceof PurchaseInspectionAiError &&
        error.code === "invalid-response" &&
        /neplatný JSON/.test(error.message)
    );
  });

  test("timeout vrátí konkrétní chybu", async () => {
    await assert.rejects(
      invokePurchaseInspectionAi(
        { identity: { brand: "Dacia", model: "Dokker" } },
        {
          invoke: () => new Promise(() => {}),
          timeoutMs: 5,
        }
      ),
      (error) =>
        error instanceof PurchaseInspectionAiError &&
        error.code === "timeout" &&
        /časový limit/.test(error.message)
    );
  });
});

describe("vehicleAi – AI backend a fallback", () => {
  test("validní AI výstup zachová společný kontrakt a nic nezapisuje", async () => {
    const service = createVehicleAiService({
      purchaseInspectionInvoker: async () => createOutput(),
    });
    const context = buildVehicleAiContext(createCar());
    const originalContext = structuredClone(context);
    const result = await service.runModule({
      moduleId: "purchase-inspection",
      vehicleId: 201,
      context,
      options: { generatedAt: "2026-08-05T16:00:00.000Z" },
    });

    assert.equal(result.moduleId, "purchase-inspection");
    assert.equal(result.output.risks[0].id, "specific-risk");
    assert.deepEqual(result.proposedChanges, []);
    assert.deepEqual(context, originalContext);
  });

  test("přesný katalog se použije jen při nedostupnosti AI", async () => {
    const service = createVehicleAiService({
      purchaseInspectionInvoker: async () => {
        throw new PurchaseInspectionAiError("timeout", "Timeout");
      },
    });
    const result = await service.runModule({
      moduleId: "purchase-inspection",
      vehicleId: 201,
      context: buildVehicleAiContext(createCar()),
    });

    assert.match(result.warnings[0], /lokální fallback/);
    assert.ok(result.output.risks.length > 0);
  });

  test("bez přesné katalogové shody se fallback nepoužije", async () => {
    const service = createVehicleAiService({
      purchaseInspectionInvoker: async () => {
        throw new PurchaseInspectionAiError("network", "Síťová chyba");
      },
    });
    const context = buildVehicleAiContext(
      createCar({
        id: 202,
        technicalParams: {
          brand: "Seat",
          model: "Toledo",
          engine: "1.2 TSI",
          fuel: "Benzín",
          transmission: "Manuální",
        },
      })
    );

    await assert.rejects(
      service.runModule({
        moduleId: "purchase-inspection",
        vehicleId: 202,
        context,
      }),
      /nemáme přesný lokální fallback/
    );
  });

  test("mockované varianty Logan a Dokker vrátí odlišná rizika", async () => {
    const service = createVehicleAiService({
      purchaseInspectionInvoker: async (payload) =>
        createOutput({
          vehicleIdentification: {
            ...createOutput().vehicleIdentification,
            model: payload.identity.model,
            engine: payload.technical.engine,
          },
          risks: [
            createRisk({
              id: `${payload.identity.model.toLowerCase()}-specific-risk`,
              title: `Specifické riziko ${payload.identity.model}`,
              specificity: `${payload.identity.model} ${payload.technical.engine}`,
            }),
          ],
        }),
    });
    const dokker = await service.runModule({
      moduleId: "purchase-inspection",
      vehicleId: 201,
      context: buildVehicleAiContext(createCar()),
    });
    const logan = await service.runModule({
      moduleId: "purchase-inspection",
      vehicleId: 203,
      context: buildVehicleAiContext(
        createCar({
          id: 203,
          year: 2018,
          technicalParams: {
            brand: "Dacia",
            model: "Logan",
            engine: "1.0 SCe",
            powerKw: 54,
            fuel: "Benzín",
            transmission: "Manuální",
            drive: "Přední",
            bodyType: "Sedan",
          },
        })
      ),
    });

    assert.notEqual(dokker.output.risks[0].id, logan.output.risks[0].id);
  });
});

describe("single-flight ochrana", () => {
  test("dvojité spuštění nepovolí dvě paralelní volání", () => {
    const guard = createSingleFlightGuard();
    assert.equal(guard.tryStart(), true);
    assert.equal(guard.tryStart(), false);
    guard.finish();
    assert.equal(guard.tryStart(), true);
  });
});

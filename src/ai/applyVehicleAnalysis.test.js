import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyVehicleAnalysis } from "./applyVehicleAnalysis.js";

describe("applyVehicleAnalysis – regrese ukládání technické AI analýzy", () => {
  test("vrátí false a nepotvrdí úspěch, když updateCar selže", async () => {
    let receivedCar = null;
    const saved = await applyVehicleAnalysis({
      selectedCar: { id: 87, technicalParams: {}, equipment: {} },
      technicalParams: { brand: "Seat" },
      report: "Výsledek",
      updateCar: async (car) => {
        receivedCar = car;
        return false;
      },
    });

    assert.equal(saved, false);
    assert.equal(receivedCar.technicalParams.brand, "Seat");
  });

  test("vrátí true pouze po úspěšném updateCar", async () => {
    const saved = await applyVehicleAnalysis({
      selectedCar: {
        id: 87,
        technicalParams: { model: "Toledo" },
        equipment: {},
      },
      technicalParams: { brand: "Seat" },
      equipment: ["Klimatizace", "Neznámá položka"],
      allowedEquipment: ["Klimatizace"],
      report: "Výsledek",
      updateCar: async () => true,
    });

    assert.equal(saved, true);
  });
});

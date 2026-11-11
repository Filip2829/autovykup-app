import test from "node:test";
import assert from "node:assert/strict";
import { readCebiaEquipment } from "./cebiaEquipment.js";

test("missing CEBIA never starts analysis or changes a vehicle", async () => {
  let calls = 0;
  await assert.rejects(readCebiaEquipment({
    car: { id: 1, photos: ["car.jpg"], technicalCardPhotos: ["tp.jpg"] },
    documents: [{ category: "Technický průkaz", filePath: "tp.pdf" }],
    invoke: async () => { calls++; },
  }), /nahrajte protokol CEBIA/);
  assert.equal(calls, 0);
});

test("sends only CEBIA and adds confirmed equipment while preserving manual fields", async () => {
  const original = { id: 1, vin: "VIN", notes: ["Soukromá poznámka"],
    equipment: { Navigace: true, "Vyhřívaná sedadla": false },
    technicalParams: { brand: "Renault", warranty: "12 měsíců", equipmentDetails: { secondWheelSet: "yes" } },
  };
  const result = await readCebiaEquipment({
    car: original,
    documents: [
      { category: "CEBIA", carId: 1, filePath: "cebia.pdf" },
      { category: "CEBIA", carId: 2, filePath: "other.pdf" },
      { category: "Technický průkaz", carId: 1, filePath: "tp.pdf" },
    ],
    createSignedUrl: async (path) => `https://example.com/${path}`,
    invoke: async (name, { body }) => {
      assert.equal(name, "analyze-vehicle-technical-data");
      assert.deepEqual(body.cebiaFiles, ["https://example.com/cebia.pdf"]);
      assert.deepEqual(body.vehiclePhotos, []);
      assert.deepEqual(body.technicalCardPhotos, []);
      assert.equal(body.car.notes, undefined);
      return { data: { technicalParams: { warranty: "Změněná záruka", equipmentEvidence: [
        { name: "Navigační systém", source: "cebia", confidence: 0.99 },
        { name: "Vyhřívaná sedadla", source: "cebia", confidence: 0.99 },
        { name: "Parkovací kamera", source: "cebia", confidence: 0.99 },
        { name: "Couvací kamera", source: "cebia", confidence: 0.99 },
        { name: "Bluetooth", source: "photo", confidence: 0.99 },
        { name: "USB", source: "cebia", confidence: 0.5 },
        { name: "Neznámá výbava", source: "cebia", confidence: 1 },
      ] } } };
    },
  });
  assert.equal(result.addedCount, 1);
  assert.deepEqual(result.car.equipment, { Navigace: true, "Vyhřívaná sedadla": false, "Couvací kamera": true });
  assert.equal(result.car.technicalParams.warranty, "12 měsíců");
  assert.deepEqual(result.car.technicalParams.equipmentDetails, { secondWheelSet: "yes" });
  assert.equal(original.equipment["Couvací kamera"], undefined);
});

test("does not accept an unproven equipment list or turn an empty response into a write", async () => {
  const car = { id: 1, cebiaFiles: ["https://example.com/cebia.pdf"] };
  const result = await readCebiaEquipment({ car, invoke: async () => ({ data: { equipment: ["ABS"] } }) });
  assert.equal(result.addedCount, 0);
  assert.equal(result.car, car);
});

test("returns a useful failure instead of applying a failed analysis", async () => {
  await assert.rejects(readCebiaEquipment({
    car: { id: 1, cebiaFiles: ["https://example.com/cebia.pdf"] },
    invoke: async () => ({ data: { error: "CEBIA se nepodařilo přečíst" } }),
  }), /CEBIA se nepodařilo přečíst/);
});

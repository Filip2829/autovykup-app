import test from "node:test";
import assert from "node:assert/strict";
import {
  getEquipmentLevelStatus,
  getVehicleEquipmentHighlights,
} from "./vehicleEquipmentHighlights.js";

test("shows only sufficiently certain equipment backed by CEBIA or photos", () => {
  const highlights = getVehicleEquipmentHighlights({
    equipmentEvidence: [
      { name: "LED světlomety", source: "photo", confidence: 0.96 },
      { name: "Panoramatická střecha", source: "cebia", confidence: 0.91 },
      { name: "Navigace", source: "comparison", confidence: 0.99 },
      { name: "Couvací kamera", source: "photo", confidence: 0.4 },
    ],
  });

  assert.deepEqual(
    highlights.map(({ name, sourceLabel }) => ({ name, sourceLabel })),
    [
      { name: "Panoramatická střecha", sourceLabel: "CEBIA" },
      { name: "LED světlomety", sourceLabel: "Fotografie" },
    ]
  );
});

test("labels an inferred equipment level separately from a verified one", () => {
  assert.deepEqual(
    getEquipmentLevelStatus({
      equipmentLevel: "Style",
      equipmentLevelSource: "comparison",
    }),
    { label: "Odhad z porovnání", tone: "estimate" }
  );
  assert.deepEqual(
    getEquipmentLevelStatus({
      equipmentLevel: "Ambition",
      equipmentLevelSource: "cebia",
      equipmentLevelVerified: true,
    }),
    { label: "CEBIA + ověřeno", tone: "verified" }
  );
});

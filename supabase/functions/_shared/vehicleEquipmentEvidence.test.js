import test from "node:test";
import assert from "node:assert/strict";
import { equipmentExtractionInstructions, normalizeEquipmentEvidence, specificationEquipmentEvidence } from "./vehicleEquipmentEvidence.js";

test("maps the supplied English CEBIA specification to catalogue equipment", () => {
  const result = specificationEquipmentEvidence({
    source: "cebia", transmissionText: "7-SPEED DUAL CLUTCH AUTOMATIC GEARBOX – FRONT WHEEL DRIVE",
    gearCountText: "7", driveText: "FWD", emissionsText: "EURO 6D OBD IUPR RDE WLTP",
  });
  assert.deepEqual(result.map((item) => item.name), ["Automatická převodovka", "7 rychlostních stupňů", "EURO VI"]);
  assert.equal(result.every((item) => item.source === "cebia" && item.note), true);
});

test("does not turn codes, missing data, ambiguous sources or negatives into equipment", () => {
  assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", transmissionText: "DW5007", driveText: "FWD" }), []);
  assert.deepEqual(specificationEquipmentEvidence({ source: "photo", transmissionText: "AUT", gearCountText: "7" }), []);
  assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", transmissionText: "automatic gearbox not fitted" }), []);
  assert.equal(specificationEquipmentEvidence({ source: "cebia", transmissionText: "AUT" })[0].name, "Automatická převodovka");
  assert.equal(specificationEquipmentEvidence({ source: "cebia", transmissionText: "6-speed manual gearbox" })[0].name, "Manuální převodovka");
});

test("uses the full current catalogue, aliases and strict evidence confidence", () => {
  assert.deepEqual(normalizeEquipmentEvidence([
    { name: "USB", source: "cebia", confidence: 0.9 },
    { name: "Satelitní navigace", source: "cebia", confidence: 0.9 },
    { name: "Navigace", source: "photo", confidence: 0.9 },
    { name: "Litá kola", source: "photo", confidence: 0.6 },
    { name: "Neznámé", source: "cebia", confidence: 1 },
  ]).map((item) => item.name), ["USB", "Navigace"]);
  assert.match(equipmentExtractionInstructions(), /Informace o vozidle/);
  assert.match(equipmentExtractionInstructions(), /7-SPEED/);
});

test("handler carries CEBIA and photos to extraction and returns translated specification without web comparison", async () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;
  let handler;
  let calls = 0;
  globalThis.Deno = { env: { get: () => "test-key" }, serve: (fn) => { handler = fn; } };
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.tools, undefined);
    const content = body.input[1].content;
    assert.equal(content.filter((item) => item.type === "input_image").length, 2);
    assert.match(content[0].text, /Vehicle information/);
    assert.match(content[0].text, /USB/);
    return Response.json({ output_text: JSON.stringify({
      technicalParams: { equipmentEvidence: [{ name: "USB", source: "photo", confidence: 0.9, note: "Foto 1: USB konektor" }] },
      vehicleSpecification: { source: "cebia", transmissionText: "7-SPEED DUAL CLUTCH AUTOMATIC GEARBOX", gearCountText: "7" },
    }) });
  };
  try {
    await import("../analyze-vehicle-technical-data/index.ts");
    const response = await handler(new Request("https://example.com/analyze", { method: "POST", body: JSON.stringify({
      car: { technicalParams: { brand: "Renault", model: "Arkana" } },
      equipmentOnly: true, cebiaFiles: ["https://example.com/cebia-page.png"], vehiclePhotos: ["https://example.com/interior.jpg"],
    }) }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(result.equipment, ["USB", "Automatická převodovka", "7 rychlostních stupňů"]);
  } finally { globalThis.Deno = originalDeno; globalThis.fetch = originalFetch; }
});

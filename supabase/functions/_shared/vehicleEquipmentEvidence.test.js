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

test("reads explicit airbag totals, both window axles and emission variants", () => {
  for (const windowsText of ["FRONT AND REAR ELECTRIC WINDOWS", "el. přední i zadní okna", "4 electric windows", "all power windows"]) {
    const result = specificationEquipmentEvidence({ source: "cebia", airbagCountText: "6 airbags", windowsText, emissionsText: "EURO 6d-TEMP" });
    assert.deepEqual(result.map((item) => item.name), ["6× airbag", "Elektrická přední okna", "Elektrická zadní okna", "EURO VI"]);
    assert.ok(result.every((item) => item.note && item.source === "cebia"));
  }
  for (const emissionsText of ["EURO VI", "EURO 6D OBD IUPR RDE WLTP", "Emisní norma: EURO 6", "EURO 6b", "EURO 6d-ISC-FCM"]) {
    assert.equal(specificationEquipmentEvidence({ source: "cebia", emissionsText })[0]?.name, "EURO VI", emissionsText);
  }
  assert.equal(specificationEquipmentEvidence({ source: "cebia", emissionsText: "EURO 5" })[0].name, "EURO V");
});

test("does not invent airbag totals, window axles or emission standards", () => {
  for (const airbagCountText of ["front, side and curtain airbags", "6 airbags optional", "6 nebo 8", "6 airbags not fitted"]) {
    assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", airbagCountText }), []);
  }
  for (const windowsText of ["electric windows", "front electric windows, rear manual windows", "no rear electric windows", "bez elektrických zadních oken", "příprava pro elektrická přední i zadní okna"]) {
    assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", windowsText }), [], windowsText);
  }
  assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", windowsText: "front electric windows" }).map((item) => item.name), ["Elektrická přední okna"]);
  assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", windowsText: "rear electric windows" }).map((item) => item.name), ["Elektrická zadní okna"]);
  assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", windowsText: "front electric windows, 4 doors" }).map((item) => item.name), ["Elektrická přední okna"]);
  for (const emissionsText of ["EURO 60", "EURO 7", "EURO 6 optional", "EURO 6?", "DPF", "EURO 6 nebo EURO 5", "EURO 6 není potvrzeno"]) {
    assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", emissionsText }), [], emissionsText);
  }
});

test("rejects contradictory specifications and photo guesses of invisible totals", () => {
  assert.deepEqual(normalizeEquipmentEvidence([
    { name: "6 airbags", source: "cebia", confidence: 0.95 },
    { name: "8× airbag", source: "cebia", confidence: 0.95 },
    { name: "EURO 6d", source: "photo", confidence: 0.99 },
    { name: "7 rychlostních stupňů", source: "photo", confidence: 0.99 },
  ]), []);
});

test("maps installed radio without inferring unsupported multimedia features", () => {
  for (const radioText of ["RADIO", "Rádio s Bluetooth", "Car radio / CD / USB"]) {
    assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", radioText }).map((item) => item.name), ["Autorádio"]);
  }
  for (const radioText of ["Radio preparation", "Radio not fitted", "Radio optional", "Příprava pro rádio", "Radio ready", "Radio není ve výbavě"]) {
    assert.deepEqual(specificationEquipmentEvidence({ source: "cebia", radioText }), []);
  }
  assert.deepEqual(normalizeEquipmentEvidence([{ name: "Rádio", source: "cebia", confidence: 0.95 }]).map((item) => item.name), ["Autorádio"]);
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
      vehicleSpecification: { source: "cebia", transmissionText: "7-SPEED DUAL CLUTCH AUTOMATIC GEARBOX", gearCountText: "7", airbagCountText: "6", windowsText: "FRONT AND REAR ELECTRIC WINDOWS", emissionsText: "EURO 6d" },
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
    assert.deepEqual(result.equipment, ["USB", "Automatická převodovka", "7 rychlostních stupňů", "6× airbag", "Elektrická přední okna", "Elektrická zadní okna", "EURO VI"]);
  } finally { globalThis.Deno = originalDeno; globalThis.fetch = originalFetch; }
});

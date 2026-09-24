import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createTirePhotoPath,
  filterTireSets,
  formatTireAge,
  mapTirePhotoRow,
  mapTireSetRow,
  mapTireSetToPayload,
  MAX_TIRE_PHOTO_BYTES,
  parseDotCode,
  validateTirePhotoFile,
  validateTireSet,
} from "./tireSets.js";
import {
  buildTireSetDraftFromAnalysis,
  validateTirePhotoAnalysisOutput,
} from "./tirePhotoAnalysis.js";

const validSet = {
  id: "set-1",
  storageNumber: 12,
  name: "Continental WinterContact",
  tireSize: "205/55 R16",
  treadDepthMm: "6.5",
  dotCode: "2321",
  season: "winter",
  assemblyType: "alloy_wheels",
  boltPattern: "5x112",
  et: "45",
  quantity: 4,
  status: "in_stock",
  notes: "Regál B",
};

describe("tireSets – mapování", () => {
  test("mapuje databázový řádek do UI modelu", () => {
    const result = mapTireSetRow({
      id: "set-1",
      storage_number: 12,
      name: "Continental",
      tire_size: "205/55 R16",
      tread_depth_mm: 6.5,
      dot_code: "2321",
      assembly_type: "alloy_wheels",
      bolt_pattern: "5x112",
      et: 45,
      quantity: 4,
      season: "winter",
      status: "in_stock",
      notes: "Regál B",
    });

    assert.equal(result.storageNumber, 12);
    assert.equal(result.treadDepthMm, 6.5);
    assert.equal(result.dotCode, "2321");
    assert.equal(result.assemblyType, "alloy_wheels");
  });

  test("trimuje texty a číselné hodnoty převádí pro databázi", () => {
    const payload = mapTireSetToPayload({ ...validSet, name: "  Continental  " });
    assert.equal(payload.name, "Continental");
    assert.equal(payload.tread_depth_mm, 6.5);
    assert.equal(payload.dot_code, "2321");
    assert.equal(payload.et, 45);
  });

  test("u samotných pneumatik neposílá rozteč ani ET", () => {
    const payload = mapTireSetToPayload({
      ...validSet,
      assemblyType: "tires_only",
    });
    assert.equal(payload.bolt_pattern, null);
    assert.equal(payload.et, null);
  });
});

describe("tireSets – DOT a stáří", () => {
  test("převede DOT na týden a celý rok", () => {
    assert.deepEqual(parseDotCode("23 21"), {
      dotCode: "2321",
      week: 23,
      year: 2021,
    });
  });

  test("odmítne neplatný týden nebo neúplný DOT", () => {
    assert.equal(parseDotCode("5421"), null);
    assert.equal(parseDotCode("321"), null);
    assert.equal(validateTireSet({ ...validSet, dotCode: "5421" }).valid, false);
  });

  test("spočítá orientační aktuální stáří z DOT", () => {
    assert.equal(formatTireAge("0120", new Date("2026-09-24T00:00:00Z")), "6 let 8 měs.");
  });

  test("starší záznam bez DOT zůstane platný", () => {
    assert.equal(validateTireSet({ ...validSet, dotCode: "" }).valid, true);
    assert.equal(formatTireAge(""), "Stáří nelze určit");
  });
});

describe("tireSets – skladová čísla", () => {
  test("odmítne aktivní duplicitu skladového čísla", () => {
    const result = validateTireSet(
      { ...validSet, id: "set-2" },
      [validSet]
    );
    assert.equal(result.valid, false);
    assert.match(result.error, /už používá jiná sada/);
  });

  test("po vyřazení lze číslo použít pro novou sadu", () => {
    const result = validateTireSet(
      { ...validSet, id: "set-new" },
      [{ ...validSet, status: "retired" }]
    );
    assert.equal(result.valid, true);
  });

  test("vyřazení zachová historický záznam bez konfliktu čísla", () => {
    const result = validateTireSet(
      { ...validSet, status: "retired" },
      [{ ...validSet, id: "set-2" }]
    );
    assert.equal(result.valid, true);
  });

  test("povolí pouze čísla 1 až 100", () => {
    assert.equal(validateTireSet({ ...validSet, storageNumber: 0 }).valid, false);
    assert.equal(validateTireSet({ ...validSet, storageNumber: 101 }).valid, false);
  });
});

describe("tireSets – filtrace", () => {
  test("hledá podle čísla, názvu, rozměru i rozteče", () => {
    const items = [
      validSet,
      {
        ...validSet,
        id: "set-2",
        storageNumber: 25,
        name: "Michelin",
        boltPattern: "4x100",
      },
    ];
    assert.deepEqual(filterTireSets(items, { query: "5x112" }).map((item) => item.id), ["set-1"]);
    assert.deepEqual(filterTireSets(items, { query: "12" }).map((item) => item.id), ["set-1"]);
  });

  test("filtruje podle sezóny, provedení a stavu", () => {
    const items = [validSet, { ...validSet, id: "set-2", season: "summer", status: "reserved" }];
    const result = filterTireSets(items, {
      season: "summer",
      assemblyType: "alloy_wheels",
      status: "reserved",
    });
    assert.deepEqual(result.map((item) => item.id), ["set-2"]);
  });
});

describe("tireSets – fotografie", () => {
  test("povolí JPG, PNG a WebP do 10 MB", () => {
    assert.equal(
      validateTirePhotoFile({ type: "image/jpeg", size: 1024 }).valid,
      true
    );
    assert.equal(
      validateTirePhotoFile({ type: "image/png", size: 2048 }).valid,
      true
    );
    assert.equal(
      validateTirePhotoFile({ type: "image/webp", size: 2048 }).valid,
      true
    );
  });

  test("odmítne nepodporovaný formát a příliš velký soubor", () => {
    assert.equal(
      validateTirePhotoFile({ type: "application/pdf", size: 1024 }).valid,
      false
    );
    assert.equal(
      validateTirePhotoFile({
        type: "image/jpeg",
        size: MAX_TIRE_PHOTO_BYTES + 1,
      }).valid,
      false
    );
  });

  test("vytvoří cestu oddělenou podle ID sady", () => {
    assert.equal(
      createTirePhotoPath(
        "tire-set-id",
        { name: "Přední kolo.JPG" },
        "photo-id"
      ),
      "tire-set-id/photo-id.jpg"
    );
  });

  test("mapuje databázovou fotografii včetně podepsané URL", () => {
    const photo = mapTirePhotoRow(
      {
        id: "photo-id",
        tire_set_id: "set-id",
        file_path: "set-id/photo-id.jpg",
        file_name: "kolo.jpg",
      },
      "https://signed.example/photo"
    );
    assert.equal(photo.tireSetId, "set-id");
    assert.equal(photo.signedUrl, "https://signed.example/photo");
  });
});

describe("tireSets – bezpečné AI rozpoznání fotografií", () => {
  const confirmed = (value, evidence = "Údaj je čitelný na bočnici.") => ({
    value,
    status: "confirmed",
    evidence,
  });
  const unreadable = (evidence = "Detail není na fotografii vidět.") => ({
    value: null,
    status: "unreadable",
    evidence,
  });

  test("předvyplní potvrzené údaje a dovolí označený odhad vzorku", () => {
    const analysis = validateTirePhotoAnalysisOutput({
      fields: {
        name: confirmed("Continental WinterContact"),
        tireSize: confirmed("205/55 R16"),
        treadDepthMm: { value: 6, status: "estimated", evidence: "Na fotografii je měrka." },
        dotCode: confirmed("2321"),
        season: confirmed("winter"),
        assemblyType: confirmed("alloy_wheels"),
        boltPattern: unreadable(),
        et: confirmed(45),
        quantity: confirmed(4),
      },
      summary: "Část údajů byla přečtena.",
      warnings: [],
    });
    const result = buildTireSetDraftFromAnalysis(analysis);

    assert.equal(result.draft.name, "Continental WinterContact");
    assert.equal(result.draft.treadDepthMm, 6);
    assert.equal(result.draft.dotCode, "2321");
    assert.equal(result.draft.boltPattern, "");
    assert.ok(result.warnings.some((warning) => /orientační odhad/.test(warning)));
    assert.ok(result.warnings.some((warning) => /rozteč: z fotografií nelze/.test(warning)));
  });

  test("nejisté údaje kromě vzorku nikdy nepřenese do záznamu", () => {
    const estimated = (value) => ({ value, status: "estimated", evidence: "Pouze odhad." });
    const fields = Object.fromEntries(
      ["name", "tireSize", "dotCode", "season", "assemblyType", "boltPattern"].map((field) => [field, estimated("odhad")])
    );
    fields.treadDepthMm = unreadable();
    fields.et = estimated(45);
    fields.quantity = estimated(4);
    const result = buildTireSetDraftFromAnalysis(
      validateTirePhotoAnalysisOutput({ fields, summary: "", warnings: [] })
    );

    assert.equal(result.draft.name, "");
    assert.equal(result.draft.dotCode, "");
    assert.equal(result.draft.et, "");
    assert.equal(result.draft.quantity, "");
  });

  test("neplatný potvrzený DOT zahodí a zobrazí upozornění", () => {
    const fields = {
      name: confirmed("Michelin"),
      tireSize: unreadable(),
      treadDepthMm: unreadable(),
      dotCode: confirmed("5521"),
      season: unreadable(),
      assemblyType: unreadable(),
      boltPattern: unreadable(),
      et: unreadable(),
      quantity: unreadable(),
    };
    const result = buildTireSetDraftFromAnalysis(
      validateTirePhotoAnalysisOutput({ fields, summary: "", warnings: [] })
    );

    assert.equal(result.draft.dotCode, "");
    assert.ok(result.warnings.some((warning) => /validním čtyřmístném formátu/.test(warning)));
  });
});

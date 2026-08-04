import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildVehicleAnalysisDocumentUrls,
  getFunctionErrorDetail,
  isSupportedVehicleAnalysisDocument,
} from "./vehicleDocumentAnalysis.js";

describe("vehicleDocumentAnalysis – vstupní dokumenty", () => {
  test("podporuje PDF, JPG, JPEG a PNG podle MIME nebo názvu", () => {
    assert.equal(
      isSupportedVehicleAnalysisDocument({ mimeType: "application/pdf" }),
      true
    );
    assert.equal(
      isSupportedVehicleAnalysisDocument({ fileName: "tp-predni.JPG" }),
      true
    );
    assert.equal(
      isSupportedVehicleAnalysisDocument({ filePath: "69/tp-zadni.jpeg" }),
      true
    );
    assert.equal(
      isSupportedVehicleAnalysisDocument({ mime_type: "image/png" }),
      true
    );
    assert.equal(
      isSupportedVehicleAnalysisDocument({ fileName: "poznamky.txt" }),
      false
    );
  });

  test("sloučí nové signed URL s historickými dokumenty bez duplicit", async () => {
    const signedPaths = [];
    const urls = await buildVehicleAnalysisDocumentUrls({
      vehicleDocuments: [
        { filePath: "69/cebia.pdf", mimeType: "application/pdf" },
        { filePath: "69/cebia.pdf", mimeType: "application/pdf" },
        { filePath: "69/tp-predni.jpg", mimeType: "image/jpeg" },
        { filePath: "69/ignorovat.txt", mimeType: "text/plain" },
      ],
      technicalCardPhotos: ["https://legacy.example/tp.png"],
      cebiaFiles: [
        "https://legacy.example/cebia.pdf",
        "https://legacy.example/tp.png",
      ],
      createSignedUrl: async (filePath) => {
        signedPaths.push(filePath);
        return `https://storage.example/${filePath}?token=test`;
      },
    });

    assert.deepEqual(signedPaths, ["69/cebia.pdf", "69/tp-predni.jpg"]);
    assert.deepEqual(urls, [
      "https://legacy.example/tp.png",
      "https://legacy.example/cebia.pdf",
      "https://storage.example/69/cebia.pdf?token=test",
      "https://storage.example/69/tp-predni.jpg?token=test",
    ]);
  });

  test("bez vhodných dokumentů vrátí prázdný seznam", async () => {
    assert.deepEqual(
      await buildVehicleAnalysisDocumentUrls({
        vehicleDocuments: [{ filePath: "69/readme.txt", mimeType: "text/plain" }],
      }),
      []
    );
  });
});

describe("vehicleDocumentAnalysis – chyby Edge Function", () => {
  test("preferuje konkrétní detail z odpovědi funkce", async () => {
    const detail = await getFunctionErrorDetail(
      {
        message: "FunctionsHttpError",
        context: {
          json: async () => ({ error: "PDF se nepodařilo stáhnout." }),
        },
      },
      null
    );

    assert.equal(detail, "PDF se nepodařilo stáhnout.");
  });
});

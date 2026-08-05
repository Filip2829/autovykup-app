import { buildVehicleProfile } from "../utils/buildVehicleProfile.js";
import { getVehicleEconomy } from "../utils/vehicleEconomy.js";
import { getVehicleLifecycleSection } from "../utils/vehicleLifecycle.js";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function uniqueBy(values, getKey) {
  const seen = new Set();

  return values.filter((value) => {
    const key = getKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDocuments(car, documents) {
  const currentDocuments = asArray(documents).map((document) => ({
    id: document.id || "",
    kind: "vehicle-document",
    title: document.title || document.fileName || document.file_name || "",
    category: document.category || "",
    filePath: document.filePath || document.file_path || "",
    fileName: document.fileName || document.file_name || "",
    mimeType: document.mimeType || document.mime_type || "",
  }));
  const legacyTechnicalCards = asArray(
    car.technicalCardPhotos ?? car.technical_card_photos
  ).map((reference, index) => ({
    id: `legacy-technical-card-${index}`,
    kind: "legacy-technical-card",
    title: `Technický průkaz ${index + 1}`,
    category: "Technický průkaz",
    reference,
  }));
  const legacyCebiaFiles = asArray(car.cebiaFiles ?? car.cebia_files).map(
    (reference, index) => ({
      id: `legacy-cebia-${index}`,
      kind: "legacy-cebia",
      title: `CEBIA ${index + 1}`,
      category: "CEBIA",
      reference,
    })
  );

  return uniqueBy(
    [...currentDocuments, ...legacyTechnicalCards, ...legacyCebiaFiles],
    (document) =>
      document.filePath || document.reference || document.id || document.title
  );
}

function normalizePhotos(car) {
  return uniqueBy(
    asArray(car.photos)
      .filter(hasValue)
      .map((reference, index) => ({
        id: `vehicle-photo-${index}`,
        kind: "vehicle-photo",
        reference: String(reference).trim(),
      })),
    (photo) => photo.reference
  );
}

function normalizeReports(car) {
  return uniqueBy(
    [
      car.aiCebiaReport ?? car.ai_cebia_report,
      car.aiDocumentReport ?? car.ai_document_report,
    ]
      .filter(hasValue)
      .map((content, index) => ({
        id: `cebia-report-${index}`,
        kind: "cebia-report",
        content: String(content).trim(),
      })),
    (report) => report.content
  );
}

function normalizeNotes(value) {
  return asArray(value).map(String).map((note) => note.trim()).filter(Boolean);
}

export function buildVehicleAiContext(
  selectedCar,
  { documents, documentsLoading = false } = {}
) {
  const car = asObject(selectedCar);
  const profile = buildVehicleProfile(car, { documents, documentsLoading });
  const valuation = {
    valuationDate: car.valuationDate ?? car.valuation_date ?? "",
    customerExpectedPrice:
      car.customerExpectedPrice ?? car.customer_expected_price ?? null,
    buyEstimate: car.buyEstimate ?? car.buy_estimate ?? null,
    saleEstimate: car.saleEstimate ?? car.sale_estimate ?? null,
    approvedPrice: car.approvedPrice ?? car.approved_price ?? null,
    purchasePrice: car.purchasePrice ?? car.purchase_price ?? null,
    expectedSalePrice:
      car.expectedSalePrice ?? car.expected_sale_price ?? null,
    soldPrice: car.soldPrice ?? car.sold_price ?? null,
    soldDate: car.soldDate ?? car.sold_date ?? "",
  };

  return {
    schemaVersion: 1,
    vehicleId: car.id ?? null,
    lifecycleSection: getVehicleLifecycleSection(car.status),
    vehicleUpdatedAt: car.updatedAt ?? car.updated_at ?? null,
    profile,
    internal: {
      checklist: asObject(car.checklist),
      notes: normalizeNotes(car.notes),
      valuation,
      purchaseEconomy: getVehicleEconomy(car),
    },
    sources: {
      documents: normalizeDocuments(car, documents),
      photos: normalizePhotos(car),
      cebiaReports: normalizeReports(car),
    },
  };
}

import { buildVehicleAnalysisDocumentUrls, getFunctionErrorDetail } from "../utils/vehicleDocumentAnalysis.js";
import { canonicalEquipmentLabel, normalizeEquipment } from "../utils/vehicleEquipment.js";

export async function readCebiaEquipment({ car, documents = [], createSignedUrl, invoke }) {
  const cebiaDocuments = documents.filter((document) =>
    String(document.category || "").trim().toUpperCase() === "CEBIA" &&
    (!document.carId && !document.car_id || String(document.carId || document.car_id) === String(car.id))
  );
  const urls = await buildVehicleAnalysisDocumentUrls({
    vehicleDocuments: cebiaDocuments,
    cebiaFiles: car.cebiaFiles || car.cebia_files || [],
    createSignedUrl,
  });
  const photos = [...new Set((Array.isArray(car.photos) ? car.photos : [])
    .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url) && /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url)))];
  if (!urls.length && !photos.length) throw new Error("Nejdříve nahrajte protokol CEBIA (včetně Informací o vozidle) nebo fotografie vozu.");
  const evidence = [];
  // The server accepts 12 photos at a time; inspect all photos rather than
  // silently dropping the remaining views. Read CEBIA once, in the first batch.
  for (let offset = 0; offset < Math.max(1, photos.length); offset += 12) {
    const batch = photos.slice(offset, offset + 12);
    const batchCebia = offset === 0 ? urls : [];
    const { data, error } = await invoke("analyze-vehicle-technical-data", {
    body: {
      car: { name: car.name, vin: car.vin, year: car.year, technicalParams: {
        brand: car.technicalParams?.brand, model: car.technicalParams?.model,
      } },
      cebiaFiles: batchCebia, technicalCardPhotos: [], vehiclePhotos: batch, equipmentOnly: true,
    },
  });
  if (error || data?.error) throw new Error(await getFunctionErrorDetail(error, data));
    const items = Array.isArray(data?.technicalParams?.equipmentEvidence)
      ? data.technicalParams.equipmentEvidence : [];
    evidence.push(...items.filter((item) => item?.source === "cebia" && batchCebia.length > 0 || item?.source === "photo" && batch.length > 0));
  }
  const equipment = normalizeEquipment(car.equipment);
  const additions = [];
  const seen = new Set();
  for (const item of evidence) {
    const label = canonicalEquipmentLabel(item?.name);
    const confidence = Number(item?.confidence);
    const validSource = item?.source === "cebia" && urls.length > 0 || item?.source === "photo" && photos.length > 0;
    if (!label || !validSource || !Number.isFinite(confidence) || confidence < 0.7 || confidence > 1 || seen.has(label)) continue;
    seen.add(label);
    // An explicit manual removal takes precedence over automatic completion.
    if (equipment[label] === false || equipment[label] === true) continue;
    additions.push({ name: label, source: item.source, confidence, note: typeof item.note === "string" ? item.note.slice(0, 240) : "" });
    equipment[label] = true;
  }
  if (!additions.length) return { addedCount: 0, car };
  const technicalParams = car.technicalParams || car.technical_params || {};
  const existingEvidence = Array.isArray(technicalParams.equipmentEvidence) ? technicalParams.equipmentEvidence : [];
  const newNames = new Set(additions.map((item) => item.name));
  return {
    addedCount: additions.length,
    car: {
      ...car, equipment,
      technicalParams: {
        ...technicalParams,
        equipmentEvidence: [...existingEvidence.filter((item) => !newNames.has(canonicalEquipmentLabel(item?.name))), ...additions],
      },
    },
  };
}

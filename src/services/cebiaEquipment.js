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
  if (!urls.length) throw new Error("Nejdříve nahrajte protokol CEBIA do dokumentů vozidla v sekci Administrativa.");

  // Send identification and CEBIA documents only, without customer or sale notes.
  const { data, error } = await invoke("analyze-vehicle-technical-data", {
    body: {
      car: { name: car.name, vin: car.vin, year: car.year, technicalParams: {
        brand: car.technicalParams?.brand, model: car.technicalParams?.model,
      } },
      cebiaFiles: urls, technicalCardPhotos: [], vehiclePhotos: [],
    },
  });
  if (error || data?.error) throw new Error(await getFunctionErrorDetail(error, data));
  const evidence = Array.isArray(data?.technicalParams?.equipmentEvidence)
    ? data.technicalParams.equipmentEvidence : [];
  const equipment = normalizeEquipment(car.equipment);
  const additions = [];
  const seen = new Set();
  for (const item of evidence) {
    const label = canonicalEquipmentLabel(item?.name);
    const confidence = Number(item?.confidence);
    if (!label || item.source !== "cebia" || !Number.isFinite(confidence) || confidence < 0.7 || seen.has(label)) continue;
    seen.add(label);
    // An explicit manual removal takes precedence over automatic completion.
    if (equipment[label] === false || equipment[label] === true) continue;
    additions.push({ name: label, source: "cebia", confidence, note: typeof item.note === "string" ? item.note.slice(0, 240) : "" });
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

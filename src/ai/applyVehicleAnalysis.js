import { canonicalEquipmentLabel, normalizeEquipment } from "../utils/vehicleEquipment.js";

export async function applyVehicleAnalysis({
  selectedCar,
  technicalParams = {},
  cebiaHistory = {},
  equipment = [],
  report,
  allowedEquipment = [],
  updateCar,
}) {
  const updatedEquipment = { ...normalizeEquipment(selectedCar?.equipment) };

  for (const item of equipment) {
    const canonical = canonicalEquipmentLabel(item) || item;
    if (allowedEquipment.includes(canonical)) updatedEquipment[canonical] = true;
  }

  return updateCar({
    ...selectedCar,
    technicalParams: {
      ...(selectedCar?.technicalParams || {}),
      ...technicalParams,
    },
    cebiaHistory: {
      ...(selectedCar?.cebiaHistory || {}),
      ...cebiaHistory,
    },
    equipment: updatedEquipment,
    aiDocumentReport: report,
    aiCebiaReport: selectedCar?.aiCebiaReport || report,
  });
}

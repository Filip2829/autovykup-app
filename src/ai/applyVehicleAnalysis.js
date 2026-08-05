export async function applyVehicleAnalysis({
  selectedCar,
  technicalParams = {},
  cebiaHistory = {},
  equipment = [],
  report,
  allowedEquipment = [],
  updateCar,
}) {
  const updatedEquipment = { ...(selectedCar?.equipment || {}) };

  for (const item of equipment) {
    if (allowedEquipment.includes(item)) updatedEquipment[item] = true;
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

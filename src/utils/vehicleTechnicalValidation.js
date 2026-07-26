function normalizeRequiredText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeVehicleTechnicalIdentity(technicalParams = {}) {
  return {
    ...technicalParams,
    brand: normalizeRequiredText(technicalParams?.brand),
    model: normalizeRequiredText(technicalParams?.model),
  };
}

export function validateVehicleTechnicalIdentity(technicalParams = {}) {
  const normalized = normalizeVehicleTechnicalIdentity(technicalParams);
  const missingFields = [];

  if (!normalized.brand) missingFields.push("značku");
  if (!normalized.model) missingFields.push("model");

  if (missingFields.length === 0) {
    return {
      valid: true,
      error: "",
      normalized,
    };
  }

  return {
    valid: false,
    error: `Doplňte ${missingFields.join(" a ")} vozidla v Technických parametrech.`,
    normalized,
  };
}

export function validateVehicleIdentityForMatching(
  car = {},
  relevantStatuses = []
) {
  if (!relevantStatuses.includes(car?.status)) {
    return {
      valid: true,
      error: "",
      skipped: true,
    };
  }

  return {
    ...validateVehicleTechnicalIdentity(
      car?.technicalParams || car?.technical_params
    ),
    skipped: false,
  };
}

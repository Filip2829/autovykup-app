function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasObjectValue(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some((item) =>
    item && typeof item === "object" ? hasObjectValue(item) : hasValue(item)
  );
}

export function getVehicleAiSourceAvailability(context) {
  const profile = context?.profile || {};
  const internal = context?.internal || {};
  const sources = context?.sources || {};

  return {
    identity: [
      profile.identity?.name,
      profile.identity?.brand,
      profile.identity?.model,
      profile.identity?.vin,
    ].some(hasValue),
    technical: [
      profile.technical?.year,
      profile.technical?.firstRegistration,
      profile.technical?.mileage,
      profile.technical?.engine,
      profile.technical?.powerKw,
      profile.technical?.fuel,
      profile.technical?.transmission,
    ].some(hasValue),
    documents: Array.isArray(sources.documents) && sources.documents.length > 0,
    cebia:
      Boolean(profile.history?.cebiaAvailable) ||
      (Array.isArray(sources.cebiaReports) && sources.cebiaReports.length > 0),
    condition: Boolean(profile.condition?.hasStructuredData),
    equipment: Number(profile.equipment?.count || 0) > 0,
    checklist: hasObjectValue(internal.checklist),
    notes: Array.isArray(internal.notes) && internal.notes.length > 0,
    valuation: hasObjectValue(internal.valuation),
    photos: Array.isArray(sources.photos) && sources.photos.length > 0,
  };
}

export function evaluateVehicleAiCapabilities(context, moduleDefinition) {
  const availability = getVehicleAiSourceAvailability(context);
  const requiredSources = moduleDefinition?.requiredSources || [];
  const optionalSources = moduleDefinition?.optionalSources || [];
  const missingRequiredSources = requiredSources.filter(
    (source) => !availability[source]
  );

  return {
    availability,
    missingRequiredSources,
    availableSources: [...requiredSources, ...optionalSources].filter(
      (source) => availability[source]
    ),
    canRun: missingRequiredSources.length === 0,
  };
}

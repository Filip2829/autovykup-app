export const VEHICLE_AI_SCHEMA_VERSION = 1;

export function createVehicleAiResponse({
  moduleId,
  output = {},
  sourceReferences = [],
  missingData = [],
  warnings = [],
  proposedChanges = [],
  generatedAt = new Date().toISOString(),
}) {
  return {
    schemaVersion: VEHICLE_AI_SCHEMA_VERSION,
    moduleId,
    status: "completed",
    generatedAt,
    output,
    sourceReferences,
    missingData,
    warnings,
    proposedChanges,
  };
}

export function isVehicleAiResponse(value) {
  return Boolean(
    value &&
      value.schemaVersion === VEHICLE_AI_SCHEMA_VERSION &&
      typeof value.moduleId === "string" &&
      value.status === "completed" &&
      value.output &&
      typeof value.output === "object" &&
      Array.isArray(value.sourceReferences) &&
      Array.isArray(value.missingData) &&
      Array.isArray(value.warnings) &&
      Array.isArray(value.proposedChanges)
  );
}

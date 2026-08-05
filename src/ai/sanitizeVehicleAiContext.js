function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeVehicleAiContext(context, moduleDefinition) {
  const sanitized = {
    schemaVersion: context.schemaVersion,
    vehicleId: context.vehicleId,
    lifecycleSection: context.lifecycleSection,
    vehicleUpdatedAt: context.vehicleUpdatedAt,
    profile: clone(context.profile || {}),
    sources: clone(context.sources || {}),
  };

  if (moduleDefinition?.dataScope === "internal") {
    sanitized.internal = clone(context.internal || {});
  }

  return sanitized;
}

export const VEHICLE_LIFECYCLE_SECTIONS = {
  VALUATION: "valuation",
  APPROVED_PURCHASE: "approved_purchase",
  STOCK: "stock",
  SOLD: "sold",
  ARCHIVED: "archived",
};

export const VEHICLE_STATUSES_BY_SECTION = {
  [VEHICLE_LIFECYCLE_SECTIONS.VALUATION]: ["valuation"],
  [VEHICLE_LIFECYCLE_SECTIONS.APPROVED_PURCHASE]: [
    "approved_for_purchase",
  ],
  [VEHICLE_LIFECYCLE_SECTIONS.STOCK]: [
    "purchased",
    "commission",
    "preparation",
    "ready_for_advertising",
    "advertised",
    "reserved",
  ],
  [VEHICLE_LIFECYCLE_SECTIONS.SOLD]: ["sold"],
  [VEHICLE_LIFECYCLE_SECTIONS.ARCHIVED]: ["archived"],
};

const legacyStatusSections = {
  "Chybí podklady": VEHICLE_LIFECYCLE_SECTIONS.VALUATION,
  "Připraveno k nacenění": VEHICLE_LIFECYCLE_SECTIONS.VALUATION,
  "Nacenění hotové": VEHICLE_LIFECYCLE_SECTIONS.VALUATION,
  "Výkupní cena potvrzena": VEHICLE_LIFECYCLE_SECTIONS.APPROVED_PURCHASE,
};

export function getVehicleLifecycleSection(status) {
  for (const [section, statuses] of Object.entries(
    VEHICLE_STATUSES_BY_SECTION
  )) {
    if (statuses.includes(status)) return section;
  }

  return legacyStatusSections[status] || VEHICLE_LIFECYCLE_SECTIONS.VALUATION;
}

export function filterVehiclesByLifecycleSection(vehicles, section) {
  return (Array.isArray(vehicles) ? vehicles : []).filter(
    (vehicle) => getVehicleLifecycleSection(vehicle?.status) === section
  );
}

const allLifecycleSections = [
  "valuation",
  "approved_purchase",
  "stock",
  "sold",
  "archived",
];

export const aiModuleRegistry = [
  {
    id: "price-recommendation",
    label: "AI nacenění podle trhu",
    description:
      "Porovnání se Sauto a návrh prodejní i výkupní ceny.",
    supportedSections: ["valuation", "approved_purchase", "stock"],
    requiredSources: ["identity", "technical"],
    optionalSources: ["condition", "equipment", "valuation"],
    dataScope: "internal",
    resultMode: "review-only",
    enabled: true,
  },
  {
    id: "vehicle-summary",
    label: "AI souhrn vozidla",
    description: "Přehled uložených údajů bez změny vozidla.",
    supportedSections: allLifecycleSections,
    requiredSources: ["identity", "technical"],
    optionalSources: [
      "documents",
      "cebia",
      "condition",
      "equipment",
      "checklist",
      "notes",
      "valuation",
    ],
    dataScope: "internal",
    resultMode: "review-only",
    enabled: true,
  },
  {
    id: "purchase-inspection",
    label: "Specifická rizika vozu",
    description:
      "Modelově a motorizací specifické body, na které se zaměřit před výkupem.",
    supportedSections: ["valuation", "approved_purchase"],
    requiredSources: ["identity", "technical"],
    optionalSources: ["condition", "equipment", "photos", "notes"],
    dataScope: "internal",
    resultMode: "review-only",
    enabled: true,
  },
  {
    id: "purchase-assistant",
    label: "Výkupní asistent",
    supportedSections: ["valuation", "approved_purchase"],
    enabled: false,
  },
  {
    id: "sales-card",
    label: "Prodejní karta",
    supportedSections: ["stock", "sold"],
    enabled: false,
  },
  {
    id: "readiness-assistant",
    label: "AI kontrola připravenosti vozu",
    supportedSections: ["stock"],
    enabled: false,
  },
];

export function getAiModule(moduleId) {
  return aiModuleRegistry.find((module) => module.id === moduleId) || null;
}

export function getAvailableAiModules(lifecycleSection) {
  return aiModuleRegistry.filter(
    (module) =>
      module.enabled === true &&
      module.supportedSections.includes(lifecycleSection)
  );
}

export function getPlannedAiModules(lifecycleSection) {
  return aiModuleRegistry.filter(
    (module) =>
      module.enabled !== true &&
      module.supportedSections.includes(lifecycleSection)
  );
}

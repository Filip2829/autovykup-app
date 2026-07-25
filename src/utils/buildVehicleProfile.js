const highlightedEquipmentPriority = [
  "Adaptivní tempomat",
  "Automatická klimatizace",
  "Navigace",
  "Apple CarPlay",
  "Android Auto",
  "Couvací kamera",
  "Parkovací senzory přední",
  "Parkovací senzory zadní",
  "Matrix LED světlomety",
  "LED světlomety",
  "Vyhřívaná sedadla",
  "Vyhřívaný volant",
  "Kožené sedačky",
  "Digitální kokpit",
  "Tažné zařízení",
  "Bluetooth",
];

const structuredDamageFields = [
  "overallCondition",
  "exterior",
  "interior",
  "technical",
  "tiresBrakes",
  "glassLights",
  "otherDamage",
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value) {
  return isObject(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasPositiveNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

function firstDefined(...values) {
  return values.find(
    (value) => value !== null && value !== undefined && value !== ""
  );
}

function firstValue(...values) {
  const value = values.find(hasValue);
  return hasValue(value) ? value : "";
}

function firstPositiveNumber(...values) {
  const value = values.find(hasPositiveNumber);
  return value === undefined ? null : Number(value);
}

function getActiveEquipment(equipment) {
  const seen = new Set();

  return Object.entries(equipment)
    .filter(([label, enabled]) => enabled === true && hasValue(label))
    .map(([label]) => String(label).trim())
    .filter((label) => {
      const normalizedLabel = label.toLocaleLowerCase("cs-CZ");
      if (seen.has(normalizedLabel)) return false;
      seen.add(normalizedLabel);
      return true;
    });
}

function getHighlightedEquipment(activeItems) {
  const priority = new Map(
    highlightedEquipmentPriority.map((label, index) => [
      label.toLocaleLowerCase("cs-CZ"),
      index,
    ])
  );

  return [...activeItems]
    .sort((left, right) => {
      const leftPriority =
        priority.get(left.toLocaleLowerCase("cs-CZ")) ??
        Number.MAX_SAFE_INTEGER;
      const rightPriority =
        priority.get(right.toLocaleLowerCase("cs-CZ")) ??
        Number.MAX_SAFE_INTEGER;

      return (
        leftPriority - rightPriority ||
        left.localeCompare(right, "cs-CZ")
      );
    })
    .slice(0, 12);
}

function hasCebiaData(cebiaHistory) {
  return Object.values(cebiaHistory).some(hasValue);
}

function isTechnicalDocument(document) {
  return (
    document?.isLegacyTechnicalCard === true ||
    document?.category === "Technický průkaz"
  );
}

function getDocumentProfile(car, runtime) {
  const hasRuntimeDocuments = Object.prototype.hasOwnProperty.call(
    runtime,
    "documents"
  );
  const runtimeDocuments = asArray(runtime.documents);
  const legacyTechnicalDocuments = asArray(
    car.technicalCardPhotos ?? car.technical_card_photos
  );
  const documents = hasRuntimeDocuments
    ? runtimeDocuments
    : legacyTechnicalDocuments.map((url, index) => ({
        id: `legacy-technical-card-${index}`,
        legacyUrl: url,
        isLegacyTechnicalCard: true,
      }));
  const technicalDocumentsCount = documents.filter(
    isTechnicalDocument
  ).length;
  const standardDocumentsCount =
    documents.length - technicalDocumentsCount;
  const cebiaFilesCount = asArray(
    car.cebiaFiles ?? car.cebia_files
  ).length;

  return {
    standardDocumentsCount,
    technicalDocumentsCount,
    cebiaFilesCount,
    totalCount:
      standardDocumentsCount +
      technicalDocumentsCount +
      cebiaFilesCount,
    isLoading: Boolean(runtime.documentsLoading),
  };
}

export function buildVehicleProfile(
  selectedCar,
  { documents, documentsLoading = false, ...runtime } = {}
) {
  const car = asObject(selectedCar);
  const technicalParams = asObject(
    car.technicalParams ?? car.technical_params
  );
  const advertisingData = asObject(
    car.advertisingData ?? technicalParams.advertisingData
  );
  const damageReport = asObject(car.damageReport ?? car.damage_report);
  const cebiaHistory = asObject(car.cebiaHistory ?? car.cebia_history);
  const equipmentData = asObject(car.equipment);
  const checklist = asObject(car.checklist);
  const photos = asArray(car.photos);
  const activeItems = getActiveEquipment(equipmentData);
  const structuredFieldCount = structuredDamageFields.filter((field) =>
    hasValue(damageReport[field])
  ).length;
  const expectedSalePrice = firstDefined(
    car.expectedSalePrice,
    car.expected_sale_price
  );
  const saleEstimate = firstDefined(car.saleEstimate, car.sale_estimate);
  const effectiveSalePrice = firstPositiveNumber(
    car.expectedSalePrice,
    car.expected_sale_price,
    car.saleEstimate,
    car.sale_estimate
  );
  const cebiaDocumentsAvailable =
    asArray(car.cebiaFiles ?? car.cebia_files).length > 0;
  const cebiaReportAvailable = hasValue(
    car.aiCebiaReport ?? car.ai_cebia_report
  );
  const cebiaHistoryAvailable = hasCebiaData(cebiaHistory);
  const technicalReadinessGroups = [
    hasValue(car.year) ||
      hasValue(technicalParams.productionYear) ||
      hasValue(technicalParams.firstRegistration),
    hasPositiveNumber(car.km),
    hasValue(technicalParams.fuel),
    hasValue(technicalParams.transmission),
    hasValue(technicalParams.engine) || hasValue(technicalParams.powerKw),
  ];
  const publicDamage = {
    overallCondition: firstValue(damageReport.overallCondition),
    exterior: firstValue(damageReport.exterior),
    interior: firstValue(damageReport.interior),
    technical: firstValue(damageReport.technical),
    tiresBrakes: firstValue(damageReport.tiresBrakes),
    glassLights: firstValue(damageReport.glassLights),
    otherDamage: firstValue(damageReport.otherDamage),
    cebiaDamageHistory: firstValue(cebiaHistory.damageHistory),
    mileageSuspicion: firstValue(cebiaHistory.mileageSuspicion),
    cebiaRiskNotes: firstValue(cebiaHistory.riskNotes),
  };
  const preparationData = {
    highlights: firstValue(advertisingData.highlights),
    defects: firstValue(advertisingData.defects),
    repairs: firstValue(advertisingData.repairs),
    listingNote: firstValue(advertisingData.listingNote),
  };
  const runtimeDocuments = {
    ...runtime,
    documentsLoading,
  };

  if (documents !== undefined) runtimeDocuments.documents = documents;

  return {
    identity: {
      id: firstValue(car.id),
      name: firstValue(car.name),
      brand: firstValue(technicalParams.brand),
      model: firstValue(technicalParams.model),
      version: firstValue(
        technicalParams.version,
        technicalParams.equipmentLevel
      ),
      vin: firstValue(car.vin),
      registrationPlate: firstValue(car.spz),
      status: firstValue(car.status),
      hasSufficientIdentification:
        (hasValue(car.name) && String(car.name).trim().length >= 3) ||
        hasValue(technicalParams.brand) ||
        hasValue(technicalParams.model),
    },
    technical: {
      year: firstValue(car.year, technicalParams.productionYear),
      productionYear: firstValue(technicalParams.productionYear),
      firstRegistration: firstValue(technicalParams.firstRegistration),
      mileage: firstValue(car.km),
      engine: firstValue(technicalParams.engine),
      powerKw: firstValue(technicalParams.powerKw),
      fuel: firstValue(technicalParams.fuel),
      transmission: firstValue(technicalParams.transmission),
      drive: firstValue(technicalParams.drive),
      bodyType: firstValue(technicalParams.bodyType),
      color: firstValue(technicalParams.color),
      consumption: firstValue(technicalParams.consumption),
      emissions: firstValue(technicalParams.emissions),
      warranty: firstValue(technicalParams.warranty),
      readinessCoverageCount: technicalReadinessGroups.filter(Boolean).length,
      readinessCoverageTotal: technicalReadinessGroups.length,
    },
    pricing: {
      expectedSalePrice: expectedSalePrice ?? null,
      saleEstimate: saleEstimate ?? null,
      effectiveSalePrice,
    },
    history: {
      origin: firstValue(
        cebiaHistory.countryOfOrigin,
        technicalParams.origin
      ),
      imported: firstValue(cebiaHistory.importInfo),
      ownersCount: firstValue(cebiaHistory.owners),
      previousUse: firstValue(cebiaHistory.taxiOrRental),
      serviceHistory: Boolean(checklist["Servisní historie"]),
      stk: firstValue(technicalParams.stkValidUntil),
      cebiaWarranty: firstValue(cebiaHistory.warranty),
      warranty: firstValue(
        technicalParams.warranty,
        cebiaHistory.warranty,
        advertisingData.warranty
      ),
      cebiaDocumentsAvailable,
      cebiaReportAvailable,
      cebiaHistoryAvailable,
      cebiaAvailable:
        cebiaDocumentsAvailable ||
        cebiaReportAvailable ||
        cebiaHistoryAvailable,
    },
    media: {
      photosCount: photos.length,
      heroPhoto: photos[0] || "",
    },
    equipment: {
      activeItems,
      highlightedItems: getHighlightedEquipment(activeItems),
      count: activeItems.length,
    },
    condition: {
      publicDefects: firstValue(advertisingData.defects),
      publicDamage,
      completedRepairs: firstValue(advertisingData.repairs),
      hasStructuredData: structuredFieldCount > 0,
      structuredFieldCount,
      requiresReview: structuredFieldCount === 0,
    },
    documents: getDocumentProfile(car, runtimeDocuments),
    advertising: {
      preparationData,
      hasPreparationData: Object.values(preparationData).some(hasValue),
      customerEmailText: firstValue(advertisingData.customerEmailText),
      onlineListingText: firstValue(advertisingData.onlineListingText),
      listingNote: firstValue(advertisingData.listingNote),
    },
  };
}

const readinessStatus = {
  DONE: "done",
  MISSING: "missing",
  REVIEW: "review",
};

const readinessStatusLabels = {
  [readinessStatus.DONE]: "Hotovo",
  [readinessStatus.MISSING]: "Chybí",
  [readinessStatus.REVIEW]: "Vyžaduje kontrolu",
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasPositiveNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

function getSellingPrice(car = {}) {
  return [
    car.expectedSalePrice,
    car.expected_sale_price,
    car.saleEstimate,
    car.sale_estimate,
  ].find(hasPositiveNumber);
}

function countSelectedEquipment(equipment = {}) {
  return Object.values(equipment).filter(Boolean).length;
}

function countFilledDamageFields(damageReport = {}) {
  return [
    damageReport.overallCondition,
    damageReport.exterior,
    damageReport.interior,
    damageReport.technical,
    damageReport.tiresBrakes,
    damageReport.glassLights,
    damageReport.otherDamage,
  ].filter(hasValue).length;
}

function getTechnicalCoverage(car, technicalParams) {
  const checks = [
    hasValue(car.year) ||
      hasValue(technicalParams.productionYear) ||
      hasValue(technicalParams.firstRegistration),
    hasPositiveNumber(car.km),
    hasValue(technicalParams.fuel),
    hasValue(technicalParams.transmission),
    hasValue(technicalParams.engine) || hasValue(technicalParams.powerKw),
  ];

  return checks.filter(Boolean).length;
}

function getOnlineListingText(advertisingData) {
  return advertisingData.onlineListingText;
}

function hasOnlineListingPreparation(advertisingData) {
  return [
    advertisingData.highlights,
    advertisingData.defects,
    advertisingData.repairs,
    advertisingData.listingNote,
  ].some(hasValue);
}

function evaluateAdvertisingReadiness(
  car,
  { documents = [], documentsLoading = false } = {}
) {
  const technicalParams = car?.technicalParams || {};
  const advertisingData = car?.advertisingData || {};
  const damageReport = car?.damageReport || {};
  const photoCount = Array.isArray(car?.photos) ? car.photos.length : 0;
  const equipmentCount = countSelectedEquipment(car?.equipment);
  const damageFieldCount = countFilledDamageFields(damageReport);
  const standardDocumentCount = Array.isArray(documents)
    ? documents.length
    : 0;
  const legacyCebiaCount = Array.isArray(car?.cebiaFiles)
    ? car.cebiaFiles.length
    : 0;
  const documentCount = standardDocumentCount + legacyCebiaCount;
  const technicalCoverage = getTechnicalCoverage(car || {}, technicalParams);
  const sellingPrice = getSellingPrice(car);
  const hasIdentification =
    (hasValue(car?.name) && String(car.name).trim().length >= 3) ||
    hasValue(technicalParams.brand) ||
    hasValue(technicalParams.model);
  const onlineListingText = getOnlineListingText(advertisingData);
  const onlineListingPreparation =
    hasOnlineListingPreparation(advertisingData);

  const items = [
    {
      key: "identification",
      label: "Identifikace vozu",
      status: hasIdentification
        ? readinessStatus.DONE
        : readinessStatus.MISSING,
      detail: hasIdentification
        ? "Název, značka nebo model jsou vyplněné."
        : "Chybí použitelný název, značka nebo model.",
    },
    {
      key: "sellingPrice",
      label: "Prodejní cena",
      status: hasPositiveNumber(sellingPrice)
        ? readinessStatus.DONE
        : readinessStatus.MISSING,
      detail: hasPositiveNumber(sellingPrice)
        ? "Je dostupná kladná plánovaná prodejní cena."
        : "Chybí platná kladná prodejní cena.",
    },
    {
      key: "technicalData",
      label: "Technické údaje",
      status:
        technicalCoverage >= 3
          ? readinessStatus.DONE
          : readinessStatus.MISSING,
      detail: `${technicalCoverage} z 5 základních skupin údajů je vyplněno.`,
    },
    {
      key: "photos",
      label: "Fotografie",
      status: photoCount > 0 ? readinessStatus.DONE : readinessStatus.MISSING,
      detail:
        photoCount > 0
          ? `Počet uložených fotografií: ${photoCount}.`
          : "Není uložená žádná fotografie.",
    },
    {
      key: "equipment",
      label: "Výbava",
      status:
        equipmentCount > 0 ? readinessStatus.DONE : readinessStatus.MISSING,
      detail:
        equipmentCount > 0
          ? `Počet evidovaných položek výbavy: ${equipmentCount}.`
          : "Není evidovaná žádná položka výbavy.",
    },
    {
      key: "condition",
      label: "Poškození a stav",
      status:
        damageFieldCount > 0 ? readinessStatus.DONE : readinessStatus.REVIEW,
      detail:
        damageFieldCount > 0
          ? `Počet vyplněných oblastí kontroly stavu: ${damageFieldCount}.`
          : "Nelze rozlišit nevyplněný modul od vozu bez známých vad.",
    },
    {
      key: "documents",
      label: "Dokumentace",
      status: documentsLoading
        ? readinessStatus.REVIEW
        : documentCount > 0
          ? readinessStatus.DONE
          : readinessStatus.MISSING,
      detail: documentsLoading
        ? "Dokumenty se právě načítají."
        : documentCount > 0
          ? `Počet dostupných dokumentů: ${documentCount}.`
          : "Není dostupný žádný dokument vozidla.",
    },
    {
      key: "customerText",
      label: "Text pro zákazníka",
      status: hasValue(advertisingData.customerEmailText)
        ? readinessStatus.DONE
        : readinessStatus.MISSING,
      detail: hasValue(advertisingData.customerEmailText)
        ? "Text pro zákazníka je uložený."
        : "Text pro zákazníka zatím není uložený.",
    },
    {
      key: "onlineListingText",
      label: "Text online inzerce",
      status: hasValue(onlineListingText)
        ? readinessStatus.DONE
        : onlineListingPreparation
          ? readinessStatus.REVIEW
          : readinessStatus.MISSING,
      detail: hasValue(onlineListingText)
        ? "Hotový text online inzerce je uložený."
        : onlineListingPreparation
          ? "Existují podklady, ale hotový online text nelze spolehlivě určit."
          : "Chybí podklady i hotový text online inzerce.",
    },
  ];
  const completedCount = items.filter(
    (item) => item.status === readinessStatus.DONE
  ).length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    percent: Math.round((completedCount / items.length) * 100),
  };
}

export default function AdvertisingReadiness({
  selectedCar,
  documents,
  documentsLoading,
}) {
  const readiness = evaluateAdvertisingReadiness(selectedCar, {
    documents,
    documentsLoading,
  });

  return (
    <div className="card decision advertisingReadiness">
      <div className="advertisingReadinessHeader">
        <div>
          <h2>Připravenost k inzerci</h2>
          <p className="advertisingReadinessCount">
            {readiness.completedCount} z {readiness.totalCount} položek
            připraveno
          </p>
        </div>
        <strong className="advertisingReadinessPercent">
          {readiness.percent} %
        </strong>
      </div>

      <div
        className="advertisingReadinessProgress"
        role="progressbar"
        aria-label="Připravenost k inzerci"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={readiness.percent}
      >
        <div style={{ width: `${readiness.percent}%` }} />
      </div>

      <div className="readinessGrid">
        {readiness.items.map((item, index) => (
          <div
            key={item.key}
            className={`readinessItem ${item.status}`}
          >
            <div className="readinessNumber">{index + 1}</div>
            <h4>{item.label}</h4>
            <p className="readinessStatus">
              {readinessStatusLabels[item.status]}
            </p>
            <p className="readinessDetail">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

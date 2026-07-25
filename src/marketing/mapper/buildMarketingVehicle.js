import { formatVehicleCurrency } from "../../utils/vehicleEconomy.js";
import { buildVehicleProfile } from "../../utils/buildVehicleProfile.js";

const fallbackText = "Neuvedeno";

const priorityEquipment = [
  "Automatická klimatizace",
  "Navigace",
  "Apple CarPlay",
  "Android Auto",
  "Couvací kamera",
  "Parkovací senzory přední",
  "Parkovací senzory zadní",
  "Adaptivní tempomat",
  "LED světlomety",
  "Matrix LED",
  "Vyhřívaná sedadla",
  "Vyhřívaný volant",
  "Kožené sedačky",
  "Tažné zařízení",
  "Bluetooth",
  "Digitální kokpit",
];

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getValue(...values) {
  const value = values.find(hasValue);
  return hasValue(value) ? String(value).trim() : fallbackText;
}

function getOptionalValue(...values) {
  const value = values.find(hasValue);
  return hasValue(value) ? String(value).trim() : "";
}

function getMarketingSalePrice(pricing = {}) {
  const firstFilledPrice = [
    pricing.expectedSalePrice,
    pricing.saleEstimate,
  ].find(
    (value) => value !== "" && value !== null && value !== undefined
  );
  const numberValue = Number(firstFilledPrice);

  return !Number.isNaN(numberValue) && numberValue > 0
    ? formatVehicleCurrency(numberValue)
    : fallbackText;
}

function getLines(value, limit) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function formatMileage(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallbackText;
  return `${numberValue.toLocaleString("cs-CZ")} km`;
}

function maskVin(vin) {
  if (!hasValue(vin)) return fallbackText;
  const normalizedVin = String(vin).trim();
  if (normalizedVin.length <= 8) return normalizedVin;
  return `${normalizedVin.slice(0, 6)}....${normalizedVin.slice(-4)}`;
}

function getSelectedEquipment(equipment = {}, limit = 10) {
  const selected = Object.entries(equipment)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([label]) => label);

  const prioritySelected = priorityEquipment.filter((item) =>
    selected.includes(item)
  );
  const remainingSelected = selected
    .filter((item) => !prioritySelected.includes(item))
    .sort((a, b) => a.localeCompare(b, "cs"));

  return [...prioritySelected, ...remainingSelected].slice(0, limit);
}

function hasKnownDamage(car) {
  const damageReport = car.damageReport || {};
  const cebiaHistory = car.cebiaHistory || {};

  return [
    damageReport.overallCondition,
    damageReport.exterior,
    damageReport.interior,
    damageReport.technical,
    damageReport.tiresBrakes,
    damageReport.otherDamage,
    damageReport.note,
    cebiaHistory.damageHistory,
  ].some(hasValue);
}

function getTruthfulGuarantees(car) {
  const highlightsText = String(car.advertisingData?.highlights || "").toLowerCase();
  const knownDamage = hasKnownDamage(car);
  const guarantees = [];

  if (
    car.checklist?.["Servisní historie"] ||
    highlightsText.includes("servis")
  ) {
    guarantees.push("Pravidelný servis");
  }

  if (
    !knownDamage &&
    (highlightsText.includes("nehavarováno") ||
      highlightsText.includes("bez nehod"))
  ) {
    guarantees.push("Bez nehod");
  } else if (knownDamage) {
    guarantees.push("Známé vady uvedeny transparentně");
  } else {
    guarantees.push("Ověřená historie vozu");
  }

  if (
    car.checklist?.["Kontrola CEBIA / CarVertical"] ||
    hasValue(car.aiCebiaReport)
  ) {
    guarantees.push("CEBIA / ověřená historie");
  }

  if (
    car.checklist?.["Mechanická prohlídka + diagnostika"] ||
    hasValue(car.damageReport?.overallCondition)
  ) {
    guarantees.push("Stav vozu prověřen");
  }

  return [...new Set(guarantees)].slice(0, 4);
}

function getHighlights(car) {
  const explicitHighlights = getLines(car.advertisingData?.highlights, 5);
  if (explicitHighlights.length > 0) return explicitHighlights;

  const technicalParams = car.technicalParams || {};
  const highlights = [];

  if (Number(car.km) > 0 && Number(car.km) <= 120000) {
    highlights.push("Nízký nájezd");
  }

  if (
    String(car.cebiaHistory?.countryOfOrigin || "")
      .toLowerCase()
      .includes("čr")
  ) {
    highlights.push("České auto");
  }

  if (car.checklist?.["Servisní historie"]) {
    highlights.push("Pravidelný servis");
  }

  if (
    String(technicalParams.fuel || "").toLowerCase().includes("diesel") ||
    String(technicalParams.engine || "").toLowerCase().includes("tsi") ||
    String(technicalParams.engine || "").toLowerCase().includes("tdi")
  ) {
    highlights.push("Úsporný motor");
  }

  if (getSelectedEquipment(car.equipment, 4).length >= 4) {
    highlights.push("Bohatá výbava");
  }

  return highlights.slice(0, 5);
}

function getServiceHistory(car) {
  if (car.checklist?.["Servisní historie"]) return "Doložená";
  if (car.advertisingData?.highlights?.toLowerCase().includes("servis")) {
    return "Uvedena";
  }
  return fallbackText;
}

function getFirstOwner(car) {
  const highlights = String(car.advertisingData?.highlights || "").toLowerCase();
  return highlights.includes("první majitel") ? "Ano" : fallbackText;
}

function buildReadiness(vehicle) {
  const checks = [
    { key: "heroImage", label: "Hlavní fotografie", done: hasValue(vehicle.heroImage) },
    { key: "price", label: "Cena", done: vehicle.price !== fallbackText },
    { key: "mileage", label: "Nájezd", done: vehicle.specs.mileage !== fallbackText },
    { key: "year", label: "Rok výroby", done: vehicle.specs.year !== fallbackText },
    {
      key: "drivetrain",
      label: "Motor / palivo / převodovka",
      done:
        vehicle.specs.fuel !== fallbackText &&
        vehicle.specs.transmission !== fallbackText &&
        vehicle.technical.engine !== fallbackText,
    },
    { key: "equipment", label: "Výbava", done: vehicle.equipment.length > 0 },
    { key: "guarantees", label: "Hlavní argumenty", done: vehicle.guarantees.length > 0 },
    { key: "condition", label: "Stav / poškození", done: vehicle.condition !== fallbackText },
    {
      key: "serviceHistory",
      label: "Servisní historie",
      done: vehicle.specs.serviceHistory !== fallbackText,
    },
    { key: "origin", label: "Původ vozu", done: vehicle.specs.origin !== fallbackText },
  ];
  const completed = checks.filter((check) => check.done).length;

  return {
    percent: Math.round((completed / checks.length) * 100),
    missing: checks.filter((check) => !check.done).map((check) => check.label),
    checks,
  };
}

export function buildMarketingVehicle(selectedCar) {
  const car = selectedCar || {};
  const vehicleProfile = buildVehicleProfile(selectedCar);
  const technicalParams = car.technicalParams || {};
  const advertisingData = car.advertisingData || {};
  const damageReport = car.damageReport || {};
  const cebiaHistory = car.cebiaHistory || {};
  const hasMarketingTechnicalParams = Boolean(car.technicalParams);
  const profileTechnical = hasMarketingTechnicalParams
    ? vehicleProfile.technical
    : null;
  const profileYear =
    hasMarketingTechnicalParams || hasValue(car.year)
      ? vehicleProfile.technical.year
      : "";
  const expectedSalePrice = getMarketingSalePrice(vehicleProfile.pricing);

  const vehicle = {
    title: getValue(vehicleProfile.identity.name),
    subtitle: getValue(
      profileTechnical?.version,
      hasMarketingTechnicalParams ? vehicleProfile.identity.version : "",
      profileTechnical?.engine
    ),
    price: expectedSalePrice,
    heroImage: vehicleProfile.media.heroPhoto,
    vin: maskVin(vehicleProfile.identity.vin),
    specs: {
      year: getValue(profileYear),
      mileage: formatMileage(vehicleProfile.technical.mileage),
      fuel: getValue(profileTechnical?.fuel),
      transmission: getValue(profileTechnical?.transmission),
      power: hasValue(profileTechnical?.powerKw)
        ? `${profileTechnical.powerKw} kW`
        : fallbackText,
      origin: getValue(cebiaHistory.countryOfOrigin, technicalParams.origin),
      firstOwner: getFirstOwner(car),
      serviceHistory: getServiceHistory(car),
      warranty: getValue(
        technicalParams.warranty,
        cebiaHistory.warranty,
        advertisingData.warranty
      ),
    },
    technical: {
      engine: getValue(profileTechnical?.engine),
      power: hasValue(profileTechnical?.powerKw)
        ? `${profileTechnical.powerKw} kW`
        : fallbackText,
      drive: getValue(profileTechnical?.drive),
      consumption: getValue(profileTechnical?.consumption),
      emissions: getValue(profileTechnical?.emissions),
      color: getValue(profileTechnical?.color),
      bodyType: getValue(profileTechnical?.bodyType),
      stk: getValue(
        hasMarketingTechnicalParams ? vehicleProfile.history.stk : ""
      ),
    },
    equipment: getSelectedEquipment(car.equipment),
    highlights: getHighlights(car),
    guarantees: getTruthfulGuarantees(car),
    condition: getValue(
      damageReport.overallCondition,
      advertisingData.defects,
      advertisingData.listingNote
    ),
    contact: {
      brand: "Opportunity",
      claim: "Prověřené vozy s transparentní historií",
      phone: getOptionalValue(car.companyPhone, car.contactPhone),
      email: getOptionalValue(car.companyEmail, car.contactEmail),
      website: "opportunity-auto.cz",
    },
    readiness: null,
  };

  vehicle.readiness = buildReadiness(vehicle);
  return vehicle;
}

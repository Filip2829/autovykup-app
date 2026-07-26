function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(hasValue) : [];
}

function toNumber(value) {
  if (!hasValue(value)) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedEquals(left, right) {
  const normalizedLeft = normalizeText(left);
  return normalizedLeft !== "" && normalizedLeft === normalizeText(right);
}

function matchesAny(value, allowedValues) {
  return asArray(allowedValues).some((allowed) =>
    normalizedEquals(value, allowed)
  );
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ") : [];
}

export function safelyMatchesModel(vehicleModel, requestedModel) {
  const vehicleTokens = new Set(tokenize(vehicleModel));
  const requestedTokens = tokenize(requestedModel);

  return (
    requestedTokens.length > 0
    && requestedTokens.every((token) => vehicleTokens.has(token))
  );
}

function matchesRequestedModel(vehicleModel, requestedModels) {
  return asArray(requestedModels).some((model) =>
    safelyMatchesModel(vehicleModel, model)
  );
}

function criterion(key, label, message) {
  return { key, label, message };
}

function formatNumber(value) {
  return new Intl.NumberFormat("cs-CZ").format(value);
}

function clampRatio(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function getVehicleMatchLevel(score) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "possible";
  return "poor";
}

export function matchVehicleToDemand(vehicleProfile = {}, demand = {}) {
  const identity = vehicleProfile.identity || {};
  const technical = vehicleProfile.technical || {};
  const pricing = vehicleProfile.pricing || {};
  const equipment = asArray(vehicleProfile.equipment?.activeItems);
  const matchedCriteria = [];
  const warnings = [];
  const failedCriteria = [];
  let availableWeight = 0;
  let earnedWeight = 0;

  const addWeightedResult = ({
    active,
    key,
    label,
    weight,
    ratio,
    matchMessage,
    warningMessage,
  }) => {
    if (!active) return;

    const normalizedRatio = clampRatio(ratio);
    availableWeight += weight;
    earnedWeight += weight * normalizedRatio;

    if (normalizedRatio > 0) {
      matchedCriteria.push(criterion(key, label, matchMessage));
    }

    if (normalizedRatio < 1) {
      warnings.push(criterion(key, label, warningMessage));
    }
  };

  const requestedMakes = asArray(demand.makes);
  if (requestedMakes.length > 0) {
    if (matchesAny(identity.brand, requestedMakes)) {
      matchedCriteria.push(
        criterion(
          "make",
          "Značka",
          `Značka ${identity.brand} odpovídá poptávce.`
        )
      );
    } else {
      failedCriteria.push(
        criterion(
          "make",
          "Značka",
          hasValue(identity.brand)
            ? `Značka ${identity.brand} není mezi požadovanými značkami.`
            : "U vozidla chybí značka potřebná pro ověření poptávky."
        )
      );
    }
  }

  const requestedModels = asArray(demand.models);
  if (requestedModels.length > 0) {
    if (matchesRequestedModel(identity.model, requestedModels)) {
      matchedCriteria.push(
        criterion(
          "model",
          "Model",
          `Model ${identity.model} odpovídá poptávce.`
        )
      );
    } else {
      failedCriteria.push(
        criterion(
          "model",
          "Model",
          hasValue(identity.model)
            ? `Model ${identity.model} neodpovídá požadovaným modelům.`
            : "U vozidla chybí model potřebný pro ověření poptávky."
        )
      );
    }
  }

  const normalizedEquipment = new Set(equipment.map(normalizeText));
  const requiredEquipment = asArray(demand.requiredEquipment);
  if (requiredEquipment.length > 0) {
    const missingEquipment = requiredEquipment.filter(
      (item) => !normalizedEquipment.has(normalizeText(item))
    );

    if (missingEquipment.length === 0) {
      matchedCriteria.push(
        criterion(
          "requiredEquipment",
          "Povinná výbava",
          "Vozidlo obsahuje všechnu povinnou výbavu."
        )
      );
    } else {
      failedCriteria.push(
        criterion(
          "requiredEquipment",
          "Povinná výbava",
          `Chybí povinná výbava: ${missingEquipment.join(", ")}.`
        )
      );
    }
  }

  const excludedColors = asArray(demand.excludedColors);
  if (excludedColors.length > 0) {
    if (hasValue(technical.color) && matchesAny(technical.color, excludedColors)) {
      failedCriteria.push(
        criterion(
          "excludedColor",
          "Vyloučená barva",
          `Barva ${technical.color} je zákazníkem vyloučená.`
        )
      );
    } else if (hasValue(technical.color)) {
      matchedCriteria.push(
        criterion(
          "excludedColor",
          "Vyloučená barva",
          `Barva ${technical.color} není mezi vyloučenými barvami.`
        )
      );
    } else {
      warnings.push(
        criterion(
          "excludedColor",
          "Vyloučená barva",
          "U vozidla chybí barva, vyloučené barvy nelze ověřit."
        )
      );
    }
  }

  const requestedBodyTypes = asArray(demand.bodyTypes);
  const bodyTypeMatches = matchesAny(
    technical.bodyType,
    requestedBodyTypes
  );

  addWeightedResult({
    active: requestedBodyTypes.length > 0,
    key: "bodyType",
    label: "Karoserie",
    weight: 10,
    ratio: bodyTypeMatches ? 1 : 0,
    matchMessage: `Karoserie ${technical.bodyType} odpovídá poptávce.`,
    warningMessage: hasValue(technical.bodyType)
      ? `Karoserie ${technical.bodyType} neodpovídá poptávce.`
      : "U vozidla chybí typ karoserie.",
  });

  const minimumPrice = toNumber(demand.minPrice);
  const maximumPrice = toNumber(demand.maxPrice);
  const vehiclePrice = toNumber(pricing.effectiveSalePrice);
  const hasPriceCriterion = minimumPrice !== null || maximumPrice !== null;
  const priceMatches =
    vehiclePrice !== null
    && (minimumPrice === null || vehiclePrice >= minimumPrice)
    && (maximumPrice === null || vehiclePrice <= maximumPrice);

  addWeightedResult({
    active: hasPriceCriterion,
    key: "price",
    label: "Cena",
    weight: 20,
    ratio: priceMatches ? 1 : 0,
    matchMessage: `Cena ${formatNumber(vehiclePrice)} Kč je v požadovaném rozpětí.`,
    warningMessage:
      vehiclePrice === null
        ? "U vozidla chybí prodejní cena."
        : `Cena ${formatNumber(vehiclePrice)} Kč je mimo požadované rozpětí.`,
  });

  const minimumYear = toNumber(demand.minYear);
  const maximumYear = toNumber(demand.maxYear);
  const vehicleYear = toNumber(technical.year);
  const hasYearCriterion = minimumYear !== null || maximumYear !== null;
  const yearMatches =
    vehicleYear !== null
    && (minimumYear === null || vehicleYear >= minimumYear)
    && (maximumYear === null || vehicleYear <= maximumYear);

  addWeightedResult({
    active: hasYearCriterion,
    key: "year",
    label: "Rok výroby",
    weight: 10,
    ratio: yearMatches ? 1 : 0,
    matchMessage: `Rok ${vehicleYear} odpovídá požadovanému rozpětí.`,
    warningMessage:
      vehicleYear === null
        ? "U vozidla chybí rok výroby."
        : `Rok ${vehicleYear} je mimo požadované rozpětí.`,
  });

  const maximumMileage = toNumber(demand.maxMileage);
  const vehicleMileage = toNumber(technical.mileage);
  const mileageMatches =
    vehicleMileage !== null
    && maximumMileage !== null
    && vehicleMileage <= maximumMileage;
  const mileageDifference =
    vehicleMileage !== null && maximumMileage !== null
      ? vehicleMileage - maximumMileage
      : null;

  addWeightedResult({
    active: maximumMileage !== null,
    key: "mileage",
    label: "Nájezd",
    weight: 15,
    ratio: mileageMatches ? 1 : 0,
    matchMessage: `Nájezd ${formatNumber(vehicleMileage)} km je v limitu.`,
    warningMessage:
      vehicleMileage === null
        ? "U vozidla chybí nájezd."
        : `Nájezd překračuje limit o ${formatNumber(
            Math.max(0, mileageDifference)
          )} km.`,
  });

  for (const [key, label, weight, vehicleValue, requestedValues] of [
    ["fuel", "Palivo", 10, technical.fuel, demand.fuelTypes],
    [
      "transmission",
      "Převodovka",
      10,
      technical.transmission,
      demand.transmissions,
    ],
    ["drivetrain", "Pohon", 10, technical.drive, demand.drivetrains],
  ]) {
    const allowedValues = asArray(requestedValues);
    const valueMatches = matchesAny(vehicleValue, allowedValues);

    addWeightedResult({
      active: allowedValues.length > 0,
      key,
      label,
      weight,
      ratio: valueMatches ? 1 : 0,
      matchMessage: `${label} ${vehicleValue} odpovídá poptávce.`,
      warningMessage: hasValue(vehicleValue)
        ? `${label} ${vehicleValue} neodpovídá poptávce.`
        : `U vozidla chybí údaj: ${label.toLocaleLowerCase("cs-CZ")}.`,
    });
  }

  const minimumPower = toNumber(demand.minPowerKw);
  const maximumPower = toNumber(demand.maxPowerKw);
  const vehiclePower = toNumber(technical.powerKw);
  const hasPowerCriterion = minimumPower !== null || maximumPower !== null;
  const powerMatches =
    vehiclePower !== null
    && (minimumPower === null || vehiclePower >= minimumPower)
    && (maximumPower === null || vehiclePower <= maximumPower);

  addWeightedResult({
    active: hasPowerCriterion,
    key: "power",
    label: "Výkon",
    weight: 10,
    ratio: powerMatches ? 1 : 0,
    matchMessage: `Výkon ${formatNumber(vehiclePower)} kW odpovídá poptávce.`,
    warningMessage:
      vehiclePower === null
        ? "U vozidla chybí výkon."
        : `Výkon ${formatNumber(vehiclePower)} kW je mimo požadované rozpětí.`,
  });

  const preferredEquipment = asArray(demand.preferredEquipment);
  const matchedPreferredEquipment = preferredEquipment.filter((item) =>
    normalizedEquipment.has(normalizeText(item))
  );
  const preferredEquipmentRatio =
    preferredEquipment.length > 0
      ? matchedPreferredEquipment.length / preferredEquipment.length
      : 0;

  addWeightedResult({
    active: preferredEquipment.length > 0,
    key: "preferredEquipment",
    label: "Preferovaná výbava",
    weight: 10,
    ratio: preferredEquipmentRatio,
    matchMessage: `Nalezeno ${matchedPreferredEquipment.length} z ${preferredEquipment.length} preferovaných prvků výbavy.`,
    warningMessage: `Chybí ${
      preferredEquipment.length - matchedPreferredEquipment.length
    } z ${preferredEquipment.length} preferovaných prvků výbavy.`,
  });

  const preferredColors = asArray(demand.preferredColors);
  const preferredColorMatches = matchesAny(technical.color, preferredColors);

  addWeightedResult({
    active: preferredColors.length > 0,
    key: "preferredColor",
    label: "Preferovaná barva",
    weight: 5,
    ratio: preferredColorMatches ? 1 : 0,
    matchMessage: `Barva ${technical.color} odpovídá preferenci.`,
    warningMessage: hasValue(technical.color)
      ? `Barva ${technical.color} není mezi preferovanými barvami.`
      : "U vozidla chybí barva.",
  });

  const isEligible = failedCriteria.length === 0;
  const hasWeightedCriteria = availableWeight > 0;

  if (isEligible && !hasWeightedCriteria) {
    warnings.push(
      criterion(
        "lowSpecificity",
        "Obecná poptávka",
        "Poptávka obsahuje málo konkrétních požadavků."
      )
    );
  }

  const weightedScore =
    !hasWeightedCriteria
      ? 50
      : Math.round((earnedWeight / availableWeight) * 100);
  const score = isEligible
    ? Math.min(100, Math.max(0, weightedScore))
    : 0;

  return {
    score,
    level: getVehicleMatchLevel(score),
    isEligible,
    matchedCriteria,
    warnings,
    failedCriteria,
  };
}

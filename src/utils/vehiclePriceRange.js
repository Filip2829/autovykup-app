export const vehiclePriceRangeFields = [
  {
    key: "buyEstimate",
    maxKey: "buyEstimateMax",
    dbKey: "buy_estimate",
    dbMaxKey: "buy_estimate_max",
    label: "Návrh výkupní ceny",
  },
  {
    key: "customerExpectedPrice",
    maxKey: "customerExpectedPriceMax",
    dbKey: "customer_expected_price",
    dbMaxKey: "customer_expected_price_max",
    label: "Představa zákazníka",
  },
  {
    key: "saleEstimate",
    maxKey: "saleEstimateMax",
    dbKey: "sale_estimate",
    dbMaxKey: "sale_estimate_max",
    label: "Návrh prodejní ceny",
  },
  {
    key: "approvedPrice",
    maxKey: "approvedPriceMax",
    dbKey: "approved_price",
    dbMaxKey: "approved_price_max",
    label: "Potvrzená výkupní cena",
  },
];

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function toNullablePrice(value) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function readPriceRange(car, field) {
  const source = car || {};
  return {
    min: source[field.key] ?? source[field.dbKey] ?? null,
    max: source[field.maxKey] ?? source[field.dbMaxKey] ?? null,
  };
}

export function formatVehiclePriceRange(
  minValue,
  maxValue,
  emptyText = "Neověřeno"
) {
  const min = toNullablePrice(minValue);
  const max = toNullablePrice(maxValue);
  if (min === null) return emptyText;

  const format = (value) => Math.round(value).toLocaleString("cs-CZ");
  if (max === null || max === min) return `${format(min)} Kč`;
  return `${format(min)}–${format(max)} Kč`;
}

export function validateVehiclePriceRanges(values) {
  for (const field of vehiclePriceRangeFields) {
    const min = toNullablePrice(values?.[field.key]);
    const max = toNullablePrice(values?.[field.maxKey]);

    if (max !== null && min === null) {
      return `${field.label}: před horní hranicí vyplňte částku „Od“.`;
    }
    if (min !== null && min < 0) {
      return `${field.label}: částka nesmí být záporná.`;
    }
    if (max !== null && max < min) {
      return `${field.label}: částka „Do“ musí být vyšší nebo stejná jako „Od“.`;
    }
  }
  return "";
}

export function buildVehiclePriceRangePayload(values) {
  return Object.fromEntries(
    vehiclePriceRangeFields.flatMap((field) => [
      [field.dbKey, toNullablePrice(values?.[field.key])],
      [field.dbMaxKey, toNullablePrice(values?.[field.maxKey])],
    ])
  );
}

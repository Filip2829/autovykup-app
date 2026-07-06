export const postPurchaseCostFields = [
  { key: "service", label: "Servis" },
  { key: "bodyPaint", label: "Karoserie / lak" },
  { key: "tires", label: "Pneumatiky" },
  { key: "cleaning", label: "Čištění" },
  { key: "stkEmission", label: "STK / emise" },
  { key: "transfer", label: "Přepis" },
  { key: "other", label: "Ostatní" },
];

export function toVehicleNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

export function formatVehicleCurrency(value) {
  return `${Math.round(value).toLocaleString("cs-CZ")} Kč`;
}

export function getPostPurchaseCosts(car) {
  const costs = car.postPurchaseCosts || {};

  return {
    service: costs.service ?? "",
    bodyPaint: costs.bodyPaint ?? "",
    tires: costs.tires ?? "",
    cleaning: costs.cleaning ?? "",
    stkEmission: costs.stkEmission ?? "",
    transfer: costs.transfer ?? costs.registration ?? "",
    registration: costs.registration ?? "",
    other: costs.other ?? "",
    note: costs.note || "",
  };
}

function getFirstFilledNumber(values) {
  const filledValue = values.find(
    (value) => value !== "" && value !== null && value !== undefined
  );

  return toVehicleNumber(filledValue);
}

export function getVehicleEconomy(car) {
  const costs = getPostPurchaseCosts(car);
  const totalCosts = postPurchaseCostFields.reduce(
    (sum, field) => sum + toVehicleNumber(costs[field.key]),
    0
  );
  const purchasePrice = getFirstFilledNumber([
    car.purchasePrice,
    car.purchase_price,
    car.approvedPrice,
    car.approved_price,
    car.buyEstimate,
    car.buy_estimate,
  ]);
  const acquisitionPrice = purchasePrice + totalCosts;
  const expectedSalePrice = getFirstFilledNumber([
    car.expectedSalePrice,
    car.expected_sale_price,
    car.saleEstimate,
    car.sale_estimate,
  ]);
  const expectedMargin = expectedSalePrice - acquisitionPrice;

  return {
    costs,
    totalCosts,
    purchasePrice,
    acquisitionPrice,
    expectedSalePrice,
    expectedMargin,
  };
}

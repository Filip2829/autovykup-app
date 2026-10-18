export const AUCTION_DATA_STATUS = {
  VERIFIED: "verified",
  DEMO: "demo",
};

export const AUCTION_DECISION = {
  UNDECIDED: "undecided",
  SUITABLE: "suitable",
  REJECTED: "rejected",
  WATCHLIST: "watchlist",
};

export const auctionRadarCriteria = {
  brands: ["Renault", "Dacia"],
  country: "CZ",
  maxPriceCzk: 500000,
};

export const emptyAuctionVehicleForm = {
  brand: "Renault",
  model: "",
  trim: "",
  year: "",
  mileageKm: "",
  fuel: "Benzín",
  transmission: "Manuální",
  locationCity: "",
  priceCzk: "",
  sourceName: "",
  originalAuctionUrl: "",
  summary: "",
  positives: "",
  negatives: "",
  verificationConfirmed: false,
};

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateAuctionVehicleForm(form) {
  const errors = {};
  const year = Number(form.year);
  const mileageKm = Number(form.mileageKm);
  const priceCzk = Number(form.priceCzk);
  const currentYear = new Date().getFullYear();

  if (!auctionRadarCriteria.brands.includes(form.brand)) errors.brand = "Povolený je pouze Renault nebo Dacia.";
  if (!form.model.trim()) errors.model = "Doplňte model vozu.";
  if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) errors.year = "Zadejte platný rok výroby.";
  if (String(form.mileageKm).trim() === "" || !Number.isFinite(mileageKm) || mileageKm < 0) errors.mileageKm = "Zadejte platný nájezd.";
  if (String(form.priceCzk).trim() === "" || !Number.isFinite(priceCzk) || priceCzk <= 0) errors.priceCzk = "Zadejte platnou cenu.";
  else if (priceCzk > auctionRadarCriteria.maxPriceCzk) errors.priceCzk = "Cena překračuje limit 500 000 Kč.";
  if (!form.locationCity.trim()) errors.locationCity = "Doplňte město, kde je vůz fyzicky v ČR.";
  if (!form.sourceName.trim()) errors.sourceName = "Doplňte název zdroje.";

  try {
    const url = new URL(form.originalAuctionUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid protocol");
  } catch {
    errors.originalAuctionUrl = "Doplňte platný odkaz na původní aukci.";
  }

  if (!form.summary.trim()) errors.summary = "Doplňte stručné ověřené shrnutí.";
  if (!form.verificationConfirmed) errors.verificationConfirmed = "Potvrďte ruční kontrolu údajů proti zdroji.";
  return errors;
}

export function buildVerifiedAuctionVehicle(form, id = crypto.randomUUID()) {
  const errors = validateAuctionVehicleForm(form);
  if (Object.keys(errors).length) return { vehicle: null, errors };

  const now = new Date().toISOString();
  return {
    errors: {},
    vehicle: {
      id,
      dataStatus: AUCTION_DATA_STATUS.VERIFIED,
      sourceName: form.sourceName.trim(),
      sourceUrl: new URL(form.originalAuctionUrl).origin,
      originalAuctionUrl: form.originalAuctionUrl.trim(),
      brand: form.brand,
      model: form.model.trim(),
      trim: form.trim.trim(),
      year: Number(form.year),
      mileageKm: Number(form.mileageKm),
      fuel: form.fuel,
      transmission: form.transmission,
      location: `${form.locationCity.trim()}, ČR`,
      priceCzk: Number(form.priceCzk),
      auctionEndsAt: null,
      vin: null,
      firstRegistration: null,
      summary: form.summary.trim(),
      positives: splitLines(form.positives),
      negatives: splitLines(form.negatives),
      verifiedFields: [
        "sourceName", "originalAuctionUrl", "brand", "model", "year",
        "mileageKm", "fuel", "transmission", "location", "priceCzk", "summary",
      ],
      lastVerifiedAt: now,
      createdAt: now,
      createdManually: true,
    },
  };
}

export const demoAuctionVehicles = [
  {
    id: "demo-renault-captur",
    dataStatus: AUCTION_DATA_STATUS.DEMO,
    sourceName: "Ukázkový aukční portál",
    sourceUrl: null,
    originalAuctionUrl: null,
    brand: "Renault",
    model: "Captur",
    trim: "TCe 90",
    year: 2021,
    mileageKm: 68500,
    fuel: "Benzín",
    transmission: "Manuální",
    location: "Praha, ČR",
    priceCzk: 319000,
    auctionEndsAt: null,
    vin: null,
    firstRegistration: null,
    summary: "Demonstrační karta ukazuje rozsah informací, které radar zobrazí po připojení ověřeného zdroje.",
    positives: ["Žádaný městský crossover", "Cena pod nastaveným limitem"],
    negatives: ["Historie ani VIN nejsou v ukázce ověřené", "Chybí reálný aukční protokol"],
    verifiedFields: [],
    lastVerifiedAt: null,
  },
  {
    id: "demo-dacia-duster",
    dataStatus: AUCTION_DATA_STATUS.DEMO,
    sourceName: "Ukázkový leasingový portál",
    sourceUrl: null,
    originalAuctionUrl: null,
    brand: "Dacia",
    model: "Duster",
    trim: "TCe 100 LPG",
    year: 2020,
    mileageKm: 82400,
    fuel: "Benzín / LPG",
    transmission: "Manuální",
    location: "Brno, ČR",
    priceCzk: 284000,
    auctionEndsAt: null,
    vin: null,
    firstRegistration: null,
    summary: "Ukázka kandidáta z ukončeného leasingu; nejde o skutečnou nabídku ani doporučení ke koupi.",
    positives: ["Praktický model s dobrou prodejností", "Úsporný provoz LPG"],
    negatives: ["Bez ověřené servisní historie", "Nutná kontrola LPG soustavy"],
    verifiedFields: [],
    lastVerifiedAt: null,
  },
  {
    id: "demo-renault-megane",
    dataStatus: AUCTION_DATA_STATUS.DEMO,
    sourceName: "Ukázkový úvěrový portál",
    sourceUrl: null,
    originalAuctionUrl: null,
    brand: "Renault",
    model: "Mégane Grandtour",
    trim: "Blue dCi 115",
    year: 2019,
    mileageKm: 127000,
    fuel: "Nafta",
    transmission: "Manuální",
    location: "Ostrava, ČR",
    priceCzk: 238000,
    auctionEndsAt: null,
    vin: null,
    firstRegistration: null,
    summary: "Demonstrační záznam ilustruje porovnání různých zdrojů a ruční uzavření rozhodnutí.",
    positives: ["Praktická karoserie kombi", "Rezerva vůči cenovému limitu"],
    negatives: ["Vyšší ukázkový nájezd", "Bez ověřené historie a diagnostiky"],
    verifiedFields: [],
    lastVerifiedAt: null,
  },
];

export function filterAuctionVehicles(vehicles, filters) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("cs");

  return vehicles.filter((vehicle) => {
    const matchesBrand = filters.brand === "all" || vehicle.brand === filters.brand;
    const matchesPrice = vehicle.priceCzk <= filters.maxPriceCzk;
    const matchesDecision = filters.decision === "all" ||
      (filters.decisions[vehicle.id] || AUCTION_DECISION.UNDECIDED) === filters.decision;
    const matchesQuery = !normalizedQuery ||
      [vehicle.brand, vehicle.model, vehicle.trim, vehicle.location, vehicle.sourceName]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("cs")
        .includes(normalizedQuery);

    return matchesBrand && matchesPrice && matchesDecision && matchesQuery;
  });
}

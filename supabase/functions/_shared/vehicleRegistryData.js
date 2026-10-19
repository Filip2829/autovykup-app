function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function firstValue(...values) {
  return values.map(text).find(Boolean) || "";
}

function isoDate(value) {
  const normalized = text(value);
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || "";
}

function joinedUnique(values, separator = " / ") {
  return [...new Set(values.map(text).filter(Boolean))].join(separator);
}

function powerInKw(value) {
  return text(value).split("/")[0].trim();
}

function seatCount(value) {
  const parts = text(value)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[1] || parts[0] || "";
}

function engineVolume(value) {
  const normalized = text(value);
  return normalized && !/cm/i.test(normalized)
    ? `${normalized} cm³`
    : normalized;
}

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => text(value) !== "")
  );
}

export function mapVehicleRegistryData(data = {}) {
  const technicalParams = compact({
    brand: data.TovarniZnacka,
    model: firstValue(data.ObchodniOznaceni, data.Typ),
    version: joinedUnique([data.Varianta, data.Verze]),
    bodyType: firstValue(
      data.KaroserieDruh,
      data.VozidloDruh2,
      data.VozidloDruh
    ),
    fuel: data.Palivo,
    engine: engineVolume(data.MotorZdvihObjem),
    powerKw: powerInKw(data.MotorMaxVykon),
    doors: data.VozidloKaroserieDvere,
    seats: seatCount(data.VozidloKaroserieMist),
    color: data.VozidloKaroserieBarva,
    firstRegistration: isoDate(data.DatumPrvniRegistrace),
    registrationInCzechia: isoDate(data.DatumPrvniRegistraceVCr),
    productionYear: firstValue(
      data.RokVyroby,
      isoDate(data.DatumPrvniRegistrace).slice(0, 4)
    ),
    stkValidUntil: isoDate(data.PravidelnaTechnickaProhlidkaDo),
    ownersCount: data.PocetVlastniku,
    operatorsCount: data.PocetProvozovatelu,
    vehicleStatus: data.StatusNazev,
  });

  const cebiaHistory = compact({
    owners: data.PocetVlastniku,
    operators: data.PocetProvozovatelu,
  });

  const reportParts = [
    "Údaje byly doplněny z oficiálního Registru silničních vozidel podle VIN.",
  ];

  if (technicalParams.ownersCount) {
    reportParts.push(`Počet vlastníků: ${technicalParams.ownersCount}.`);
  }
  if (technicalParams.operatorsCount) {
    reportParts.push(`Počet provozovatelů: ${technicalParams.operatorsCount}.`);
  }
  if (technicalParams.stkValidUntil) {
    reportParts.push(`Platnost STK do: ${technicalParams.stkValidUntil}.`);
  }

  return {
    technicalParams,
    cebiaHistory,
    report: reportParts.join(" "),
  };
}

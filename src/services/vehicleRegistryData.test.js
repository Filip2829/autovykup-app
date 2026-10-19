import test from "node:test";
import assert from "node:assert/strict";
import { mapVehicleRegistryData } from "../../supabase/functions/_shared/vehicleRegistryData.js";

test("maps official registry values into technical parameters", () => {
  const result = mapVehicleRegistryData({
    TovarniZnacka: "ŠKODA",
    ObchodniOznaceni: "OCTAVIA",
    Varianta: "NX",
    Verze: "ABC123",
    KaroserieDruh: "KOMBI",
    Palivo: "BENZIN",
    MotorZdvihObjem: "1498",
    MotorMaxVykon: "110 / 5000",
    VozidloKaroserieDvere: "5",
    VozidloKaroserieMist: "0 / 5 / 0",
    VozidloKaroserieBarva: "MODRÁ",
    DatumPrvniRegistrace: "2021-03-18T00:00:00",
    DatumPrvniRegistraceVCr: "2022-02-02T00:00:00",
    RokVyroby: "2021",
    PravidelnaTechnickaProhlidkaDo: "2027-03-18T00:00:00",
    PocetVlastniku: 2,
    PocetProvozovatelu: 3,
    StatusNazev: "Provozované",
  });

  assert.deepEqual(result.technicalParams, {
    brand: "ŠKODA",
    model: "OCTAVIA",
    version: "NX / ABC123",
    bodyType: "KOMBI",
    fuel: "BENZIN",
    engine: "1498 cm³",
    powerKw: "110",
    doors: "5",
    seats: "5",
    color: "MODRÁ",
    firstRegistration: "2021-03-18",
    registrationInCzechia: "2022-02-02",
    productionYear: "2021",
    stkValidUntil: "2027-03-18",
    ownersCount: 2,
    operatorsCount: 3,
    vehicleStatus: "Provozované",
  });
  assert.deepEqual(result.cebiaHistory, { owners: 2, operators: 3 });
  assert.match(result.report, /Počet vlastníků: 2/);
  assert.match(result.report, /Platnost STK do: 2027-03-18/);
});

test("omits empty official values so they cannot overwrite existing data", () => {
  const result = mapVehicleRegistryData({
    TovarniZnacka: "  ",
    Typ: "FABIA",
    MotorZdvihObjem: null,
    PravidelnaTechnickaProhlidkaDo: "neznámé",
  });

  assert.deepEqual(result.technicalParams, { model: "FABIA" });
  assert.deepEqual(result.cebiaHistory, {});
});

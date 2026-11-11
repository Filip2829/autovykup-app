import test from "node:test";
import assert from "node:assert/strict";
import { buildEquipmentDetailsUpdate, equipmentItems, formatEquipmentWarranty, normalizeEquipment } from "./vehicleEquipment.js";
import { buildOnlineListingText } from "./buildOnlineListingText.js";
import { buildVehicleProfile } from "./buildVehicleProfile.js";

test("catalogue merges synonymous equipment and excludes items outside the supplied wizard", () => {
  assert.equal(new Set(equipmentItems).size, equipmentItems.length);
  assert.deepEqual(normalizeEquipment({
    Navigace: true, "Satelitní navigace": true, "Navigační systém": false,
    "Multimediální a navigační systém": true, ESP: false, ESC: true,
    "Apple Car Play": true, "Apple CarPlay": true, "Prémiové audio": true,
    "6x airbag": true,
  }), { Navigace: true, ESP: true, "Apple CarPlay": true, "6× airbag": true });
  assert.deepEqual(normalizeEquipment({ Navigace: false }), { Navigace: false });
});

test("separate details survive the existing technical_params JSON storage round trip", () => {
  const original = { id: 1, technicalParams: { brand: "Renault", warranty: "Původní záruka" }, checklist: { "Servisní historie": true } };
  let updated = buildEquipmentDetailsUpdate(original, "twoKeys", "yes");
  updated = buildEquipmentDetailsUpdate(updated, "secondWheelSet", "yes");
  updated = buildEquipmentDetailsUpdate(updated, "warrantyUntil", "2028-12-20");
  updated = buildEquipmentDetailsUpdate(updated, "warrantyKm", "150000");
  updated = buildEquipmentDetailsUpdate(updated, "notes", "K vozu je protokol CEBIA.");
  const reloaded = { ...updated, technicalParams: undefined, technical_params: JSON.parse(JSON.stringify(updated.technicalParams)) };
  assert.equal(reloaded.technical_params.brand, "Renault");
  assert.equal(reloaded.checklist["Servisní historie"], true);
  assert.equal(reloaded.checklist["Počet klíčů 2x"], true);
  assert.equal(buildVehicleProfile(reloaded).history.warranty, "do 20.12.2028 / do 150 000 km");
  const listing = buildOnlineListingText(reloaded);
  assert.match(listing, /Protokol CEBIA/);
  assert.match(listing, /2× klíč/);
  assert.match(listing, /2 sady kol/);
  assert.match(listing, /Záruka: do 20\.12\.2028 \/ do 150 000 km/);
  assert.equal(original.technicalParams.equipmentDetails, undefined);
});

test("explicit negative key and wheel choices override older notes", () => {
  const car = { notes: ["Vůz má 2 klíče a dvě sady kol"], technicalParams: { equipmentDetails: { twoKeys: "no", secondWheelSet: "no" } } };
  assert.equal(buildOnlineListingText(car), "");
  assert.equal(formatEquipmentWarranty({ warrantyKm: "" }), "");
  assert.equal(formatEquipmentWarranty({ warrantyKm: "-1" }), "");
});

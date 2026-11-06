import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStockPreparationUpdate, getStockPreparation } from "./stockPreparation.js";

test("existing checklist and advertised status populate preparation", () => {
  assert.deepEqual(getStockPreparation({ status: "advertised", checklist: {
    "Provedeno čištění": true, "Mechanická prohlídka + diagnostika": true,
  } }), { cleaned: true, inspected: true, ready: true, advertised: true, note: "" });
  assert.equal(getStockPreparation({ status: "purchased" }).advertised, false);
});

test("preparation changes preserve unrelated administration and notes", () => {
  const car = { status: "commission", checklist: {
    "Servisní historie": true,
    stockPreparation: { note: "Čeká na díl", ready: true },
  } };
  const original = structuredClone(car);
  const patch = buildStockPreparationUpdate(car, "cleaned", true);
  assert.equal(patch.checklist["Provedeno čištění"], true);
  assert.equal(patch.checklist["Servisní historie"], true);
  assert.deepEqual(patch.checklist.stockPreparation, car.checklist.stockPreparation);
  assert.equal(patch.status, "commission");
  assert.deepEqual(car, original);
});

test("advertising checkbox moves a vehicle into and out of advertised status", () => {
  const car = { status: "ready_for_advertising", checklist: {} };
  const advertised = { ...car, ...buildStockPreparationUpdate(car, "advertised", true) };
  assert.equal(advertised.status, "advertised");
  assert.equal(getStockPreparation(advertised).advertised, true);
  const pending = { ...advertised, ...buildStockPreparationUpdate(advertised, "advertised", false) };
  assert.equal(pending.status, "ready_for_advertising");
  assert.equal(getStockPreparation(pending).advertised, false);
});

test("ready can be revoked and a note does not change workflow", () => {
  const car = { status: "ready_for_advertising", checklist: {} };
  const patch = buildStockPreparationUpdate(car, "ready", false);
  assert.equal(patch.status, "preparation");
  assert.equal(getStockPreparation({ ...car, ...patch }).ready, false);
  const notePatch = buildStockPreparationUpdate(car, "note", "Čekáme na servis");
  assert.equal(notePatch.status, car.status);
  assert.equal(getStockPreparation({ ...car, ...notePatch }).note, "Čekáme na servis");
});

test("a reserved vehicle retains its reservation when preparation changes", () => {
  const car = { status: "reserved", checklist: {} };
  const patch = buildStockPreparationUpdate(car, "advertised", true);
  assert.equal(patch.status, "reserved");
  assert.equal(getStockPreparation({ ...car, ...patch }).advertised, true);
});

test("manual advertising status changes remain the source of truth", () => {
  assert.equal(getStockPreparation({ status: "advertised", checklist: { stockPreparation: { advertised: false } } }).advertised, true);
  assert.equal(getStockPreparation({ status: "preparation", checklist: { stockPreparation: { advertised: true } } }).advertised, false);
});

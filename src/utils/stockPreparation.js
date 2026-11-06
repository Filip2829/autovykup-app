export const preparationSteps = [
  { key: "cleaned", label: "Profesionální čištění" },
  { key: "inspected", label: "Mechanická kontrola" },
  { key: "ready", label: "Připraveno k inzerci" },
  { key: "advertised", label: "Zainzerováno" },
];

const checklistKeys = {
  cleaned: "Provedeno čištění",
  inspected: "Mechanická prohlídka + diagnostika",
};

export function getStockPreparation(car) {
  const checklist = car.checklist || {};
  const preparation = checklist.stockPreparation || {};
  return {
    cleaned: checklist[checklistKeys.cleaned] === true,
    inspected: checklist[checklistKeys.inspected] === true,
    ready: preparation.ready ?? ["ready_for_advertising", "advertised"].includes(car.status),
    advertised: car.status === "advertised" || (car.status === "reserved" && preparation.advertised === true),
    note: preparation.note || "",
  };
}

export function buildStockPreparationUpdate(car, key, value) {
  const checklist = { ...car.checklist };
  if (checklistKeys[key]) {
    checklist[checklistKeys[key]] = value;
  } else {
    checklist.stockPreparation = { ...checklist.stockPreparation, [key]: value };
  }
  let status = car.status;
  if (["ready", "advertised"].includes(key) && status !== "reserved") {
    const preparation = { ...getStockPreparation({ ...car, checklist }), [key]: value };
    status = preparation.advertised ? "advertised"
      : preparation.ready ? "ready_for_advertising" : "preparation";
  }
  return { checklist, status };
}

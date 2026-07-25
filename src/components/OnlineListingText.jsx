import { useState } from "react";

const stockStatuses = new Set([
  "purchased",
  "commission",
  "preparation",
  "ready_for_advertising",
  "advertised",
  "reserved",
]);

const equipmentPriority = [
  "Adaptivní tempomat",
  "Automatická klimatizace",
  "Navigace",
  "Apple CarPlay",
  "Android Auto",
  "Couvací kamera",
  "Parkovací senzory přední",
  "Parkovací senzory zadní",
  "Matrix LED světlomety",
  "LED světlomety",
  "Vyhřívaná sedadla",
  "Vyhřívaný volant",
  "Kožené sedačky",
  "Digitální kokpit",
  "Tažné zařízení",
  "Bluetooth",
];

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function hasTextValue(value) {
  return (
    (typeof value === "string" && value.trim() !== "") ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function firstValue(...values) {
  const value = values.find(hasTextValue);
  return hasTextValue(value) ? String(value).trim() : "";
}

function normalizeTextParts(value) {
  const values = Array.isArray(value) ? value : [value];

  return values
    .filter(
      (item) =>
        typeof item === "string" ||
        (typeof item === "number" && Number.isFinite(item))
    )
    .flatMap((item) => String(item).split("\n"))
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/[.!?]+$/, ""));
}

function toInlineText(value) {
  return normalizeTextParts(value).join("; ");
}

function formatDate(value) {
  if (!hasValue(value)) return "";

  const normalizedValue = String(value).trim();
  const match = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? `${match[3]}.${match[2]}.${match[1]}`
    : normalizedValue;
}

function formatMileage(value) {
  const mileage = Number(value);
  return Number.isFinite(mileage) && mileage > 0
    ? `${Math.round(mileage).toLocaleString("cs-CZ")} km`
    : "";
}

function formatPower(value) {
  if (!hasValue(value)) return "";
  const power = String(value).trim();
  return /\bkw\b/i.test(power) ? power : `${power} kW`;
}

function formatTransmission(value) {
  if (!hasValue(value)) return "";

  const transmission = String(value).trim();
  const speedMatch = transmission.match(/(\d+)[-\s]?speed/i);

  if (/manual gearbox/i.test(transmission)) {
    return speedMatch
      ? `${speedMatch[1]}stupňová manuální`
      : "manuální";
  }
  if (/automatic gearbox/i.test(transmission)) {
    return speedMatch
      ? `${speedMatch[1]}stupňová automatická`
      : "automatická";
  }

  return transmission;
}

function formatCurrency(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0
    ? `${Math.round(price).toLocaleString("cs-CZ")} Kč`
    : "";
}

function getSellingPrice(car = {}) {
  return [
    car.expectedSalePrice,
    car.expected_sale_price,
    car.saleEstimate,
    car.sale_estimate,
  ].find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
}

function buildVehicleName(car, technicalParams) {
  const structuredName = [
    technicalParams.brand,
    technicalParams.model,
    technicalParams.version,
  ]
    .filter(hasValue)
    .map((value) => String(value).trim())
    .filter(
      (value, index, values) =>
        values.findIndex(
          (candidate) =>
            candidate.toLocaleLowerCase("cs-CZ") ===
            value.toLocaleLowerCase("cs-CZ")
        ) === index
    )
    .join(" ");

  return structuredName || firstValue(car.name);
}

function getSelectedEquipment(equipment = {}) {
  const priority = new Map(
    equipmentPriority.map((label, index) => [
      label.toLocaleLowerCase("cs-CZ"),
      index,
    ])
  );

  return Object.entries(equipment)
    .filter(([label, enabled]) => enabled === true && hasValue(label))
    .map(([label]) => String(label).trim())
    .filter(
      (label, index, labels) =>
        labels.findIndex(
          (candidate) =>
            candidate.toLocaleLowerCase("cs-CZ") ===
            label.toLocaleLowerCase("cs-CZ")
        ) === index
    )
    .sort((left, right) => {
      const leftPriority =
        priority.get(left.toLocaleLowerCase("cs-CZ")) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority =
        priority.get(right.toLocaleLowerCase("cs-CZ")) ??
        Number.MAX_SAFE_INTEGER;

      return (
        leftPriority - rightPriority ||
        left.localeCompare(right, "cs-CZ")
      );
    })
    .slice(0, 12);
}

function hasCebiaHistory(cebiaHistory = {}) {
  return Object.values(cebiaHistory).some(hasValue);
}

function buildTechnicalLines(car, technicalParams) {
  const lines = [];
  const productionYear = firstValue(technicalParams.productionYear, car.year);
  const firstRegistration = formatDate(technicalParams.firstRegistration);
  const mileage = formatMileage(car.km);
  const engine = firstValue(technicalParams.engine);
  const power = formatPower(technicalParams.powerKw);
  const fuel = firstValue(technicalParams.fuel);
  const transmission = formatTransmission(technicalParams.transmission);
  const bodyType = firstValue(technicalParams.bodyType);

  if (productionYear) lines.push(`Rok výroby: ${productionYear}`);
  if (firstRegistration) lines.push(`První registrace: ${firstRegistration}`);
  if (mileage) lines.push(`Nájezd: ${mileage}`);
  if (engine && power) lines.push(`Motor: ${engine}, ${power}`);
  else if (engine) lines.push(`Motor: ${engine}`);
  else if (power) lines.push(`Výkon: ${power}`);
  if (fuel) lines.push(`Palivo: ${fuel}`);
  if (transmission) lines.push(`Převodovka: ${transmission}`);
  if (bodyType) lines.push(`Karoserie: ${bodyType}`);

  return lines;
}

function buildHistoryLines(car, technicalParams, cebiaHistory) {
  const lines = [];
  const origin = firstValue(
    cebiaHistory.countryOfOrigin,
    technicalParams.origin
  );
  const owners = firstValue(cebiaHistory.owners);
  const stkValidUntil = formatDate(technicalParams.stkValidUntil);
  const warranty = firstValue(
    technicalParams.warranty,
    cebiaHistory.warranty
  );

  if (origin) lines.push(`Původ vozidla: ${origin}`);
  if (owners) lines.push(`Počet majitelů nebo provozovatelů: ${owners}`);
  if (car.checklist?.["Servisní historie"] === true) {
    lines.push("Servisní historie je evidována");
  }
  if (stkValidUntil) lines.push(`STK platná do: ${stkValidUntil}`);
  if (warranty) lines.push(`Záruka: ${toInlineText(warranty)}`);

  if (Array.isArray(car.cebiaFiles) && car.cebiaFiles.length > 0) {
    lines.push("Podklady CEBIA jsou k dispozici");
  } else if (hasValue(car.aiCebiaReport) || hasCebiaHistory(cebiaHistory)) {
    lines.push("U vozidla jsou evidované údaje z CEBIA");
  }

  return lines;
}

function buildConditionLines(advertisingData, damageReport, cebiaHistory) {
  const lines = [];
  const repairs = toInlineText(advertisingData.repairs);
  const explicitDefects = toInlineText(advertisingData.defects);
  const publicDamageFields = [
    ["Celkový stav", damageReport.overallCondition],
    ["Karoserie a lak", damageReport.exterior],
    ["Interiér", damageReport.interior],
    ["Technický stav", damageReport.technical],
    ["Pneumatiky a kola", damageReport.tiresBrakes],
    ["Skla a světla", damageReport.glassLights],
    ["Další poškození", damageReport.otherDamage],
    ["Historie poškození", cebiaHistory.damageHistory],
    ["Informace ke stavu kilometrů", cebiaHistory.mileageSuspicion],
    ["Upozornění z CEBIA", cebiaHistory.riskNotes],
  ];

  if (repairs) lines.push(`Provedené opravy nebo servis: ${repairs}`);
  if (explicitDefects) lines.push(`Známé vady: ${explicitDefects}`);

  publicDamageFields.forEach(([label, value]) => {
    const text = toInlineText(value);
    if (text) lines.push(`${label}: ${text}`);
  });

  return lines;
}

function formatSection(title, lines) {
  if (lines.length === 0) return "";
  return `${title}:\n${lines.map((line) => `• ${line}`).join("\n")}`;
}

function buildOnlineListingText(selectedCar = {}) {
  const technicalParams = selectedCar.technicalParams || {};
  const advertisingData = selectedCar.advertisingData || {};
  const damageReport = selectedCar.damageReport || {};
  const cebiaHistory = selectedCar.cebiaHistory || {};
  const vehicleName = buildVehicleName(selectedCar, technicalParams);
  const equipment = getSelectedEquipment(selectedCar.equipment);
  const sellingPrice = formatCurrency(getSellingPrice(selectedCar));
  const intro = vehicleName
    ? stockStatuses.has(selectedCar.status)
      ? `Nabízíme k prodeji vůz ${vehicleName}.`
      : `Informace k vozu ${vehicleName}.`
    : "Informace k nabízenému vozu.";
  const conclusion = stockStatuses.has(selectedCar.status)
    ? "Vůz je k vidění na pobočce Opportunity, Sedláčkova 10, Brno-Líšeň."
    : "Více informací poskytne pobočka Opportunity, Sedláčkova 10, Brno-Líšeň.";

  return [
    vehicleName,
    intro,
    formatSection(
      "Hlavní informace",
      buildTechnicalLines(selectedCar, technicalParams)
    ),
    formatSection("Výbava", equipment),
    formatSection(
      "Historie a servis",
      buildHistoryLines(selectedCar, technicalParams, cebiaHistory)
    ),
    formatSection(
      "Stav vozidla",
      buildConditionLines(advertisingData, damageReport, cebiaHistory)
    ),
    sellingPrice ? `Cena:\n${sellingPrice}` : "",
    conclusion,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) throw new Error("Text se nepodařilo zkopírovat.");
}

export default function OnlineListingText({ selectedCar, updateCar }) {
  const [copyStatus, setCopyStatus] = useState("");
  const advertisingData = selectedCar.advertisingData || {};
  const onlineListingText = advertisingData.onlineListingText || "";

  function updateOnlineListingText(value) {
    setCopyStatus("");
    updateCar({
      ...selectedCar,
      advertisingData: {
        ...advertisingData,
        onlineListingText: value,
      },
    });
  }

  function generateText() {
    if (
      onlineListingText.trim() &&
      !window.confirm(
        "Aktuální text bude nahrazen nově vygenerovanou verzí. Pokračovat?"
      )
    ) {
      return;
    }

    updateOnlineListingText(buildOnlineListingText(selectedCar));
  }

  async function copyText() {
    if (!onlineListingText.trim()) return;

    try {
      await copyTextToClipboard(onlineListingText);
      setCopyStatus("success");
    } catch (error) {
      console.error("Copy online listing text error:", error);
      setCopyStatus("error");
    }
  }

  return (
    <div className="card decision onlineListingText">
      <h2>Text online inzerce</h2>
      <p className="customerEmailDescription">
        Text je sestaven pouze z dostupných údajů vozidla. Před zveřejněním jej
        vždy zkontrolujte a případně upravte.
      </p>

      <textarea
        className="customerEmailTextarea"
        aria-label="Text online inzerce"
        placeholder="Vygenerujte text z dostupných údajů vozidla."
        value={onlineListingText}
        onChange={(event) => updateOnlineListingText(event.target.value)}
      />

      <div className="customerEmailActions">
        <button type="button" className="primary" onClick={generateText}>
          Vygenerovat text
        </button>
        <button
          type="button"
          className="primary outline"
          onClick={copyText}
          disabled={!onlineListingText.trim()}
        >
          Kopírovat
        </button>
      </div>

      <div className="customerEmailStatus" aria-live="polite">
        {copyStatus === "success" && (
          <p className="okText">Text byl úspěšně zkopírován.</p>
        )}
        {copyStatus === "error" && (
          <p className="badText">
            Text se nepodařilo zkopírovat. Zkuste to prosím znovu.
          </p>
        )}
      </div>
    </div>
  );
}

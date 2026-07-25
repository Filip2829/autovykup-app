import { useState } from "react";
import { buildVehicleProfile } from "../utils/buildVehicleProfile.js";

const stockStatuses = new Set([
  "purchased",
  "commission",
  "preparation",
  "ready_for_advertising",
  "advertised",
  "reserved",
]);

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

function buildVehicleName(profile) {
  const structuredName = [
    profile.identity.brand,
    profile.identity.model,
    profile.technical.version,
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

  return structuredName || firstValue(profile.identity.name);
}

function buildTechnicalLines(profile) {
  const lines = [];
  const productionYear = firstValue(
    profile.technical.productionYear,
    profile.technical.year
  );
  const firstRegistration = formatDate(profile.technical.firstRegistration);
  const mileage = formatMileage(profile.technical.mileage);
  const engine = firstValue(profile.technical.engine);
  const power = formatPower(profile.technical.powerKw);
  const fuel = firstValue(profile.technical.fuel);
  const transmission = formatTransmission(profile.technical.transmission);
  const bodyType = firstValue(profile.technical.bodyType);

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

function buildHistoryLines(profile) {
  const lines = [];
  const origin = firstValue(profile.history.origin);
  const owners = firstValue(profile.history.ownersCount);
  const stkValidUntil = formatDate(profile.history.stk);
  const warranty = firstValue(
    profile.technical.warranty,
    profile.history.cebiaWarranty
  );

  if (origin) lines.push(`Původ vozidla: ${origin}`);
  if (owners) lines.push(`Počet majitelů nebo provozovatelů: ${owners}`);
  if (profile.history.serviceHistoryConfirmed) {
    lines.push("Servisní historie je evidována");
  }
  if (stkValidUntil) lines.push(`STK platná do: ${stkValidUntil}`);
  if (warranty) lines.push(`Záruka: ${toInlineText(warranty)}`);

  if (profile.history.cebiaDocumentsAvailable) {
    lines.push("Podklady CEBIA jsou k dispozici");
  } else if (
    profile.history.cebiaReportAvailable ||
    profile.history.cebiaHistoryAvailable
  ) {
    lines.push("U vozidla jsou evidované údaje z CEBIA");
  }

  return lines;
}

function buildConditionLines(profile) {
  const lines = [];
  const repairs = toInlineText(profile.condition.completedRepairs);
  const explicitDefects = toInlineText(profile.condition.publicDefects);
  const publicDamage = profile.condition.publicDamage;
  const publicDamageFields = [
    ["Celkový stav", publicDamage.overallCondition],
    ["Karoserie a lak", publicDamage.exterior],
    ["Interiér", publicDamage.interior],
    ["Technický stav", publicDamage.technical],
    ["Pneumatiky a kola", publicDamage.tiresBrakes],
    ["Skla a světla", publicDamage.glassLights],
    ["Další poškození", publicDamage.otherDamage],
    ["Historie poškození", publicDamage.cebiaDamageHistory],
    ["Informace ke stavu kilometrů", publicDamage.mileageSuspicion],
    ["Upozornění z CEBIA", publicDamage.cebiaRiskNotes],
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

export function buildOnlineListingText(selectedCar = {}) {
  const profile = buildVehicleProfile(selectedCar);
  const vehicleName = buildVehicleName(profile);
  const equipment = profile.equipment.highlightedItems;
  const sellingPrice = formatCurrency(profile.pricing.effectiveSalePrice);
  const intro = vehicleName
    ? stockStatuses.has(profile.identity.status)
      ? `Nabízíme k prodeji vůz ${vehicleName}.`
      : `Informace k vozu ${vehicleName}.`
    : "Informace k nabízenému vozu.";
  const conclusion = stockStatuses.has(profile.identity.status)
    ? "Vůz je k vidění na pobočce Opportunity, Sedláčkova 10, Brno-Líšeň."
    : "Více informací poskytne pobočka Opportunity, Sedláčkova 10, Brno-Líšeň.";

  return [
    vehicleName,
    intro,
    formatSection(
      "Hlavní informace",
      buildTechnicalLines(profile)
    ),
    formatSection("Výbava", equipment),
    formatSection("Historie a servis", buildHistoryLines(profile)),
    formatSection(
      "Stav vozidla",
      buildConditionLines(profile)
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
  const profile = buildVehicleProfile(selectedCar);
  const advertisingData = selectedCar.advertisingData || {};
  const onlineListingText = profile.advertising.onlineListingText || "";

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

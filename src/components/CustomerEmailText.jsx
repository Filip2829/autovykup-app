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

function firstValue(...values) {
  const value = values.find(hasValue);
  return hasValue(value) ? String(value).trim() : "";
}

function normalizeLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[.!?]+$/, ""));
}

function toInlineText(value) {
  return normalizeLines(value).join("; ");
}

function ensureSentence(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function formatMileage(value) {
  const mileage = Number(value);
  if (!Number.isFinite(mileage) || mileage <= 0) return "";
  return `${mileage.toLocaleString("cs-CZ")} km`;
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
  if (!Number.isFinite(price) || price <= 0) return "";
  return `${Math.round(price).toLocaleString("cs-CZ")} Kč`;
}

function formatDate(value) {
  if (!hasValue(value)) return "";

  const normalizedValue = String(value).trim();
  const match = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return normalizedValue;

  return `${match[3]}.${match[2]}.${match[1]}`;
}

function buildVehicleName(profile) {
  const structuredName = [profile.identity.brand, profile.identity.model]
    .filter(hasValue)
    .map((value) => String(value).trim())
    .join(" ");

  return structuredName || firstValue(profile.identity.name);
}

function buildTechnicalParagraph(profile) {
  const sentences = [];
  const engine = firstValue(profile.technical.engine);
  const fuel = firstValue(profile.technical.fuel);
  const transmission = formatTransmission(profile.technical.transmission);
  const power = formatPower(profile.technical.powerKw);
  const productionYear = firstValue(
    profile.technical.productionYear,
    profile.technical.year
  );
  const firstRegistration = formatDate(profile.technical.firstRegistration);
  const mileage = formatMileage(profile.technical.mileage);

  if (productionYear) sentences.push(`Vůz je z roku ${productionYear}.`);
  if (firstRegistration) {
    sentences.push(`První registrace proběhla ${firstRegistration}.`);
  }
  if (mileage) {
    sentences.push(`Aktuálně je evidován stav tachometru ${mileage}.`);
  }
  if (engine && power) {
    sentences.push(`Motorizace vozu je ${engine} s výkonem ${power}.`);
  } else if (engine) {
    sentences.push(`Motorizace vozu je ${engine}.`);
  } else if (power) {
    sentences.push(`Výkon vozu je ${power}.`);
  }
  if (fuel && transmission) {
    sentences.push(`Palivo je ${fuel} a převodovka je ${transmission}.`);
  } else if (fuel) {
    sentences.push(`Palivo je ${fuel}.`);
  } else if (transmission) {
    sentences.push(`Převodovka je ${transmission}.`);
  }

  return sentences.join(" ");
}

function buildHistoryParagraph(profile) {
  const sentences = [];
  const origin = firstValue(profile.history.origin);
  const owners = firstValue(profile.history.ownersCount);

  if (origin) sentences.push(`Původ vozidla: ${origin}.`);
  if (owners) {
    sentences.push(`Počet evidovaných majitelů nebo provozovatelů: ${owners}.`);
  }
  if (hasValue(profile.history.imported)) {
    sentences.push(
      `Informace k importu nebo registraci: ${ensureSentence(
        profile.history.imported
      )}`
    );
  }
  if (hasValue(profile.history.previousUse)) {
    sentences.push(
      `Evidované využití vozidla: ${ensureSentence(
        profile.history.previousUse
      )}`
    );
  }

  if (profile.history.cebiaDocumentsAvailable) {
    sentences.push("K vozu jsou k dispozici podklady CEBIA.");
  } else if (
    profile.history.cebiaReportAvailable ||
    profile.history.cebiaHistoryAvailable
  ) {
    sentences.push("U vozu jsou evidovány informace z CEBIA.");
  }

  return sentences.join(" ");
}

function buildServiceParagraph(profile) {
  const sentences = [];
  const stkValidUntil = formatDate(profile.history.stk);
  const warranty = firstValue(
    profile.technical.warranty,
    profile.history.cebiaWarranty
  );
  const completedRepairs = toInlineText(profile.condition.completedRepairs);

  if (profile.history.serviceHistory) {
    sentences.push("U vozu je evidována servisní historie.");
  }
  if (completedRepairs) {
    sentences.push(
      `Provedené opravy nebo servis před prodejem: ${ensureSentence(
        completedRepairs
      )}`
    );
  }
  if (stkValidUntil) sentences.push(`STK je platná do ${stkValidUntil}.`);
  if (warranty) sentences.push(`Záruka: ${ensureSentence(warranty)}`);

  return sentences.join(" ");
}

function buildConditionParagraph(profile) {
  const details = [];
  const explicitDefects = toInlineText(profile.condition.publicDefects);
  const publicDamage = profile.condition.publicDamage;
  const damageFields = [
    ["celkový stav", publicDamage.overallCondition],
    ["karoserie a lak", publicDamage.exterior],
    ["interiér", publicDamage.interior],
    ["technický stav", publicDamage.technical],
    ["pneumatiky a kola", publicDamage.tiresBrakes],
    ["skla a světla", publicDamage.glassLights],
    ["další poškození", publicDamage.otherDamage],
  ];

  if (explicitDefects) details.push(explicitDefects);

  damageFields.forEach(([label, value]) => {
    const text = toInlineText(value);
    if (text) details.push(`${label}: ${text}`);
  });

  const damageHistory = toInlineText(publicDamage.cebiaDamageHistory);
  const mileageSuspicion = toInlineText(publicDamage.mileageSuspicion);
  const riskNotes = toInlineText(publicDamage.cebiaRiskNotes);

  if (damageHistory) details.push(`historie poškození: ${damageHistory}`);
  if (mileageSuspicion) {
    details.push(`informace ke stavu kilometrů: ${mileageSuspicion}`);
  }
  if (riskNotes) details.push(`upozornění z CEBIA: ${riskNotes}`);

  return details.length > 0
    ? `Známé informace o stavu vozidla: ${ensureSentence(
        details.join("; ")
      )}`
    : "";
}

function buildPriceParagraph(profile) {
  const sellingPrice = formatCurrency(profile.pricing.expectedSalePrice);
  return sellingPrice ? `Prodejní cena vozu je ${sellingPrice}.` : "";
}

function buildBranchParagraph(profile) {
  if (stockStatuses.has(profile.identity.status)) {
    return "Vůz máme skladem na pobočce Opportunity, Sedláčkova 10, Brno-Líšeň.";
  }

  return "Pro bližší informace se můžete obrátit na pobočku Opportunity, Sedláčkova 10, Brno-Líšeň.";
}

export function buildCustomerEmailText(selectedCar = {}) {
  const profile = buildVehicleProfile(selectedCar);
  const vehicleName = buildVehicleName(profile);
  const paragraphs = [
    "Dobrý den,",
    vehicleName
      ? `dle domluvy Vám zasílám bližší informace k vozu ${vehicleName}.`
      : "dle domluvy Vám zasílám bližší informace k vozu.",
    buildTechnicalParagraph(profile),
    buildHistoryParagraph(profile),
    buildServiceParagraph(profile),
    buildConditionParagraph(profile),
    buildPriceParagraph(profile),
    buildBranchParagraph(profile),
    "V případě jakýchkoliv dotazů se na mě neváhejte obrátit.",
    "Děkuji a přeji Vám pěkný den.",
  ];

  return paragraphs.filter(Boolean).join("\n\n");
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

export default function CustomerEmailText({ selectedCar, updateCar }) {
  const [copyStatus, setCopyStatus] = useState("");
  const profile = buildVehicleProfile(selectedCar);
  const advertisingData = selectedCar.advertisingData || {};
  const customerEmailText = profile.advertising.customerEmailText || "";

  function updateCustomerEmailText(value) {
    setCopyStatus("");
    updateCar({
      ...selectedCar,
      advertisingData: {
        ...advertisingData,
        customerEmailText: value,
      },
    });
  }

  function generateText() {
    if (
      customerEmailText.trim() &&
      !window.confirm(
        "Aktuální text bude nahrazen nově vygenerovanou verzí. Pokračovat?"
      )
    ) {
      return;
    }

    updateCustomerEmailText(buildCustomerEmailText(selectedCar));
  }

  async function copyText() {
    if (!customerEmailText.trim()) return;

    try {
      await copyTextToClipboard(customerEmailText);
      setCopyStatus("success");
    } catch (error) {
      console.error("Copy customer email text error:", error);
      setCopyStatus("error");
    }
  }

  return (
    <div className="card decision customerEmailText">
      <h2>Informace pro zákazníka</h2>
      <p className="customerEmailDescription">
        Text je sestaven pouze z dostupných údajů vozidla. Před odesláním jej
        vždy zkontrolujte a případně upravte.
      </p>

      <textarea
        className="customerEmailTextarea"
        aria-label="Informace pro zákazníka"
        placeholder="Vygenerujte text z dostupných údajů vozidla."
        value={customerEmailText}
        onChange={(event) => updateCustomerEmailText(event.target.value)}
      />

      <div className="customerEmailActions">
        <button type="button" className="primary" onClick={generateText}>
          Vygenerovat text
        </button>
        <button
          type="button"
          className="primary outline"
          onClick={copyText}
          disabled={!customerEmailText.trim()}
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

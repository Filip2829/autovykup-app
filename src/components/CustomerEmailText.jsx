import { useState } from "react";

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

function hasCebiaHistory(cebiaHistory = {}) {
  return Object.values(cebiaHistory).some(hasValue);
}

function buildVehicleName(car, technicalParams) {
  const structuredName = [technicalParams.brand, technicalParams.model]
    .filter(hasValue)
    .map((value) => String(value).trim())
    .join(" ");

  return structuredName || firstValue(car.name);
}

function buildTechnicalParagraph(car, technicalParams) {
  const sentences = [];
  const engine = firstValue(technicalParams.engine);
  const fuel = firstValue(technicalParams.fuel);
  const transmission = formatTransmission(technicalParams.transmission);
  const power = formatPower(technicalParams.powerKw);
  const productionYear = firstValue(
    technicalParams.productionYear,
    car.year
  );
  const firstRegistration = formatDate(technicalParams.firstRegistration);
  const mileage = formatMileage(car.km);

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

function buildHistoryParagraph(car, technicalParams, cebiaHistory) {
  const sentences = [];
  const origin = firstValue(
    cebiaHistory.countryOfOrigin,
    technicalParams.origin
  );
  const owners = firstValue(cebiaHistory.owners);

  if (origin) sentences.push(`Původ vozidla: ${origin}.`);
  if (owners) {
    sentences.push(`Počet evidovaných majitelů nebo provozovatelů: ${owners}.`);
  }
  if (hasValue(cebiaHistory.importInfo)) {
    sentences.push(
      `Informace k importu nebo registraci: ${ensureSentence(
        cebiaHistory.importInfo
      )}`
    );
  }
  if (hasValue(cebiaHistory.taxiOrRental)) {
    sentences.push(
      `Evidované využití vozidla: ${ensureSentence(
        cebiaHistory.taxiOrRental
      )}`
    );
  }

  if (Array.isArray(car.cebiaFiles) && car.cebiaFiles.length > 0) {
    sentences.push("K vozu jsou k dispozici podklady CEBIA.");
  } else if (hasValue(car.aiCebiaReport) || hasCebiaHistory(cebiaHistory)) {
    sentences.push("U vozu jsou evidovány informace z CEBIA.");
  }

  return sentences.join(" ");
}

function buildServiceParagraph(
  car,
  technicalParams,
  cebiaHistory,
  advertisingData
) {
  const sentences = [];
  const stkValidUntil = formatDate(technicalParams.stkValidUntil);
  const warranty = firstValue(
    technicalParams.warranty,
    cebiaHistory.warranty
  );
  const completedRepairs = toInlineText(advertisingData.repairs);

  if (car.checklist?.["Servisní historie"]) {
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

function buildConditionParagraph(
  advertisingData,
  damageReport,
  cebiaHistory
) {
  const details = [];
  const explicitDefects = toInlineText(advertisingData.defects);
  const damageFields = [
    ["celkový stav", damageReport.overallCondition],
    ["karoserie a lak", damageReport.exterior],
    ["interiér", damageReport.interior],
    ["technický stav", damageReport.technical],
    ["pneumatiky a kola", damageReport.tiresBrakes],
    ["skla a světla", damageReport.glassLights],
    ["další poškození", damageReport.otherDamage],
  ];

  if (explicitDefects) details.push(explicitDefects);

  damageFields.forEach(([label, value]) => {
    const text = toInlineText(value);
    if (text) details.push(`${label}: ${text}`);
  });

  const damageHistory = toInlineText(cebiaHistory.damageHistory);
  const mileageSuspicion = toInlineText(cebiaHistory.mileageSuspicion);
  const riskNotes = toInlineText(cebiaHistory.riskNotes);

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

function buildPriceParagraph(car) {
  const sellingPrice = formatCurrency(car.expectedSalePrice);
  return sellingPrice ? `Prodejní cena vozu je ${sellingPrice}.` : "";
}

function buildBranchParagraph(car) {
  if (stockStatuses.has(car.status)) {
    return "Vůz máme skladem na pobočce Opportunity, Sedláčkova 10, Brno-Líšeň.";
  }

  return "Pro bližší informace se můžete obrátit na pobočku Opportunity, Sedláčkova 10, Brno-Líšeň.";
}

function buildCustomerEmailText(selectedCar = {}) {
  const technicalParams = selectedCar.technicalParams || {};
  const advertisingData = selectedCar.advertisingData || {};
  const damageReport = selectedCar.damageReport || {};
  const cebiaHistory = selectedCar.cebiaHistory || {};
  const vehicleName = buildVehicleName(selectedCar, technicalParams);
  const paragraphs = [
    "Dobrý den,",
    vehicleName
      ? `dle domluvy Vám zasílám bližší informace k vozu ${vehicleName}.`
      : "dle domluvy Vám zasílám bližší informace k vozu.",
    buildTechnicalParagraph(selectedCar, technicalParams),
    buildHistoryParagraph(selectedCar, technicalParams, cebiaHistory),
    buildServiceParagraph(
      selectedCar,
      technicalParams,
      cebiaHistory,
      advertisingData
    ),
    buildConditionParagraph(advertisingData, damageReport, cebiaHistory),
    buildPriceParagraph(selectedCar),
    buildBranchParagraph(selectedCar),
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
  const advertisingData = selectedCar.advertisingData || {};
  const customerEmailText = advertisingData.customerEmailText || "";

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

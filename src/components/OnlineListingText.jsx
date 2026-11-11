import { useState } from "react";
import { buildVehicleProfile } from "../utils/buildVehicleProfile.js";

import { buildOnlineListingText } from "../utils/buildOnlineListingText.js";

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
        Stručná hesla z dostupných údajů karty vozu: klíče či karty, sady kol,
        servis, CEBIA, původ, záruka a podmínky prodeje. Před zveřejněním text
        zkontrolujte a případně upravte.
      </p>

      <textarea
        className="customerEmailTextarea"
        aria-label="Text online inzerce"
        placeholder="Vygenerujte hesla z dostupných údajů karty vozu."
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

const sourceLabels = {
  cebia: "CEBIA",
  photo: "Fotografie",
  document: "Dokument",
};

const highlightPriority = [
  "Panoramatická střecha",
  "Automatická převodovka",
  "Automatická klimatizace",
  "Adaptivní tempomat",
  "Matrix LED",
  "LED světlomety",
  "Couvací kamera",
  "Digitální kokpit",
  "Hlídání mrtvého úhlu",
  "Asistent jízdy v pruzích",
  "Bezklíčové odemykání",
  "Bezklíčové startování",
  "Vyhřívaná sedadla",
  "Kožené sedačky",
  "Navigace",
  "Apple CarPlay",
  "Android Auto",
  "Tažné zařízení",
];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getVehicleEquipmentHighlights(technicalParams = {}) {
  const evidence = Array.isArray(technicalParams?.equipmentEvidence)
    ? technicalParams.equipmentEvidence
    : [];
  const seen = new Set();

  return evidence
    .map((item) => {
      const name = text(item?.name);
      const source = text(item?.source).toLowerCase();
      const confidence = Number(item?.confidence);
      return {
        name,
        source,
        sourceLabel: sourceLabels[source] || "Doklad",
        note: text(item?.note),
        confidence: Number.isFinite(confidence) ? confidence : 0,
      };
    })
    .filter((item) => {
      if (!item.name || !sourceLabels[item.source] || item.confidence < 0.7) {
        return false;
      }
      const key = item.name.toLocaleLowerCase("cs");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const aIndex = highlightPriority.indexOf(a.name);
      const bIndex = highlightPriority.indexOf(b.name);
      const aRank = aIndex === -1 ? highlightPriority.length : aIndex;
      const bRank = bIndex === -1 ? highlightPriority.length : bIndex;
      return aRank - bRank || a.name.localeCompare(b.name, "cs");
    });
}

export function getEquipmentLevelStatus(technicalParams = {}) {
  const level = text(technicalParams?.equipmentLevel);
  if (!level) return null;

  const source = text(technicalParams?.equipmentLevelSource).toLowerCase();
  const verified = technicalParams?.equipmentLevelVerified === true;

  if (source === "comparison") {
    return { label: "Odhad z porovnání", tone: "estimate" };
  }
  if (source === "cebia" && verified) {
    return { label: "CEBIA + ověřeno", tone: "verified" };
  }
  if (source === "cebia") {
    return { label: "Z CEBIA", tone: "source" };
  }
  return { label: "Ručně zadané", tone: "manual" };
}

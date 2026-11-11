import { buildVehicleProfile } from "./buildVehicleProfile.js";

function textParts(value) {
  return (Array.isArray(value) ? value : [value])
    .filter((part) => typeof part === "string")
    .flatMap((part) => part.split(/[\n;•]+|,(?!\d)/))
    .map((part) => part.trim().replace(/[.!]+$/, ""))
    .filter(Boolean);
}

// Accept complete phrases only: a mention inside a negative or uncertain
// sentence must never become a confirmed selling point.
const phraseRules = [
  [/^(?:2\s*[x×]?\s*kart[ay]|dvě karty)$/iu, "2× karta"],
  [/^(?:2\s*[x×]?\s*klíč(?:e|ů)?|dva klíče)$/iu, "2× klíč"],
  [/^(?:2\s*[x×]?\s*sad[ay] kol|dvě sady kol)$/iu, "2 sady kol"],
  [/^pravidelný servis$/iu, "Pravidelný servis"],
  [/^(?:servisní historie|doložená servisní historie)$/iu, "Servisní historie"],
  [/^(?:protokol cebia|cebia protokol)$/iu, "Protokol CEBIA"],
  [/^(?:český původ|(?:za)?koupeno jako nové v (?:čr|česku))$/iu, "Český původ"],
  [/^(?:za)?koupeno v autorizované (?:prodejně|prodejně vozů)$/iu, "Zakoupeno v autorizované prodejně"],
  [/^záruka\s*:\s*\S.+$/iu],
  [/^bonus při financování(?:\s*:\s*\S.+|\s+\d[\d\s.,]*\s*kč)?$/iu],
  [/^možnost (?:vozu na protiúčet|protiúčtu|výkupu vozu na protiúčet)$/iu, "Možnost vozu na protiúčet"],
];

export function buildOnlineListingText(selectedCar = {}) {
  const profile = buildVehicleProfile(selectedCar);
  const lines = [];
  const preparation = profile.advertising.preparationData;
  const phrases = [preparation.highlights, preparation.repairs, preparation.listingNote]
    .flatMap(textParts);

  for (const [pattern, label] of phraseRules) {
    for (const phrase of phrases) {
      if (pattern.test(phrase)) lines.push(label || phrase);
    }
  }

  if (selectedCar.checklist?.["Počet klíčů 2x"] === true &&
      !lines.includes("2× karta")) lines.push("2× klíč");
  if (profile.history.serviceHistoryConfirmed &&
      !lines.includes("Pravidelný servis")) lines.push("Servisní historie");
  if (profile.history.cebiaDocumentsAvailable) lines.push("Protokol CEBIA");
  if (/^(?:česká republika|čr|cz|czech republic|czechia|česko)$/iu.test(
    String(profile.history.origin).trim()
  )) lines.push("Český původ");
  const warranty = textParts(profile.history.warranty).join("; ");
  if (warranty) lines.push(`Záruka: ${warranty}`);

  return [...new Set(lines)].join("\n");
}

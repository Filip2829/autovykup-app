import { buildVehicleProfile } from "./buildVehicleProfile.js";

function textParts(value) {
  return (Array.isArray(value) ? value : [value])
    .filter((part) => typeof part === "string")
    .flatMap((part) => part.split(/[\n;•]+|,(?![\d-])/))
    .map((part) => part.trim().replace(/[.!]+$/, ""))
    .filter(Boolean);
}

// These exact phrases remain supported for the advertising quick choices.
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

function normalize(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function isUnconfirmed(value) {
  return /\?|\b(?:ne|neni|nejsou|nebyl|nebyla|nebyly|nema|nemame|bez|chybi|chybeji|nelze|neplati|nedostupn\w*|neoveren\w*|nepotvrzen\w*|mozna|pokud|zjistit|overit|proverit|pripadne|pry|udajne|bude|budou|nutno|ceka|zrusen\w*|neposkyt\w*|nenabiz\w*|nevyuz\w*)\b/.test(normalize(value));
}

// Extract only the requested public facts, never the surrounding note text
// (which can include usernames, customer details or internal prices).
function factsFromNote(note) {
  if (isUnconfirmed(note)) return [];
  const text = normalize(note);
  const facts = [];
  if (/\b(?:2\s*[x×]?\s*kart[ay]|dve karty)\b/.test(text)) facts.push("2× karta");
  if (/\b(?:2\s*[x×]?\s*klic(?:e|u)?|dva klice)\b/.test(text)) facts.push("2× klíč");
  if (/\b(?:2\s*[x×]?\s*sad[ay] kol|dve sady kol)\b/.test(text)) facts.push("2 sady kol");
  if (/\b(?:pravideln\w* servis\w*|pravidelne servisovan\w*)\b/.test(text)) facts.push("Pravidelný servis");
  if (/\bservisni historie\b/.test(text)) facts.push("Servisní historie");
  if (/\b(?:protokol\w*|vypis\w*|report\w*)\b.{0,35}\bcebia\b|\bcebia\b.{0,35}\b(?:protokol\w*|vypis\w*|report\w*)\b/.test(text)) facts.push("Protokol CEBIA");
  if (/\b(?:cesky puvod|puvod\s*:\s*(?:cr|ceska republika)|(?:za)?koupen\w* jako nov\w* v (?:cr|cesku))\b/.test(text)) facts.push("Český původ");
  if (/\b(?:za)?koupen\w*\b.{0,25}\bautorizovan\w* (?:prodejn\w*|prodejc\w*)\b/.test(text)) facts.push("Zakoupeno v autorizované prodejně");
  if (/\bbonus\w*\b/.test(text) && /\bfinancovani\b/.test(text) &&
      !/\b(?:interni|proviz\w*|zamestnan\w*|prodejce)\b/.test(text)) {
    const amount = note.match(/\bbonus\p{L}*\s*(?::|ve výši)?\s*((?:až\s+)?\d[\d\s.,-]*\s*(?:tisíc\s+|tis\.?\s*)?(?:Kč|CZK))/iu)
      || note.match(/((?:až\s+)?\d[\d\s.,-]*\s*(?:tisíc\s+|tis\.?\s*)?(?:Kč|CZK))\s*(?:jako\s+)?bonus/iu)
      || note.match(/\bfinancování\s*:?\s*((?:až\s+)?\d[\d\s.,-]*\s*(?:tisíc\s+|tis\.?\s*)?(?:Kč|CZK))/iu);
    facts.push(amount ? `Bonus při financování: ${amount[1].trim()}` : "Bonus při financování");
  }
  const warranty = note.match(/\bzáruk[au]\s*(?::|na|po dobu)?\s*((?:\d+\s*(?:měsíc\p{L}*|let|rok\p{L}*))(?:\s*\/\s*\d[\d\s]*\s*km)?)/iu)
    || note.match(/\bzáruk[au]\s*(?::)?\s*(do\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4}(?:\s*\/\s*\d[\d\s]*\s*km)?)/iu);
  if (warranty) facts.push(`Záruka: ${warranty[1].trim()}`);
  if (/\b(?:moznost\b.{0,30}\bprotiuct\w*|(?:vuz|vozu|auto|automobil)\b.{0,20}\b(?:na protiucet|protiuctem)|protiucet\s+(?:mozny|vitany))\b/.test(text)) facts.push("Možnost vozu na protiúčet");
  return facts;
}

export function buildOnlineListingText(selectedCar = {}) {
  const profile = buildVehicleProfile(selectedCar);
  const lines = [];
  const preparation = profile.advertising.preparationData;
  const advertisingData = selectedCar.advertisingData ||
    selectedCar.technicalParams?.advertisingData || selectedCar.technical_params?.advertisingData || {};
  const phrases = [preparation.highlights, preparation.repairs, preparation.listingNote]
    .flatMap(textParts);

  for (const [pattern, label] of phraseRules) {
    for (const phrase of phrases) {
      if (pattern.test(phrase)) lines.push(label || phrase);
    }
  }

  const notes = [...phrases, ...textParts(selectedCar.notes), ...textParts(advertisingData.internalSaleNote)]
    .flatMap((part) => part.split(/(?<=[.!])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/u));
  for (const note of notes) {
    for (const fact of factsFromNote(note)) {
      if (fact.startsWith("Bonus při financování")) {
        const existing = lines.findIndex((line) => normalize(line).startsWith("bonus pri financovani"));
        if (existing !== -1) {
          if (fact.includes(":") && !lines[existing].includes(":")) lines[existing] = fact;
          continue;
        }
      }
      lines.push(fact);
    }
  }
  if (lines.includes("2× karta")) {
    const keyIndex = lines.indexOf("2× klíč");
    if (keyIndex !== -1) lines.splice(keyIndex, 1);
  }
  if (lines.includes("Pravidelný servis")) {
    let index;
    while ((index = lines.indexOf("Servisní historie")) !== -1) lines.splice(index, 1);
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
  if (warranty) {
    // The dedicated warranty field takes precedence over free-text notes.
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith("Záruka:")) lines.splice(i, 1);
    }
    lines.push(`Záruka: ${warranty}`);
  }

  return [...new Set(lines)].join("\n");
}

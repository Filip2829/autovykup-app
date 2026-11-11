// Catalogue transcribed from the equipment wizard. Synonyms share one key.
export const equipmentGroups = [
  { title: "Aktivní bezpečnost", items: [
    "ABS", "Automatické zabrzdění v kopci", "Brzdový asistent", "EDS",
    "Asistent jízdy v pruzích", "Hlídání mrtvého úhlu", "Parkovací senzor",
    "Parkovací asistent", "ASR", "Regulace rychlosti při jízdě ze svahu",
    "Senzor opotřebení brzdových destiček", "Senzor tlaku v pneumatikách",
    "ESP", "AFU", "CSV", "Omezovač rychlosti", "Tempomat s omezovačem rychlosti",
    "EBV", "Asistent rozjezdu do kopce", "Couvací kamera", "Systém parkování 360 stupňů",
    "Tlačítko SOS", "Parkovací senzory přední", "Parkovací senzory zadní", "Asistent pro jízdu v koloně",
  ] },
  { title: "Airbag", items: ["1× airbag", "2× airbag", "4× airbag", "6× airbag", "8× airbag", "10× airbag", "12× airbag", "14× airbag", "Deaktivace airbagu spolujezdce"] },
  { title: "Pohon", items: ["6 rychlostních stupňů", "7 rychlostních stupňů", "8 rychlostních stupňů", "Automatická převodovka", "Manuální převodovka", "Automatická uzávěrka diferenciálu", "Pohon 4x4", "Tempomat", "Adaptivní tempomat", "Uzávěrka diferenciálu", "ESM (rekuperace energie při brzdění)"] },
  { title: "Zabezpečení", items: ["Alarm", "GPS zabezpečení", "Imobilizér", "Zámek řadicí páky"] },
  { title: "Osvětlení", items: ["Automatická aktivace výstražných světlometů", "Denní svícení", "Mlhové světlomety", "Natáčecí světlomety", "Noční vidění", "Ostřikovače světlometů", "LED světlomety", "Senzor světel", "Xenonové světlomety", "Zadní světla LED", "Bi-xenonové světlomety", "Denní svícení LED", "LED adaptivní světlomety", "Matrix LED"] },
  { title: "Chlazení, topení", items: ["Automatická klimatizace", "Autochladnička", "Čtyřzónová klimatizace", "Manuální klimatizace", "Klimatizovaná přihrádka", "Nezávislé topení", "Vnitřní teploměr", "Vyhřívané rukojeti", "Dvouzónová automatická klimatizace"] },
  { title: "Audio, video", items: ["Autorádio", "AUX", "CD měnič", "CD přehrávač", "DVD měnič", "DVD přehrávač", "Head-up display", "Televize", "USB", "MP3", "Rádio s odděleným displejem", "Rádio s ovládáním pod volantem", "Digitální příjem rádia (DAB)", "Dotykový multimediální systém bez navigace"] },
  { title: "Startování", items: ["Bezklíčové odemykání a startování", "Startování tlačítkem"] },
  { title: "Exteriér", items: ["Boční spoilery", "Držák kol", "Litá kola", "Ochranné rámy", "Střešní spoiler"] },
  { title: "Komunikace", items: ["CB vysílačka", "Navigace", "Telefon", "Bluetooth", "Hands free", "Android Auto", "Apple CarPlay"] },
  { title: "Dveře", items: ["Dálkové centrální zamykání", "Centrální zamykání", "Elektrické dovírání dveří", "Elektrické víko kufru"] },
  { title: "Sedadla", items: ["Dělená zadní sedadla", "Dětská sedačka", "Elektrická sedadla", "Kožené sedačky", "Přední sedadla s funkcí masáže", "Zadní sedadla s funkcí masáže", "Sportovní sedadla", "Vyhřívaná sedadla", "Výsuvné opěrky hlav", "Výškově nastavitelná sedadla", "Výškově nastavitelné sedadlo řidiče", "Isofix", "Přední loketní opěrka", "Posuvná zadní sedadla"] },
  { title: "Interiér", items: ["Dřevěné obložení"] },
  { title: "Okna", items: ["Dvojitá okna", "Elektrická přední okna", "Elektrická zadní okna", "Senzor stěračů", "Vyhřívané přední sklo", "Tónovaná skla"] },
  { title: "Zrcátka", items: ["Elektricky sklopná zrcátka", "Elektrická zrcátka", "Vyhřívaná zrcátka"] },
  { title: "Emise", items: ["Katalyzátor", "EURO 0", "EURO I", "EURO II", "EURO III", "EURO IV", "EURO V", "EURO VI"] },
  { title: "Řízení", items: ["Multifunkční volant", "Nastavitelný volant", "Posilovač řízení", "Vyhřívaný volant", "Výškově a hloubkově stavitelný volant", "Kožený volant", "El. posilovač řízení", "Hydraulický posilovač řízení", "El. posilovač řízení s proměnlivým účinkem", "Poloautomatická ruční brzda"] },
  { title: "Zvláštní výbava", items: ["Naviják", "Pro tělesně postižené", "Zásuvka na 12V", "Rezerva"] },
  { title: "Střecha", items: ["Nosič zavazadel", "Panoramatická střecha", "Střešní nosič", "Střešní okno", "Střešní šíbr elektrický", "Střešní šíbr manuální"] },
  { title: "Přístroje", items: ["Palubní počítač", "Tachograf", "Venkovní teploměr", "Elektrochromatické samostmívací vnitřní zp. zrcátko", "Otáčkoměr"] },
  { title: "Podvozek", items: ["Regulace tuhosti podvozku", "Regulace výšky podvozku", "Tažné zařízení"] },
];

export const equipmentItems = equipmentGroups.flatMap((group) => group.items);
const allowedItems = new Set(equipmentItems);
export const equipmentLabels = {
  "Asistent jízdy v pruzích": "Hlídání jízdního pruhu",
  "ASR": "ASR / ASC (protiprokluzový systém kol)",
  "ESP": "ESP / ESC (stabilizace podvozku)",
  "Couvací kamera": "Parkovací kamera",
  "Parkovací senzory přední": "Přední parkovací senzory",
  "Parkovací senzory zadní": "Zadní parkovací senzory",
  "Adaptivní tempomat": "Tempomat udržující odstup od vozidla vpředu",
  "LED světlomety": "Přední světla LED",
  "Matrix LED": "LED matrixové světlomety",
  "Navigace": "Navigační systém",
  "Multifunkční volant": "Ovládání na volantu",
  "Elektrická sedadla": "Elektricky seřiditelná sedadla",
  "Kožené sedačky": "Kožené potahy",
  "Elektrické víko kufru": "Elektrické víko zavazadlového prostoru",
};

function normalized(value) {
  return value.trim().toLocaleLowerCase("cs-CZ").replace(/\s+/g, " ");
}
const aliases = new Map(equipmentItems.map((item) => [normalized(item), item]));
for (const [key, label] of Object.entries(equipmentLabels)) aliases.set(normalized(label), key);
for (const [alias, key] of Object.entries({
  "ASC": "ASR", "ASC (protiprokluzový systém kol)": "ASR", "ASR (protiprokluzový systém kol)": "ASR",
  "ESC": "ESP", "ESP (stabilizace podvozku)": "ESP",
  "Satelitní navigace": "Navigace", "Multimediální a navigační systém": "Navigace",
  "Apple Car Play": "Apple CarPlay", "Matrix LED světlomety": "Matrix LED",
  "6x airbag": "6× airbag", "1x airbag": "1× airbag", "2x airbag": "2× airbag", "4x airbag": "4× airbag",
  "8x airbag": "8× airbag", "10x airbag": "10× airbag", "12x airbag": "12× airbag", "14x airbag": "14× airbag",
  "el. přední okna": "Elektrická přední okna", "el. zadní okna": "Elektrická zadní okna",
  "elektrické ovládání předních oken": "Elektrická přední okna", "elektrické ovládání zadních oken": "Elektrická zadní okna",
  "front electric windows": "Elektrická přední okna", "rear electric windows": "Elektrická zadní okna",
  "front power windows": "Elektrická přední okna", "rear power windows": "Elektrická zadní okna",
  "Rádio": "Autorádio", "Radio": "Autorádio", "Car radio": "Autorádio",
})) aliases.set(normalized(alias), key);

export function exclusiveEquipmentGroup(label) {
  if (/^\d+× airbag$/.test(label)) return "airbagCount";
  if (/^EURO (?:0|I|II|III|IV|V|VI)$/.test(label)) return "emissions";
  if (/^\d+ rychlostních stupňů$/.test(label)) return "gearCount";
  if (["Automatická převodovka", "Manuální převodovka"].includes(label)) return "transmission";
  return "";
}

export function canonicalEquipmentLabel(label) {
  if (typeof label !== "string") return "";
  const value = normalized(label);
  const known = aliases.get(value);
  if (known) return known;
  const airbags = value.match(/^(1|2|4|6|8|10|12|14)\s*(?:[x×]\s*)?airbag(?:s|ů|y)?$/u);
  if (airbags) return `${airbags[1]}× airbag`;
  const euro = value.match(/^euro[\s-]*([0-6])(?:[\s-]?[abcd](?:\d|(?:-(?:temp|isc|fcm|evap))*)?)?$/u);
  return euro ? `EURO ${["0", "I", "II", "III", "IV", "V", "VI"][Number(euro[1])]}` : "";
}

export function normalizeEquipment(equipment = {}) {
  const result = {};
  for (const [label, enabled] of Object.entries(equipment || {})) {
    const key = canonicalEquipmentLabel(label);
    if (key && allowedItems.has(key)) result[key] = result[key] === true || enabled === true;
  }
  if (equipment?.["Bezklíčové odemykání"] === true && equipment?.["Bezklíčové startování"] === true) {
    result["Bezklíčové odemykání a startování"] = true;
  }
  return result;
}

export function getEquipmentDetails(car = {}) {
  const params = car.technicalParams || car.technical_params || {};
  return params.equipmentDetails || {};
}

export function buildEquipmentDetailsUpdate(car, field, value) {
  const details = { ...getEquipmentDetails(car), [field]: value };
  return {
    ...car,
    ...(field === "twoKeys" ? { checklist: { ...car.checklist, "Počet klíčů 2x": value === "yes" } } : {}),
    technicalParams: { ...(car.technicalParams || car.technical_params || {}), equipmentDetails: details },
  };
}

export function formatEquipmentWarranty(details = {}) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(details.warrantyUntil || "")
    ? details.warrantyUntil.split("-").reverse().join(".") : "";
  const km = Number(details.warrantyKm);
  return [date ? `do ${date}` : "", Number.isFinite(km) && km > 0 ? `do ${km.toLocaleString("cs-CZ")} km` : ""]
    .filter(Boolean).join(" / ");
}

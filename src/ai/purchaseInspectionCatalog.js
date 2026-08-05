export const PURCHASE_INSPECTION_CATEGORIES = {
  engine: "Motor a pohon",
  chassis: "Podvozek a brzdy",
  body: "Karoserie a vizuální stav",
  interior: "Interiér a elektronika",
  testDrive: "Zkušební jízda",
};

export const PURCHASE_INSPECTION_PRIORITIES = {
  critical: "Kritické",
  important: "Důležité",
  recommended: "Doporučené",
};

export const BASE_INSPECTION_RULES = [
  {
    id: "engine-cold-start",
    category: "engine",
    priority: "critical",
    title: "Studený start a chod motoru",
    reason:
      "Neobvyklý zvuk, kouřivost nebo nepravidelný chod může upozornit na technický problém.",
    howToCheck:
      "Startovat se studeným motorem, poslouchat chod a sledovat kouřivost i kontrolky.",
  },
  {
    id: "engine-leaks-fluids",
    category: "engine",
    priority: "important",
    title: "Úniky a stav provozních kapalin",
    reason:
      "Stopy kapalin mohou upozornit na netěsnost nebo zanedbanou údržbu.",
    howToCheck:
      "Prohlédnout motorový prostor i místo pod vozem a ověřit stav dostupných kapalin.",
  },
  {
    id: "chassis-brakes",
    category: "chassis",
    priority: "critical",
    title: "Podvozek, pneumatiky a brzdy",
    reason:
      "Nerovnoměrné opotřebení nebo vůle může upozornit na problém podvozku či geometrie.",
    howToCheck:
      "Zkontrolovat pneumatiky, viditelné části brzd a při jízdě ověřit hluk, vůle a brzdění.",
  },
  {
    id: "body-panels-paint",
    category: "body",
    priority: "important",
    title: "Spáry karoserie a lak",
    reason:
      "Rozdíly odstínu, tloušťky laku nebo nepravidelné spáry mohou upozornit na dřívější opravu.",
    howToCheck:
      "Porovnat odstíny a spáry jednotlivých dílů, podle možností použít měřič laku.",
  },
  {
    id: "interior-electronics",
    category: "interior",
    priority: "important",
    title: "Funkce interiéru a elektroniky",
    reason:
      "Nefunkční ovládání nebo kontrolky mohou znamenat potřebu další diagnostiky.",
    howToCheck:
      "Vyzkoušet hlavní ovladače, klimatizaci, infotainment, okna, světla a sledovat kontrolky.",
  },
  {
    id: "test-drive-behaviour",
    category: "testDrive",
    priority: "critical",
    title: "Chování vozu při zkušební jízdě",
    reason:
      "Vibrace, hluk nebo nestabilita mohou upozornit na závadu, která při stání není patrná.",
    howToCheck:
      "Ověřit rozjezd, akceleraci, držení směru, brzdění a zvuky v různých rychlostech.",
  },
];

export const MODEL_INSPECTION_RULES = {
  "dacia dokker": [
    {
      id: "van-sliding-doors",
      category: "body",
      priority: "important",
      title: "Posuvné dveře a jejich vedení",
      reason:
        "U modelu Dacia Dokker jde o typické kontrolní místo namáhané každodenním používáním.",
      howToCheck:
        "Několikrát otevřít a zavřít posuvné dveře, ověřit zámky, dorazy a plynulost vedení.",
    },
    {
      id: "van-load-stress",
      category: "chassis",
      priority: "important",
      title: "Známky dlouhodobého zatěžování",
      reason:
        "U užitkového provedení může stav nákladového prostoru a zadní části upozornit na intenzivní provoz.",
      howToCheck:
        "Prohlédnout podlahu, prahy, zadní nápravu, pružiny a nerovnoměrné opotřebení pneumatik.",
    },
  ],
};

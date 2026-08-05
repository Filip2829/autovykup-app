export const PURCHASE_INSPECTION_CATEGORIES = {
  engine: "Motor",
  emissions: "Emisní systém",
  transmission: "Převodovka",
  drivetrain: "Pohon",
  chassis: "Specifická místa podvozku",
  body: "Karoserie a konstrukce",
  electronics: "Elektronika",
  cooling: "Chladicí systém",
  other: "Další specifická rizika",
};

export const PURCHASE_INSPECTION_PRIORITIES = {
  critical: "Kritické",
  important: "Důležité",
  recommended: "Doporučené",
};

export const ENGINE_CODE_INSPECTION_RULES = [
  {
    match: { engineCodes: ["K9K"] },
    items: [
      {
        id: "k9k-injector-corrections",
        riskKey: "diesel-injection",
        category: "engine",
        priority: "critical",
        title: "Studený start a korekce vstřikovačů K9K",
        reason:
          "U motoru K9K mohou nepravidelný studený chod nebo vysoké korekce upozornit na opotřebení vstřikovací soustavy.",
        howToCheck:
          "Startovat skutečně studený motor, poslouchat chod a diagnostikou ověřit korekce jednotlivých vstřikovačů.",
        specificity: {
          engineCode: ["K9K"],
        },
      },
    ],
  },
];

export const MODEL_ENGINE_INSPECTION_RULES = [
  {
    match: {
      brand: "Dacia",
      model: "Dokker",
      engineIncludes: ["1.5 dci", "1,5 dci"],
    },
    items: [
      {
        id: "dokker-15dci-injectors",
        riskKey: "diesel-injection",
        category: "engine",
        priority: "critical",
        title: "Studený chod a vstřikovací soustava 1.5 dCi",
        reason:
          "U kombinace Dacia Dokker 1.5 dCi může nepravidelný studený chod upozornit na stav vstřikovačů.",
        howToCheck:
          "Startovat studený motor, sledovat ustálení volnoběhu a diagnostikou ověřit korekce vstřikovačů.",
        specificity: {
          brand: "Dacia",
          model: "Dokker",
          engine: "1.5 dCi",
        },
      },
      {
        id: "dokker-15dci-turbo-oil-feed",
        riskKey: "turbo-oil-feed",
        category: "engine",
        priority: "critical",
        title: "Turbodmychadlo a jeho mazání",
        reason:
          "U této motorizace je stav turbodmychadla a jeho mazání známým kontrolním místem; olej v sání nebo nepravidelný plnicí tlak může upozornit na opotřebení.",
        howToCheck:
          "Ověřit netěsnosti a množství oleje v sacím vedení, vůli turba podle možností a průběh plnicího tlaku diagnostikou.",
        specificity: {
          brand: "Dacia",
          model: "Dokker",
          engine: "1.5 dCi",
        },
      },
    ],
  },
];

export const MODEL_GENERATION_INSPECTION_RULES = [
  {
    match: {
      brand: "Dacia",
      model: "Dokker",
      minYear: 2012,
      maxYear: 2021,
    },
    items: [
      {
        id: "dokker-sliding-door-guides",
        riskKey: "dokker-sliding-doors",
        category: "body",
        priority: "important",
        title: "Vedení a zámky posuvných dveří",
        reason:
          "U Dacie Dokker této generace jde o specifické namáhané místo; zadrhávání nebo vůle může upozornit na opotřebení vedení či zámku.",
        howToCheck:
          "Několikrát projet celý chod dveří, ověřit vůli, dorazy, spodní vedení a jisté dovření zámku.",
        specificity: {
          brand: "Dacia",
          model: "Dokker",
          generationYears: "2012–2021",
        },
      },
      {
        id: "dokker-rear-load-stress",
        riskKey: "dokker-load-stress",
        category: "chassis",
        priority: "important",
        title: "Zadní část vozu a známky přetěžování",
        reason:
          "U užitkově provozovaného Dokkeru je specifickým kontrolním místem nákladová podlaha, uložení zadní nápravy a pružiny.",
        howToCheck:
          "Zaměřit se na deformace podlahy a prahů, výšku zadní části, stav pružin a uložení zadní nápravy.",
        specificity: {
          brand: "Dacia",
          model: "Dokker",
          generationYears: "2012–2021",
        },
      },
    ],
  },
];

export const ENGINE_FAMILY_INSPECTION_RULES = [
  {
    match: { engineIncludes: ["1.5 dci", "1,5 dci"] },
    items: [
      {
        id: "15dci-injector-balance",
        riskKey: "diesel-injection",
        category: "engine",
        priority: "critical",
        title: "Vyvážení vstřikovačů 1.5 dCi",
        reason:
          "U rodiny 1.5 dCi mohou vysoké korekce upozornit na opotřebení vstřikovací soustavy.",
        howToCheck:
          "Ověřit studený chod a diagnostikou porovnat korekce jednotlivých vstřikovačů.",
        specificity: {
          engineFamily: "1.5 dCi",
        },
      },
      {
        id: "15dci-dpf-egr-values",
        riskKey: "diesel-emissions",
        category: "emissions",
        priority: "important",
        title: "Hodnoty DPF a funkce EGR u 1.5 dCi",
        reason:
          "U rodiny 1.5 dCi jsou DPF a EGR známá kontrolní místa; časté regenerace nebo odchylky hodnot mohou upozornit na problém emisního systému.",
        howToCheck:
          "Diagnostikou ověřit zanesení a historii regenerací DPF, požadované a skutečné hodnoty EGR a související chyby.",
        specificity: {
          engineFamily: "1.5 dCi",
        },
      },
    ],
  },
];

export const TRANSMISSION_INSPECTION_RULES = [
  {
    match: { transmissionIncludes: ["easy-r", "easy r"] },
    items: [
      {
        id: "easy-r-clutch-actuator",
        riskKey: "easy-r-actuator",
        category: "transmission",
        priority: "critical",
        title: "Aktuátor spojky a adaptace převodovky Easy-R",
        reason:
          "U převodovky Easy-R je aktuátor a správná adaptace spojky specifickým kontrolním místem; prodlevy nebo rázy mohou upozornit na opotřebení či chybnou adaptaci.",
        howToCheck:
          "Ověřit rozjezd, manévrování a řazení za studena i po zahřátí a diagnostikou zkontrolovat chyby a adaptační hodnoty.",
        specificity: {
          transmission: "Easy-R",
        },
      },
    ],
  },
];

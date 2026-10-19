const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isImageUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp")
  );
}

function isPdfUrl(url: string) {
  return url.toLowerCase().includes(".pdf");
}

async function uploadPdfToOpenAI(url: string, apiKey: string) {
  const fileResponse = await fetch(url);

  if (!fileResponse.ok) {
    throw new Error(`PDF se nepodařilo stáhnout: ${url}`);
  }

  const blob = await fileResponse.blob();
  const fileName = url.split("/").pop()?.split("?")[0] || "cebia.pdf";

  const formData = new FormData();
  formData.append("purpose", "user_data");
  formData.append("file", blob, fileName);

  const uploadResponse = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`OpenAI upload PDF selhal: ${errorText}`);
  }

  const uploadedFile = await uploadResponse.json();
  return uploadedFile.id;
}

function extractOutputText(response: any) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const parts: string[] = [];

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

const equipmentItems = [
  "ABS", "Adaptivní tempomat", "Airbagy", "Alarm", "Android Auto",
  "Apple CarPlay", "Asistent jízdy v pruzích", "Automatická převodovka",
  "Automatická klimatizace",
  "Bezklíčové odemykání", "Bezklíčové startování", "Bluetooth",
  "Couvací kamera", "Digitální kokpit", "Elektrická sedadla",
  "Elektrická zrcátka", "Elektrické víko kufru", "ESP", "Head-up display",
  "Hlídání mrtvého úhlu", "Isofix", "Kožené sedačky", "LED světlomety",
  "Matrix LED", "Multifunkční volant", "Navigace", "Nezávislé topení",
  "Panoramatická střecha", "Parkovací senzory přední",
  "Parkovací senzory zadní", "Prémiové audio", "Sedačky s pamětí",
  "Tažné zařízení", "Tempomat", "Vyhřívaná sedadla", "Vyhřívaný volant",
  "Vzduchový podvozek",
];

function text(value: unknown, maxLength = 500) {
  return value === null || value === undefined
    ? ""
    : String(value).trim().slice(0, maxLength);
}

function numberBetweenZeroAndOne(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function sanitizeCar(car: Record<string, unknown> = {}) {
  const technicalParams = car.technicalParams && typeof car.technicalParams === "object"
    ? car.technicalParams as Record<string, unknown>
    : {};
  return {
    name: text(car.name, 150),
    year: text(car.year, 20),
    vin: text(car.vin, 17),
    brand: text(technicalParams.brand, 80),
    model: text(technicalParams.model, 100),
    version: text(technicalParams.version, 120),
    equipmentLevel: text(technicalParams.equipmentLevel, 120),
    bodyType: text(technicalParams.bodyType, 80),
    fuel: text(technicalParams.fuel, 80),
    engine: text(technicalParams.engine, 80),
    powerKw: text(technicalParams.powerKw, 30),
    transmission: text(technicalParams.transmission, 80),
    drive: text(technicalParams.drive, 80),
    firstRegistration: text(technicalParams.firstRegistration, 30),
  };
}

function normalizeEquipmentEvidence(value: unknown) {
  const allowedSources = new Set(["cebia", "photo", "document"]);
  const allowedItems = new Map(
    equipmentItems.map((item) => [item.toLocaleLowerCase("cs"), item])
  );
  const seen = new Set<string>();

  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const item = entry && typeof entry === "object"
        ? entry as Record<string, unknown>
        : {};
      const name = allowedItems.get(text(item.name, 100).toLocaleLowerCase("cs")) || "";
      const source = text(item.source, 20).toLowerCase();
      return {
        name,
        source,
        confidence: numberBetweenZeroAndOne(item.confidence),
        note: text(item.note, 240),
      };
    })
    .filter((item) => {
      if (!item.name || !allowedSources.has(item.source) || item.confidence < 0.7) {
        return false;
      }
      const key = item.name.toLocaleLowerCase("cs");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeReferences(value: unknown) {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const reference = entry && typeof entry === "object"
        ? entry as Record<string, unknown>
        : {};
      return {
        title: text(reference.title, 160),
        url: text(reference.url, 600),
      };
    })
    .filter((reference) => {
      try {
        const url = new URL(reference.url);
        if (url.protocol !== "https:" || seen.has(reference.url)) return false;
        seen.add(reference.url);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, 3);
}

async function compareEquipmentLevel({
  apiKey,
  vehicle,
  candidate,
  confirmedEquipment,
}: {
  apiKey: string;
  vehicle: Record<string, unknown>;
  candidate: string;
  confirmedEquipment: string[];
}) {
  if (!text(vehicle.brand, 80) || !text(vehicle.model, 100)) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `Jsi přesný analytik výbavových stupňů evropských vozidel. Porovnávej pouze skutečné vozy stejné značky, modelu, období, motoru a převodovky. Kandidáta z CEBIA ověř, nebo při jeho absenci odhadni nejpravděpodobnější obchodní název výbavy. Samotná shoda jednoho prvku výbavy nestačí. Nevymýšlej názvy. Vrať odkazy na konkrétní porovnávané vozy nebo věrohodné katalogy.`,
        },
        {
          role: "user",
          content: `Profil vozidla: ${JSON.stringify(vehicle)}\nKandidát z CEBIA: ${candidate || "neuveden"}\nPotvrzené prvky z dokumentů a fotografií: ${confirmedEquipment.join(", ") || "neuvedeny"}`,
        },
      ],
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 1800,
      text: {
        format: {
          type: "json_schema",
          name: "equipment_level_comparison",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              equipmentLevel: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              verified: { type: "boolean" },
              evidenceSummary: { type: "string" },
              references: {
                type: "array",
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["title", "url"],
                },
              },
            },
            required: [
              "equipmentLevel", "confidence", "verified",
              "evidenceSummary", "references",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`Equipment comparison returned HTTP ${response.status}.`);
    return null;
  }

  try {
    const parsed = JSON.parse(extractOutputText(await response.json()) || "{}");
    return {
      equipmentLevel: text(parsed.equipmentLevel, 120),
      confidence: numberBetweenZeroAndOne(parsed.confidence),
      verified: parsed.verified === true,
      evidenceSummary: text(parsed.evidenceSummary, 500),
      references: normalizeReferences(parsed.references),
    };
  } catch (error) {
    console.error("Equipment comparison could not be parsed:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "Missing OPENAI_API_KEY" }, 500);
    }

    const {
      car = {},
      technicalCardPhotos = [],
      cebiaFiles = [],
      vehiclePhotos = [],
    } =
      await req.json();

    const vehicleContext = sanitizeCar(car);

    const allFiles = [
      ...(technicalCardPhotos || []),
      ...(cebiaFiles || []),
    ].filter(Boolean);

    const vehicleImageUrls = (Array.isArray(vehiclePhotos) ? vehiclePhotos : [])
      .filter((url) => isImageUrl(String(url)))
      .slice(0, 12);

    if (allFiles.length === 0 && vehicleImageUrls.length === 0) {
      return jsonResponse({ error: "No CEBIA, TP or vehicle photos provided" }, 400);
    }

    const imageUrls = allFiles.filter((url) => isImageUrl(String(url)));
    const pdfUrls = allFiles.filter((url) => isPdfUrl(String(url)));

    const uploadedPdfFileIds: string[] = [];

    for (const pdfUrl of pdfUrls) {
      const fileId = await uploadPdfToOpenAI(String(pdfUrl), OPENAI_API_KEY);
      uploadedPdfFileIds.push(fileId);
    }

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "input_text",
        text: `
Jsi specialista na čtení CEBIA reportů a technických průkazů pro interní výkup vozidel.

Úkol:
Z dodaného CEBIA PDF nebo fotky TP vytěž:
1) technické parametry vozidla,
2) dostupnou historii CEBIA,
3) dostupnou výbavu vozidla.

Vrať POUZE validní JSON bez markdownu:

{
  "technicalParams": {
    "brand": "",
    "model": "",
    "version": "",
    "equipmentLevel": "",
    "bodyType": "",
    "fuel": "",
    "engine": "",
    "powerKw": "",
    "transmission": "",
    "drive": "",
    "doors": "",
    "seats": "",
    "color": "",
    "firstRegistration": "",
    "productionYear": "",
    "stkValidUntil": "",
    "equipmentLevelSource": "",
    "equipmentLevelConfidence": 0,
    "equipmentEvidence": [
      {
        "name": "",
        "source": "cebia|photo|document",
        "confidence": 0,
        "note": ""
      }
    ]
  },
  "cebiaHistory": {
    "owners": "",
    "countryOfOrigin": "",
    "damageHistory": "",
    "mileageHistory": "",
    "mileageSuspicion": "",
    "financing": "",
    "taxiOrRental": "",
    "importInfo": "",
    "riskNotes": ""
  },
  "equipment": [],
  "report": ""
}

Mapování technických parametrů:
- brand = značka / tovární značka
- model = model / obchodní označení
- version = verze, motor nebo obchodní varianta, např. 0.9 TCe
- equipmentLevel = přesný obchodní název výbavového stupně, pouze pokud je výslovně uveden v CEBIA nebo jiném dokumentu; ne motor ani interní typový kód
- bodyType = karoserie / kategorie vozu
- fuel = palivo
- engine = objem motoru, např. 898 ccm / 0.9 TCe
- powerKw = výkon v kW
- transmission = převodovka, včetně počtu stupňů
- drive = pohon
- doors = počet dveří, jako číslo
- seats = počet míst / sedadel, jako číslo
- color = barva karoserie
- firstRegistration = první registrace
- productionYear = rok výroby
- stkValidUntil = platnost STK, ideálně YYYY-MM-DD

Mapování Historie CEBIA:
- owners = počet nebo přehled majitelů/provozovatelů, pokud je dostupný
- countryOfOrigin = země původu / první registrace / trh určení
- damageHistory = škody, pojistné události, částky, místa poškození
- mileageHistory = stručný vývoj kilometrů podle CEBIA
- mileageSuspicion = podezření na manipulaci km; pokud není, napiš "Bez zjevného podezření podle dostupných záznamů"
- financing = výsledek kontroly financování/leasingu
- taxiOrRental = výsledek kontroly taxi/půjčovny
- importInfo = dovoz / původ / registrace v ČR
- riskNotes = důležité rizikové poznámky pro výkupčího

Výbava:
- equipment vrať jako pole názvů položek, které odpovídají výbavě v aplikaci.
- equipmentEvidence obsahuje stejnou potvrzenou výbavu včetně zdroje.
- source = "cebia" pro údaj výslovně uvedený v CEBIA, "photo" pro prvek jasně viditelný na fotografii vozu a "document" pro jiný doklad.
- confidence musí být 0 až 1. Za potvrzenou považuj jen hodnotu alespoň 0.7.
- Z fotografie uznej jen prvek, který je skutečně vidět (např. panoramatická střecha, volič automatu, tlačítka adaptivního tempomatu, LED světlomet, panel automatické klimatizace). Neodvozuj výbavu pouze z modelu.
- Používej jen tyto přesné názvy, pokud jsou v reportu nebo na fotografii jasně doložené:
ABS, Adaptivní tempomat, Airbagy, Alarm, Android Auto, Apple CarPlay,
Asistent jízdy v pruzích, Automatická převodovka, Automatická klimatizace, Bezklíčové odemykání,
Bezklíčové startování, Bluetooth, Couvací kamera, Digitální kokpit,
Elektrická sedadla, Elektrická zrcátka, Elektrické víko kufru, ESP,
Head-up display, Hlídání mrtvého úhlu, Isofix, Kožené sedačky,
LED světlomety, Matrix LED, Multifunkční volant, Navigace,
Nezávislé topení, Panoramatická střecha, Parkovací senzory přední,
Parkovací senzory zadní, Prémiové audio, Sedačky s pamětí,
Tažné zařízení, Tempomat, Vyhřívaná sedadla, Vyhřívaný volant,
Vzduchový podvozek.

Pravidla:
- Nevyplňuj aktuální km do technicalParams.
- Nevyplňuj emisní normu do technicalParams.
- Pokud údaj není jistý, nech hodnotu prázdnou.
- Název výbavy v této fázi nehádej; případný odhad proběhne odděleným porovnáním.
- Report napiš česky a stručně uveď, co bylo doplněno a co je nutné ručně ověřit.

Technický profil vozu bez osobních údajů slouží jen jako kontext. Nepovažuj jeho stávající název výbavy za důkaz a nekopíruj ho do výsledku bez dokladu:
${JSON.stringify(vehicleContext, null, 2)}
`,
      },
    ];

    for (const fileId of uploadedPdfFileIds) {
      userContent.push({
        type: "input_file",
        file_id: fileId,
      });
    }

    for (const imageUrl of imageUrls) {
      userContent.push({
        type: "input_image",
        image_url: imageUrl,
      });
    }

    if (vehicleImageUrls.length > 0) {
      userContent.push({
        type: "input_text",
        text: "Následují fotografie vozidla. Hledej pouze jasně viditelné prvky výbavy.",
      });
    }

    for (const imageUrl of vehicleImageUrls) {
      userContent.push({
        type: "input_image",
        image_url: String(imageUrl),
      });
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Jsi přesný asistent pro extrakci údajů z CEBIA a TP. Odpovídáš pouze validním JSON.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0.1,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();

      return jsonResponse(
        {
          error: "OpenAI Responses request failed",
          detail: errorText,
        },
        500
      );
    }

    const result = await openAiResponse.json();
    const outputText = extractOutputText(result) || "{}";

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = {
        technicalParams: {},
        cebiaHistory: {},
        equipment: [],
        report: outputText,
      };
    }

    const technicalParams = parsed.technicalParams &&
        typeof parsed.technicalParams === "object" &&
        !Array.isArray(parsed.technicalParams)
      ? { ...(parsed.technicalParams as Record<string, unknown>) }
      : {};
    const cebiaHistory = parsed.cebiaHistory &&
        typeof parsed.cebiaHistory === "object" &&
        !Array.isArray(parsed.cebiaHistory)
      ? parsed.cebiaHistory
      : {};
    const equipmentEvidence = normalizeEquipmentEvidence(
      technicalParams.equipmentEvidence
    );
    const confirmedEquipment = equipmentEvidence.map((item) => item.name);
    const extractedLevel = text(technicalParams.equipmentLevel, 120);
    const existingLevel = text(vehicleContext.equipmentLevel, 120);
    const candidate = extractedLevel || existingLevel;
    const comparisonVehicle = {
      ...vehicleContext,
      brand: text(technicalParams.brand, 80) || vehicleContext.brand,
      model: text(technicalParams.model, 100) || vehicleContext.model,
      version: text(technicalParams.version, 120) || vehicleContext.version,
      engine: text(technicalParams.engine, 80) || vehicleContext.engine,
      powerKw: text(technicalParams.powerKw, 30) || vehicleContext.powerKw,
      transmission:
        text(technicalParams.transmission, 80) || vehicleContext.transmission,
    };

    let comparison = null;
    try {
      comparison = await compareEquipmentLevel({
        apiKey: OPENAI_API_KEY,
        vehicle: comparisonVehicle,
        candidate,
        confirmedEquipment,
      });
    } catch (error) {
      console.error("Equipment level comparison failed:", error);
    }

    delete technicalParams.equipmentEvidence;
    if (equipmentEvidence.length > 0) {
      technicalParams.equipmentEvidence = equipmentEvidence;
    }

    if (extractedLevel) {
      technicalParams.equipmentLevel = extractedLevel;
      technicalParams.equipmentLevelSource = "cebia";
      technicalParams.equipmentLevelVerified = comparison?.verified === true;
      technicalParams.equipmentLevelConfidence = comparison?.confidence || 0.85;
    } else if (existingLevel) {
      technicalParams.equipmentLevel = existingLevel;
      technicalParams.equipmentLevelSource = "manual";
      technicalParams.equipmentLevelVerified = comparison?.verified === true;
      technicalParams.equipmentLevelConfidence = comparison?.confidence || 0;
    } else if (
      comparison?.equipmentLevel &&
      comparison.confidence >= 0.6 &&
      comparison.references.length > 0
    ) {
      technicalParams.equipmentLevel = comparison.equipmentLevel;
      technicalParams.equipmentLevelSource = "comparison";
      technicalParams.equipmentLevelVerified = false;
      technicalParams.equipmentLevelConfidence = comparison.confidence;
    }

    if (comparison?.references.length > 0) {
      technicalParams.equipmentLevelReferences = comparison.references;
    }

    const reportParts = [
      typeof parsed.report === "string"
        ? parsed.report
        : "Technické údaje a CEBIA historie byly zpracovány.",
    ];
    if (comparison?.evidenceSummary) {
      reportParts.push(`Ověření názvu výbavy: ${comparison.evidenceSummary}`);
    }

    return jsonResponse({
      technicalParams,
      cebiaHistory,
      equipment: confirmedEquipment,
      report: reportParts.filter(Boolean).join("\n\n"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

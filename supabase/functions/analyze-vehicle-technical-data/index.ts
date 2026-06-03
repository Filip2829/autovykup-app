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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: "Missing OPENAI_API_KEY" }, 500);
    }

    const { car, technicalCardPhotos = [], cebiaFiles = [] } =
      await req.json();

    const allFiles = [
      ...(technicalCardPhotos || []),
      ...(cebiaFiles || []),
    ].filter(Boolean);

    if (allFiles.length === 0) {
      return jsonResponse({ error: "No CEBIA or TP files provided" }, 400);
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
    "stkValidUntil": ""
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
- equipmentLevel = výbavový stupeň nebo kód výbavy, pokud je uveden
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
- Používej jen tyto názvy, pokud jsou v reportu jasně uvedené:
ABS, Adaptivní tempomat, Airbagy, Alarm, Android Auto, Apple CarPlay,
Asistent jízdy v pruzích, Automatická klimatizace, Bezklíčové odemykání,
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
- Nehádej.
- Report napiš česky a stručně uveď, co bylo doplněno a co je nutné ručně ověřit.

Aktuální karta vozu:
${JSON.stringify(car, null, 2)}
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

    return jsonResponse({
      technicalParams:
        parsed.technicalParams && typeof parsed.technicalParams === "object"
          ? parsed.technicalParams
          : {},
      cebiaHistory:
        parsed.cebiaHistory && typeof parsed.cebiaHistory === "object"
          ? parsed.cebiaHistory
          : {},
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
      report:
        typeof parsed.report === "string"
          ? parsed.report
          : "Technické údaje a CEBIA historie byly zpracovány.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

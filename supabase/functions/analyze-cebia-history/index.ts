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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse(
        {
          error: "Missing OPENAI_API_KEY",
        },
        500
      );
    }

    const { car, cebiaFiles = [] } = await req.json();

    if (!Array.isArray(cebiaFiles) || cebiaFiles.length === 0) {
      return jsonResponse(
        {
          error: "No CEBIA files provided",
        },
        400
      );
    }

    const imageFiles = cebiaFiles.filter((url) => isImageUrl(String(url)));
    const pdfFiles = cebiaFiles.filter((url) => !isImageUrl(String(url)));

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `
Jsi specialista na kontrolu historie vozidel podle CEBIA / CarVertical reportů.

Úkol:
Z dodaného CEBIA reportu vytěž informace pro výkup vozidla.

Vrať POUZE validní JSON bez markdownu:

{
  "technicalParams": {
    "brand": "",
    "model": "",
    "version": "",
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
    "productionYear": ""
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
  "report": ""
}

Pravidla:
- Aktuální km nevyplňuj.
- Emisní normu nevyplňuj.
- Pokud údaj není jasně uvedený, nech hodnotu prázdnou.
- Pokud najdeš škodu / pojistnou událost, popiš ji stručně.
- Pokud najdeš nesrovnalost v km, jasně ji označ.
- Report napiš česky a prakticky pro výkupčího.
- Nehádej.

Aktuální karta vozu:
${JSON.stringify(car, null, 2)}

CEBIA PDF soubory:
${JSON.stringify(pdfFiles, null, 2)}

Poznámka:
Pokud jsou CEBIA soubory PDF a nejde je přímo přečíst jako obrázek,
uveď v reportu, že je potřeba PDF zpracovat textově nebo převést na obrázky.
`,
      },
    ];

    for (const url of imageFiles) {
      content.push({
        type: "image_url",
        image_url: {
          url,
        },
      });
    }

    const openAiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Jsi přesný analytik CEBIA reportů pro výkup vozidel. Odpovídáš pouze validním JSON.",
            },
            {
              role: "user",
              content,
            },
          ],
          temperature: 0.1,
          response_format: {
            type: "json_object",
          },
        }),
      }
    );

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();

      return jsonResponse(
        {
          error: "OpenAI request failed",
          detail: errorText,
        },
        500
      );
    }

    const result = await openAiResponse.json();
    const text = result?.choices?.[0]?.message?.content || "{}";

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        technicalParams: {},
        cebiaHistory: {},
        report: text,
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
      report:
        typeof parsed.report === "string"
          ? parsed.report
          : "CEBIA report byl zpracován.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return jsonResponse(
      {
        error: message,
      },
      500
    );
  }
});
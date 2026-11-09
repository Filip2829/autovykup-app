const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const emptySummary = {
  customerSummary: "",
  equipmentSummary: "",
  suitableFor: "",
  conditionSummary: "",
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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSummary(value: Record<string, unknown> = {}) {
  return {
    customerSummary: getString(value.customerSummary),
    equipmentSummary: getString(value.equipmentSummary),
    suitableFor: getString(value.suitableFor),
    conditionSummary: getString(value.conditionSummary),
  };
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (!trimmed) return "{}";
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return "{}";

  return trimmed.slice(start, end + 1);
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

    const { vehicle } = await req.json();

    if (!vehicle || typeof vehicle !== "object") {
      return jsonResponse(
        {
          error: "Missing vehicle data",
        },
        400
      );
    }

    const prompt = `
Vytvoř stručné a věcné informace pro zákazníka k online inzerci ojetého vozu.

Vrať POUZE validní JSON bez markdownu:
{
  "customerSummary": "",
  "equipmentSummary": "",
  "suitableFor": "",
  "conditionSummary": ""
}

Pravidla:
- Piš česky, jednoduše, věcně a srozumitelně.
- Používej pouze údaje z dodaného objektu vehicle.
- Pokud údaj chybí, vynech ho.
- Nevymýšlej servis, historii, počet majitelů, nehavarovanost ani stav.
- Neuváděj kupní cenu, marži, interní náklady ani interní poznámky.
- Nepoužívej přehnané fráze jako perfektní, nejlepší volba, bezkonkurenční, bez investic.
- Neuváděj, že je vůz bez závad, bez nehod nebo nehavarovaný, pokud to není výslovně doložené.
- Pokud jsou uvedené vady, poškození nebo pojistné události, popiš je stručně a transparentně.
- Výbavu zkrať jen na důležité praktické prvky, nevypisuj celý seznam.
- Každé pole drž krátké, ideálně jeden odstavec.

Data vozidla určená pro zákaznický souhrn:
${JSON.stringify(vehicle, null, 2)}
`;

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
                "Jsi přesný asistent pro věcné zákaznické texty k online inzerci ojetých vozů. Odpovídáš pouze validním JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
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
    const text = result?.choices?.[0]?.message?.content || "";

    let parsed: Record<string, unknown> = {};

    try {
      parsed = JSON.parse(extractJsonObject(text));
    } catch {
      parsed = {};
    }

    return jsonResponse({
      summary: {
        ...emptySummary,
        ...normalizeSummary(parsed),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return jsonResponse(
      {
        error: message,
      },
      500
    );
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gpt-4.1-mini";
const MAX_PHOTOS = 6;
const MAX_IMAGE_LENGTH = 6_000_000;

const stringField = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"] },
    status: { type: "string", enum: ["confirmed", "estimated", "unreadable"] },
    evidence: { type: "string" },
  },
  required: ["value", "status", "evidence"],
};

const numberField = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["number", "null"] },
    status: { type: "string", enum: ["confirmed", "estimated", "unreadable"] },
    evidence: { type: "string" },
  },
  required: ["value", "status", "evidence"],
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: stringField,
        tireSize: stringField,
        treadDepthMm: numberField,
        dotCode: stringField,
        season: stringField,
        assemblyType: stringField,
        boltPattern: stringField,
        et: numberField,
        quantity: numberField,
      },
      required: [
        "name",
        "tireSize",
        "treadDepthMm",
        "dotCode",
        "season",
        "assemblyType",
        "boltPattern",
        "et",
        "quantity",
      ],
    },
    summary: { type: "string" },
    warnings: { type: "array", maxItems: 12, items: { type: "string" } },
  },
  required: ["fields", "summary", "warnings"],
};

const prompt = `
Analyzuj fotografie jedné sady pneumatik nebo kol pro skladovou evidenci autobazaru.

Zásadní pravidla:
- Nikdy si nevymýšlej údaj, který není na fotografii přímo čitelný nebo bezpečně viditelný.
- status "confirmed" použij jen pro údaj přímo čitelný nebo jednoznačně viditelný.
- status "estimated" je dovolen pouze u treadDepthMm, a to jen pokud fotografie obsahuje dostatečné měřítko, měrku nebo jinou použitelnou referenci. Jinak vrať null a "unreadable".
- U všech ostatních polí je při nejistotě value null a status "unreadable".
- Do evidence neodvozuj DOT, ET, rozteč ani rozměr z podobného výrobku nebo znalosti modelu.
- DOT vrať jen jako poslední čtyři číslice ve formátu TTYY a pouze pokud jsou jasně čitelné; týden musí být 01 až 53.
- season vrať pouze jako summer, winter nebo all_season, jen pokud je to doloženo čitelným označením nebo symbolem.
- assemblyType vrať pouze jako tires_only, steel_wheels nebo alloy_wheels, pokud je provedení na fotografiích jednoznačné.
- name má být čitelný výrobce a model pneumatiky, například "Continental WinterContact".
- tireSize zachovej v běžném formátu, například "205/55 R16".
- boltPattern vrať například "5x112" pouze pokud je čitelná nebo spolehlivě změřená; neodhaduj ji jen podle počtu děr.
- et vrať pouze z čitelného označení ET na disku.
- quantity vrať pouze pokud fotografie prokazatelně ukazují počet kusů v sadě.
- V evidence stručně česky napiš, co přesně je na fotografii vidět.
- Do warnings česky vypiš všechny důležité nečitelné nebo neověřitelné údaje a potřebu doplňující fotografie.
- Odpověz výhradně podle JSON schématu.
`.trim();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts: string[] = [];
  for (const item of (response.output as Array<Record<string, unknown>>) || []) {
    for (const content of (item.content as Array<Record<string, unknown>>) || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function validateImages(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PHOTOS) {
    throw new Error(`Nahrajte 1 až ${MAX_PHOTOS} fotografií.`);
  }
  return value.map((image) => {
    if (
      typeof image !== "string" ||
      image.length > MAX_IMAGE_LENGTH ||
      !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)
    ) {
      throw new Error("Jedna z fotografií má nepodporovaný formát nebo velikost.");
    }
    return image;
  });
}

async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!authorization || !supabaseUrl || !anonKey) return false;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: anonKey,
    },
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    if (!(await requireAuthenticatedUser(req))) {
      return jsonResponse({ error: "Pro AI rozpoznání se musíte přihlásit." }, 401);
    }
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "AI služba není nakonfigurovaná." }, 500);

    const body = await req.json();
    const images = validateImages(body?.images);
    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: prompt },
      ...images.map((imageUrl) => ({
        type: "input_image",
        image_url: imageUrl,
        detail: "high",
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "user", content }],
        temperature: 0.1,
        text: {
          format: {
            type: "json_schema",
            name: "tire_set_photo_analysis",
            strict: true,
            schema: outputSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenAI tire analysis failed", response.status, errorBody);
      return jsonResponse(
        { error: "AI analýza fotografií selhala.", detail: `OpenAI HTTP ${response.status}` },
        502
      );
    }

    const result = await response.json();
    const outputText = extractOutputText(result);
    if (!outputText) return jsonResponse({ error: "AI analýza nevrátila žádná data." }, 502);

    return jsonResponse({ output: JSON.parse(outputText) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznámá chyba AI analýzy.";
    console.error("analyze-tire-set-photos failed", message);
    return jsonResponse({ error: message }, 400);
  }
});

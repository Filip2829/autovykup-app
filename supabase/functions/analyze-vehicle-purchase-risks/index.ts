const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 25000;
const MAX_INPUT_LENGTH = 12000;
const MAX_RISKS = 8;

const allowedCategories = new Set([
  "engine",
  "emissions",
  "transmission",
  "drivetrain",
  "chassis",
  "body",
  "electronics",
  "cooling",
  "other",
]);
const allowedPriorities = new Set([
  "critical",
  "important",
  "recommended",
]);
const genericTitlePatterns = [
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola brzd/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola pneumatik/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola laku/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola sv[eě]tel/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola klimatizace/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola podvozku/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?kontrola interi[eé]ru/i,
  /^(obecn[aá] |b[eě][zž]n[aá] )?zku[sš]ebn[ií] j[ií]zda/i,
];

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    vehicleIdentification: {
      type: "object",
      additionalProperties: false,
      properties: {
        brand: { type: "string" },
        model: { type: "string" },
        generation: { type: "string" },
        engine: { type: "string" },
        transmission: { type: "string" },
        year: { type: "string" },
      },
      required: [
        "brand",
        "model",
        "generation",
        "engine",
        "transmission",
        "year",
      ],
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    confidenceReason: { type: "string" },
    risks: {
      type: "array",
      maxItems: MAX_RISKS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          category: {
            type: "string",
            enum: [
              "engine",
              "emissions",
              "transmission",
              "drivetrain",
              "chassis",
              "body",
              "electronics",
              "cooling",
              "other",
            ],
          },
          priority: {
            type: "string",
            enum: ["critical", "important", "recommended"],
          },
          title: { type: "string" },
          reason: { type: "string" },
          howToCheck: { type: "string" },
          specificity: { type: "string" },
        },
        required: [
          "id",
          "category",
          "priority",
          "title",
          "reason",
          "howToCheck",
          "specificity",
        ],
      },
    },
    disclaimer: { type: "string" },
  },
  required: [
    "vehicleIdentification",
    "confidence",
    "confidenceReason",
    "risks",
    "disclaimer",
  ],
};

const systemPrompt = `
Jsi technický specialista na ojetá vozidla pro interní podporu výkupčího.

Odpovídáš pouze na otázku: Jaké konkrétní známé technické a konstrukční záludnosti má přesná nebo nejbližší identifikovatelná varianta tohoto vozu a na co se při fyzické prohlídce zaměřit?

Pravidla:
- Piš česky, krátce a prakticky.
- Vrať nejvýše 8 bodů, ideálně 5 až 8 jen tehdy, když jsou skutečně specifické.
- Každý bod musí být odůvodněný modelem, generací, motorem, kódem motoru, převodovkou, pohonem nebo konkrétní konstrukcí.
- Nepřidávej obecnou kontrolu brzd, pneumatik, laku, světel, klimatizace, podvozku, interiéru ani obecnou zkušební jízdu.
- Neřeš doklady, historii, původ, vlastnictví, právní stav, ceny ani obchodní rozhodnutí.
- Nikdy netvrď, že konkrétní vůz závadu má. Používej formulace „ověřit“, „zaměřit se na“, „může upozornit“, „typické kontrolní místo“ a „pokud se projeví“.
- Neuváděj jisté ceny oprav ani diagnózu bez důkazu.
- Pokud nelze variantu dostatečně určit, nastav confidence na low, vysvětli omezení a vrať jen skutečně podložené body, případně prázdné pole risks.
- specificity stručně popisuje, která vlastnost vozu daný bod odůvodňuje.
- disclaimer vždy uvádí, že jde o doporučení k ověření, nikoli potvrzení závady.
- Vrať pouze JSON odpovídající zadanému schématu.
`.trim();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown, maxLength = 600) {
  return value !== null && value !== undefined
    ? String(value).trim().slice(0, maxLength)
    : "";
}

function normalize(value: unknown) {
  return text(value)
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as Record<string, unknown>).type === "output_text" &&
        typeof (part as Record<string, unknown>).text === "string"
      ) {
        parts.push((part as Record<string, unknown>).text as string);
      }
    }
  }
  return parts.join("\n").trim();
}

function validateRisk(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Neplatný bod rizika v AI odpovědi.");
  }
  const source = value as Record<string, unknown>;
  const risk = {
    id: text(source.id, 120),
    category: text(source.category, 30),
    priority: text(source.priority, 30),
    title: text(source.title, 180),
    reason: text(source.reason),
    howToCheck: text(source.howToCheck),
    specificity: text(source.specificity, 240),
  };
  if (
    !risk.id ||
    !allowedCategories.has(risk.category) ||
    !allowedPriorities.has(risk.priority) ||
    !risk.title ||
    !risk.reason ||
    !risk.howToCheck ||
    !risk.specificity
  ) {
    throw new Error("Neúplný nebo nepovolený bod rizika v AI odpovědi.");
  }
  if (genericTitlePatterns.some((pattern) => pattern.test(risk.title))) {
    throw new Error("AI odpověď obsahuje obecný kontrolní bod.");
  }
  return risk;
}

function validateOutput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI odpověď není objekt.");
  }
  const source = value as Record<string, unknown>;
  if (!["high", "medium", "low"].includes(String(source.confidence))) {
    throw new Error("AI odpověď obsahuje neplatnou úroveň jistoty.");
  }
  if (!Array.isArray(source.risks) || source.risks.length > MAX_RISKS) {
    throw new Error("AI odpověď obsahuje neplatný počet rizik.");
  }
  const identificationSource = source.vehicleIdentification;
  if (
    !identificationSource ||
    typeof identificationSource !== "object" ||
    Array.isArray(identificationSource)
  ) {
    throw new Error("AI odpověď neobsahuje identifikaci vozidla.");
  }
  const identification = identificationSource as Record<string, unknown>;
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const risks = source.risks.map(validateRisk).filter((risk) => {
    const id = normalize(risk.id);
    const title = normalize(risk.title);
    if (seenIds.has(id) || seenTitles.has(title)) return false;
    seenIds.add(id);
    seenTitles.add(title);
    return true;
  });
  const confidenceReason = text(source.confidenceReason, 500);
  const disclaimer = text(source.disclaimer, 500);
  if (!confidenceReason || !disclaimer) {
    throw new Error("AI odpověď neobsahuje vysvětlení jistoty nebo disclaimer.");
  }
  return {
    vehicleIdentification: {
      brand: text(identification.brand, 100),
      model: text(identification.model, 100),
      generation: text(identification.generation, 120),
      engine: text(identification.engine, 160),
      transmission: text(identification.transmission, 120),
      year: text(identification.year, 20),
    },
    confidence: String(source.confidence),
    confidenceReason,
    risks,
    disclaimer,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ code: "invalid-request", error: "Method not allowed" }, 405);
  }
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
    return jsonResponse(
      { code: "unauthorized", error: "Chybí přihlášení uživatele." },
      401
    );
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { code: "unavailable", error: "OPENAI_API_KEY není nakonfigurován." },
        503
      );
    }
    const body = await req.json();
    const vehicle = body?.vehicle;
    if (!vehicle || typeof vehicle !== "object") {
      return jsonResponse(
        { code: "invalid-request", error: "Chybí technický profil vozidla." },
        400
      );
    }
    const serializedVehicle = JSON.stringify(vehicle);
    if (serializedVehicle.length > MAX_INPUT_LENGTH) {
      return jsonResponse(
        { code: "invalid-request", error: "Technický profil vozidla je příliš rozsáhlý." },
        413
      );
    }
    if (!text(vehicle.identity?.brand) || !text(vehicle.identity?.model)) {
      return jsonResponse(
        { code: "invalid-request", error: "Značka a model jsou povinné." },
        400
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let openAiResponse: Response;
    try {
      openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          input: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analyzuj tuto sanitizovanou technickou variantu vozidla:\n${serializedVehicle}`,
            },
          ],
          max_output_tokens: 1800,
          temperature: 0.2,
          text: {
            format: {
              type: "json_schema",
              name: "vehicle_purchase_risks",
              description: "Specifická technická rizika varianty ojetého vozidla",
              strict: true,
              schema: outputSchema,
            },
          },
        }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return jsonResponse(
          { code: "timeout", error: "OpenAI analýza překročila časový limit." },
          504
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get("x-request-id") || "";
      return jsonResponse(
        {
          code: "unavailable",
          error: "OpenAI analýza selhala.",
          detail: requestId ? `Request ID: ${requestId}` : "Bez detailu požadavku.",
        },
        502
      );
    }

    const openAiResult = await openAiResponse.json();
    const outputText = extractOutputText(openAiResult);
    if (!outputText) {
      return jsonResponse(
        { code: "invalid-response", error: "OpenAI nevrátil strukturovaný výstup." },
        502
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return jsonResponse(
        { code: "invalid-response", error: "OpenAI vrátil neplatný JSON." },
        502
      );
    }

    try {
      return jsonResponse({ output: validateOutput(parsed) });
    } catch (error) {
      return jsonResponse(
        {
          code: "invalid-response",
          error: "OpenAI vrátil neplatný nebo nepovolený výstup.",
          detail: error instanceof Error ? error.message : "Neznámá chyba validace.",
        },
        502
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznámá chyba.";
    return jsonResponse(
      {
        code: "unavailable",
        error: "AI analýzu se nepodařilo dokončit.",
        detail: message,
      },
      500
    );
  }
});

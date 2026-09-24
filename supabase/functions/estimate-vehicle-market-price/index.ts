const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 40000;
const MAX_INPUT_LENGTH = 5000;
const MAX_COMPARABLES = 10;

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    querySummary: { type: "string" },
    comparables: {
      type: "array",
      maxItems: MAX_COMPARABLES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          price: { type: "number" },
          year: { type: "string" },
          mileage: { type: ["number", "null"] },
          matchReason: { type: "string" },
        },
        required: ["title", "url", "price", "year", "mileage", "matchReason"],
      },
    },
    warnings: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
  },
  required: ["querySummary", "comparables", "warnings"],
};

const systemPrompt = `
Jsi asistent autobazaru pro orientační tržní porovnání ojetých vozidel v České republice.

Použij webové vyhledávání výhradně na doméně sauto.cz a najdi nejvýše 10 aktuálních, co nejbližších nabídek k zadanému vozidlu.

Pravidla:
- Značka a model musí odpovídat. Upřednostni stejnou generaci, motor, palivo, převodovku, karoserii, výkon a podobný rok a nájezd.
- Neber cenu z agregovaného přehledu, pokud není možné přiřadit konkrétní URL inzerátu.
- Vyřaď duplicity, havarované vozy, náhradní díly, leasingové splátky vydávané za cenu, nové vozy a inzeráty bez jednoznačné celkové ceny.
- Cena musí být celková nabídková cena vozidla v Kč jako číslo.
- URL musí vést na konkrétní inzerát na sauto.cz, který byl skutečně nalezen webovým vyhledáváním.
- Nevymýšlej chybějící hodnoty ani URL. Pokud není dostatek nabídek, vrať jich méně a vysvětli omezení ve warnings.
- Seřaď výsledky od nejbližší shody k méně přesné, nikoli podle ceny.
- Neurčuj medián, prodejní ani výkupní cenu. Ty vypočítá aplikace deterministicky.
- Vrať pouze JSON podle zadaného schématu.
`.trim();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown, maxLength = 500) {
  return value !== null && value !== undefined
    ? String(value).trim().slice(0, maxLength)
    : "";
}

function getOpenAiErrorMessage(errorBody: string) {
  try {
    const parsed = JSON.parse(errorBody);
    return text(parsed?.error?.message, 500);
  } catch {
    return "";
  }
}

function isSautoUrl(value: unknown) {
  try {
    const url = new URL(text(value, 600));
    return (
      url.protocol === "https:" &&
      (url.hostname === "sauto.cz" || url.hostname.endsWith(".sauto.cz"))
    );
  } catch {
    return false;
  }
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

function validateOutput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI odpověď není platný objekt.");
  }
  const source = value as Record<string, unknown>;
  const seenUrls = new Set<string>();
  const comparables = (Array.isArray(source.comparables) ? source.comparables : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const comparable = item as Record<string, unknown>;
      const price = Number(comparable.price);
      const mileage = comparable.mileage === null ? null : Number(comparable.mileage);
      return {
        title: text(comparable.title, 180),
        url: text(comparable.url, 600),
        price,
        year: text(comparable.year, 20),
        mileage: Number.isFinite(mileage) && mileage > 0 ? mileage : null,
        matchReason: text(comparable.matchReason, 300),
      };
    })
    .filter((item) => {
      if (
        !item.title ||
        !isSautoUrl(item.url) ||
        !Number.isFinite(item.price) ||
        item.price <= 0 ||
        seenUrls.has(item.url)
      ) {
        return false;
      }
      seenUrls.add(item.url);
      return true;
    })
    .slice(0, MAX_COMPARABLES);

  return {
    querySummary: text(source.querySummary, 500),
    comparables,
    warnings: (Array.isArray(source.warnings) ? source.warnings : [])
      .map((warning) => text(warning, 300))
      .filter(Boolean)
      .slice(0, 5),
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
    if (!text(vehicle.brand, 100) || !text(vehicle.model, 100)) {
      return jsonResponse(
        { code: "invalid-request", error: "Značka a model jsou povinné." },
        400
      );
    }
    if (!text(vehicle.year, 20) && !text(vehicle.firstRegistration, 30)) {
      return jsonResponse(
        { code: "invalid-request", error: "Rok nebo první registrace jsou povinné." },
        400
      );
    }

    const serializedVehicle = JSON.stringify(vehicle);
    if (serializedVehicle.length > MAX_INPUT_LENGTH) {
      return jsonResponse(
        { code: "invalid-request", error: "Profil vozidla je příliš rozsáhlý." },
        413
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
              content: `Vyhledej pomocí dotazu site:sauto.cz porovnatelné aktivní nabídky pro toto vozidlo:\n${serializedVehicle}`,
            },
          ],
          tools: [
            {
              type: "web_search",
              search_context_size: "high",
            },
          ],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
          max_output_tokens: 3000,
          text: {
            format: {
              type: "json_schema",
              name: "vehicle_market_comparables",
              description: "Porovnatelné aktivní nabídky ojetého vozidla na Sauto",
              strict: true,
              schema: outputSchema,
            },
          },
        }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return jsonResponse(
          { code: "timeout", error: "Vyhledání nabídek překročilo časový limit." },
          504
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!openAiResponse.ok) {
      const errorBody = await openAiResponse.text();
      const requestId = openAiResponse.headers.get("x-request-id") || "";
      const openAiError = getOpenAiErrorMessage(errorBody);
      console.error("OpenAI price recommendation failed", {
        status: openAiResponse.status,
        requestId,
        body: errorBody.slice(0, 1000),
      });
      return jsonResponse(
        {
          code: "unavailable",
          error: "Vyhledání porovnatelných nabídek selhalo.",
          detail:
            openAiError ||
            (requestId
              ? `Technický identifikátor požadavku: ${requestId}`
              : "OpenAI služba nevrátila podrobnosti chyby."),
        },
        502
      );
    }

    const openAiResult = await openAiResponse.json();
    const outputText = extractOutputText(openAiResult);
    if (!outputText) {
      return jsonResponse(
        { code: "invalid-response", error: "AI nevrátila strukturovaný výsledek." },
        502
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return jsonResponse(
        { code: "invalid-response", error: "Výsledek nacenění není platný JSON." },
        502
      );
    }

    return jsonResponse({ output: validateOutput(parsed) });
  } catch (error) {
    console.error("estimate-vehicle-market-price failed", error);
    return jsonResponse(
      {
        code: "unavailable",
        error: "Nacenění se nepodařilo dokončit.",
        detail: error instanceof Error ? error.message : "Neznámá chyba.",
      },
      500
    );
  }
});

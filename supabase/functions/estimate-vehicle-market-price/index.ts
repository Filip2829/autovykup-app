const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gpt-4.1-mini";
const TIMEOUT_MS = 60000;
const MAX_INPUT_LENGTH = 7000;
const MAX_PER_MARKET = 14;

const comparableProperties = {
  title: { type: "string" },
  url: { type: "string" },
  price: { type: "number" },
  year: { type: ["string", "null"] },
  mileage: { type: ["number", "null"] },
  variant: { type: ["string", "null"] },
  fuel: { type: ["string", "null"] },
  transmission: { type: ["string", "null"] },
  powerKw: { type: ["number", "null"] },
  bodyType: { type: ["string", "null"] },
  seats: { type: ["number", "null"] },
  equipmentLevel: { type: ["string", "null"] },
  sellerType: { type: ["string", "null"] },
  vatDeductible: { type: ["boolean", "null"] },
  listingDate: { type: ["string", "null"] },
  active: { type: "boolean" },
  matchReason: { type: "string" },
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    querySummary: { type: "string" },
    comparables: {
      type: "array",
      maxItems: MAX_PER_MARKET,
      items: {
        type: "object",
        additionalProperties: false,
        properties: comparableProperties,
        required: Object.keys(comparableProperties),
      },
    },
    warnings: { type: "array", maxItems: 5, items: { type: "string" } },
  },
  required: ["querySummary", "comparables", "warnings"],
};

const systemPrompt = `
Jsi analytik českého trhu ojetých vozidel. Tvým jediným úkolem je dohledat skutečné, aktuální a přímo otevřitelné inzeráty pro zadané vozidlo. Cenu neurčuješ; vracíš ověřená vstupní data pro následný deterministický výpočet.

Zásady:
- Hledej pouze na určené doméně a vrať odkaz na detail konkrétního inzerátu, nikdy stránku výsledků.
- Projdi více stránek výsledků a každý konkrétní inzerát vrať právě jednou. Nikdy neopakuj stejnou URL ani stejný vůz.
- Ověř, že inzerát je stále aktivní. Neaktivní výsledek označ active=false.
- Značka, model a zásadní modelová varianta musí odpovídat. Grand Scénic není Scénic. Osobní a užitkové provedení nerozmělňuj bez upozornění.
- Preferuj stejné palivo, převodovku, motor, výkon, karoserii, generaci a výbavový stupeň.
- U dodávek a MPV vždy ověř počet sedadel; nákladní skříň, kombi a vícemístné provedení nejsou zaměnitelné.
- Když je přesných shod málo, vrať i nejbližší aktivní nabídky stejného modelu a paliva; rozdíl přesně popiš v matchReason. Nikdy kvůli počtu neměň model ani osobní/užitkové určení.
- Začni rokem ±1 a nájezdem ±30 000 km; při malém vzorku lze postupně rozšířit až na rok ±3 a nájezd ±150 000 km.
- Vyřaď nové vozy, havarované vozy, náhradní díly, aukce, leasingovou splátku místo celkové ceny a inzeráty bez jasné celkové ceny v Kč.
- price je celková inzerovaná cena v Kč. Uveď, zda je možný odpočet DPH, ale cenu kvůli tomu sám nepřepočítávej.
- Zkopíruj jen skutečně uvedené údaje. Neznámé hodnoty vrať jako null.
- matchReason stručně vysvětluje shody i rozdíly vůči cílovému vozu.
- Nevymýšlej URL ani technická data.
`.trim();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown, maxLength = 600) {
  return value === null || value === undefined ? "" : String(value).trim().slice(0, maxLength);
}

function outputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts: string[] = [];
  for (const item of Array.isArray(response.output) ? response.output : []) {
    if (!item || typeof item !== "object") continue;
    for (const part of Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[] : []) {
      if (part && typeof part === "object" &&
          (part as Record<string, unknown>).type === "output_text" &&
          typeof (part as Record<string, unknown>).text === "string") {
        parts.push((part as Record<string, unknown>).text as string);
      }
    }
  }
  return parts.join("\n").trim();
}

function validDomain(value: unknown, domain: string) {
  try {
    const host = new URL(text(value)).hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch { return false; }
}

function validDetailUrl(value: unknown, domain: string) {
  try {
    const url = new URL(text(value));
    if (!validDomain(url.href, domain)) return false;
    if (domain === "sauto.cz") return /^\/(osobni|uzitkova)\/detail\//.test(url.pathname);
    if (domain === "tipcars.com") return url.pathname.endsWith(".html");
  } catch { return false; }
  return false;
}

function canonicalUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    url.hash = "";
    url.search = "";
    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  } catch { return ""; }
}

function webSearchSourceUrls(response: Record<string, unknown>) {
  const urls = new Set<string>();
  for (const item of Array.isArray(response.output) ? response.output : []) {
    if (!item || typeof item !== "object") continue;
    const action = (item as Record<string, unknown>).action;
    if (!action || typeof action !== "object") continue;
    for (const source of Array.isArray((action as Record<string, unknown>).sources)
      ? (action as Record<string, unknown>).sources as unknown[] : []) {
      if (!source || typeof source !== "object") continue;
      const canonical = canonicalUrl((source as Record<string, unknown>).url);
      if (canonical) urls.add(canonical);
    }
  }
  return urls;
}

function normalizeResult(value: unknown, domain: string, sourceUrls: Set<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Vyhledávač nevrátil platný objekt.");
  }
  const result = value as Record<string, unknown>;
  const comparables = (Array.isArray(result.comparables) ? result.comparables : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>)
    .filter((item) => validDetailUrl(item.url, domain) && sourceUrls.has(canonicalUrl(item.url)) && Number(item.price) > 0 && item.active !== false)
    .slice(0, MAX_PER_MARKET);
  return {
    querySummary: text(result.querySummary),
    comparables,
    warnings: (Array.isArray(result.warnings) ? result.warnings : []).map((item) => text(item, 300)).filter(Boolean),
  };
}

async function searchMarketplace({
  apiKey, domain, label, vehicle, signal,
}: {
  apiKey: string;
  domain: string;
  label: string;
  vehicle: Record<string, unknown>;
  signal: AbortSignal;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Prohledej výhradně site:${domain} a najdi až ${MAX_PER_MARKET} aktivních nabídek co nejbližších tomuto vozu. Tržiště: ${label}.\n${JSON.stringify(vehicle)}`,
        },
      ],
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 5200,
      text: {
        format: {
          type: "json_schema",
          name: `vehicle_market_${label.toLowerCase()}`,
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") || "";
    console.error(`${label} search failed`, { status: response.status, requestId });
    throw new Error(`${label} nevrátilo použitelné výsledky.`);
  }
  const responseBody = await response.json() as Record<string, unknown>;
  const parsed = JSON.parse(outputText(responseBody) || "{}");
  return normalizeResult(parsed, domain, webSearchSourceUrls(responseBody));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ code: "invalid-request", error: "Method not allowed" }, 405);
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return jsonResponse({ code: "unauthorized", error: "Chybí přihlášení uživatele." }, 401);
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return jsonResponse({ code: "unavailable", error: "OPENAI_API_KEY není nakonfigurován." }, 503);
    const body = await request.json();
    const vehicle = body?.vehicle;
    if (!vehicle || typeof vehicle !== "object" || Array.isArray(vehicle)) {
      return jsonResponse({ code: "invalid-request", error: "Chybí technický profil vozidla." }, 400);
    }
    if (!text(vehicle.brand, 100) || !text(vehicle.model, 100)) {
      return jsonResponse({ code: "invalid-request", error: "Značka a model jsou povinné." }, 400);
    }
    if (!text(vehicle.year, 20) && !text(vehicle.firstRegistration, 30)) {
      return jsonResponse({ code: "invalid-request", error: "Rok nebo první registrace jsou povinné." }, 400);
    }
    if (JSON.stringify(vehicle).length > MAX_INPUT_LENGTH) {
      return jsonResponse({ code: "invalid-request", error: "Profil vozidla je příliš rozsáhlý." }, 413);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let settled;
    try {
      settled = await Promise.allSettled([
        searchMarketplace({ apiKey, domain: "sauto.cz", label: "Sauto", vehicle, signal: controller.signal }),
        searchMarketplace({ apiKey, domain: "tipcars.com", label: "TipCars", vehicle, signal: controller.signal }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    const successful = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
    if (!successful.length) {
      return jsonResponse({ code: "unavailable", error: "Vyhledání na Sauto i TipCars selhalo." }, 502);
    }
    const failedLabels = settled.flatMap((item, index) => item.status === "rejected" ? [index === 0 ? "Sauto" : "TipCars"] : []);
    return jsonResponse({
      output: {
        querySummary: successful.map((item) => item.querySummary).filter(Boolean).join(" | "),
        comparables: successful.flatMap((item) => item.comparables),
        warnings: [
          ...successful.flatMap((item) => item.warnings),
          ...(failedLabels.length ? [`Bez výsledků z: ${failedLabels.join(", ")}.`] : []),
        ],
      },
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "AbortError";
    console.error("estimate-vehicle-market-price failed", error);
    return jsonResponse({
      code: timeout ? "timeout" : "unavailable",
      error: timeout ? "Vyhledání nabídek překročilo časový limit." : "Nacenění se nepodařilo dokončit.",
      detail: error instanceof Error ? error.message : "Neznámá chyba.",
    }, timeout ? 504 : 500);
  }
});

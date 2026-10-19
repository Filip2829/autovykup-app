import { mapVehicleRegistryData } from "../_shared/vehicleRegistryData.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const registryEndpoint =
  "https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function apiErrorMessage(status: number) {
  if (status === 404) return "V registru nebylo pro zadaný VIN nalezeno vozidlo.";
  if (status === 429) return "Registr je dočasně vytížený. Zkuste to prosím později.";
  return "Registr vozidel nyní neodpověděl správně.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Povolená je pouze metoda POST." }, 405);
  }

  try {
    const body = await request.json();
    const vin = String(body?.vin || "").trim().toUpperCase();

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return jsonResponse(
        { error: "VIN musí obsahovat přesně 17 platných znaků." },
        400
      );
    }

    const apiKey = Deno.env.get("DATAOVOZIDLECH_API_KEY");
    if (!apiKey) {
      console.error("DATAOVOZIDLECH_API_KEY is not configured.");
      return jsonResponse({ error: "Služba registru není nakonfigurovaná." }, 503);
    }

    const url = new URL(registryEndpoint);
    url.searchParams.set("vin", vin);

    const response = await fetch(url, {
      headers: { API_KEY: apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      console.error(`Vehicle registry returned HTTP ${response.status}.`);
      return jsonResponse({ error: apiErrorMessage(response.status) }, response.status);
    }

    const payload = await response.json();
    if (Number(payload?.Status) !== 1 || !payload?.Data) {
      console.error("Vehicle registry returned an unsuccessful payload.");
      return jsonResponse(
        { error: "Registr pro zadaný VIN nevrátil dostupná data." },
        404
      );
    }

    return jsonResponse(mapVehicleRegistryData(payload.Data));
  } catch (error) {
    console.error("Vehicle registry lookup failed:", error);
    return jsonResponse(
      { error: "Při načítání údajů z registru došlo k chybě." },
      500
    );
  }
});

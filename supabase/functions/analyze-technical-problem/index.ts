const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { car, problem } = await req.json();

    if (!problem) {
      return new Response(
        JSON.stringify({
          error: "Missing problem text",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const prompt = `
Jsi zkušený automobilový diagnostik a technický poradce autobazaru.

Vozidlo:
${JSON.stringify(car, null, 2)}

Popsaný problém:
${problem}

Vyhodnoť:
1. Pravděpodobné příčiny závady
2. Jak závadu ověřit
3. Odhad ceny opravy v Kč
4. Riziko pro výkup vozidla
5. Doporučení pro výkupčího

Piš česky, stručně, prakticky a ve strukturovaných bodech.
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
                "Jsi zkušený automobilový technik, diagnostik a poradce autobazaru.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.4,
        }),
      }
    );

    const result = await openAiResponse.json();

    if (!openAiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: result?.error?.message || "OpenAI request failed",
        }),
        {
          status: openAiResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const report =
      result?.choices?.[0]?.message?.content ||
      "Nepodařilo se vytvořit analýzu.";

    return new Response(
      JSON.stringify({
        report,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
  }
});
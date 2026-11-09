import { createClient } from "npm:@supabase/supabase-js@2.106.1";
import { drainVehicleFiles } from "./cleanup.js";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return reply({ error: "Unauthorized" }, 401);
  // No bucket/path from the caller is accepted. Only files queued by the
  // database during a successful authorized vehicle deletion may be removed.
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    return reply(await drainVehicleFiles(db));
  } catch {
    return reply({ error: "Odstranění souborů se nepodařilo. Úloha zůstává ve frontě pro opakování." }, 500);
  }
});

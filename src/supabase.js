import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mncpsdrckkgkujatvlwb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uY3BzZHJja2tna3VqYXR2bHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDY0MjksImV4cCI6MjA5NTIyMjQyOX0.RoduyrhLL8pank1gzKaona6ttQ7pLfCmwAYiJuKzGPk";

const runtimeEnv = import.meta.env || {};
const configuredUrl = runtimeEnv.VITE_SUPABASE_URL;
const configuredKey = runtimeEnv.VITE_SUPABASE_ANON_KEY;
if (Boolean(configuredUrl) !== Boolean(configuredKey)) {
  throw new Error('Nastavte společně VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY.');
}
if (!['production','valuation-test'].includes(runtimeEnv.MODE) && configuredUrl?.includes('mncpsdrckkgkujatvlwb')) {
  throw new Error('Testovací režim nesmí používat produkční Supabase.');
}
export const supabase = createClient(
  configuredUrl || (runtimeEnv.MODE === 'production' ? supabaseUrl : 'http://127.0.0.1:54321'),
  configuredKey || (runtimeEnv.MODE === 'production' ? supabaseAnonKey : 'local-test-not-configured'),
  runtimeEnv.MODE === 'valuation-test' ? {auth:{storageKey:'autovykup-valuation-test-auth'}} : {},
);

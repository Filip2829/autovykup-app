import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mncpsdrckkgkujatvlwb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uY3BzZHJja2tna3VqYXR2bHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDY0MjksImV4cCI6MjA5NTIyMjQyOX0.RoduyrhLL8pank1gzKaona6ttQ7pLfCmwAYiJuKzGPk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

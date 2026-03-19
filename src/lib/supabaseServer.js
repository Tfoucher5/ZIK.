import { createClient } from "@supabase/supabase-js";

export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  console.log("Envoi de mail déclenché");

  if (!url || !key) {
    throw new Error("Supabase env vars missing");
  }

  return createClient(url, key);
}

import "dotenv/config";

/** @type {import('./$types').PageServerLoad} */
export function load() {
  return {
    env: {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    },
  };
}

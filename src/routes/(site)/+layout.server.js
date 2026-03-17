import 'dotenv/config';

/** @type {import('./$types').LayoutServerLoad} */
export function load() {
  return {
    env: {
      supabaseUrl:     process.env.SUPABASE_URL     || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    },
  };
}

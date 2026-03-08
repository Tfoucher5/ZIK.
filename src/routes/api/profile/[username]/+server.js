import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/config.js';

export async function GET({ params }) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('username', params.username).single();
  if (error) return json({ error: 'Profil introuvable' }, { status: 404 });
  return json(data);
}

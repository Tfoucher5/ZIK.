import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/config.js';
import { verifyToken } from '$lib/server/middleware/auth.js';

export async function GET({ params, request }) {
  // Auth required to view any profile
  const token = request.headers.get('authorization')?.slice(7);
  if (!token) return json({ error: 'Connexion requise pour voir un profil' }, { status: 401 });
  const viewer = await verifyToken(token);
  if (!viewer) return json({ error: 'Session invalide' }, { status: 401 });

  const { data, error } = await supabase
    .from('profiles').select('*').eq('username', params.username).single();
  if (error || !data) return json({ error: 'Profil introuvable' }, { status: 404 });

  // If profile is private and viewer is not the owner, return limited info
  if (data.is_private && data.id !== viewer.id) {
    return json({
      id: data.id,
      username: data.username,
      avatar_url: data.avatar_url,
      is_private: true
    });
  }

  return json(data);
}

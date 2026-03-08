import { json } from '@sveltejs/kit';
import { requireAuth, userClient } from '$lib/server/middleware/auth.js';

export async function GET({ request }) {
  const { user, token } = await requireAuth(request);
  const { data, error } = await userClient(token)
    .from('rooms')
    .select('id, code, name, emoji, description, is_public, max_rounds, round_duration, break_duration, last_active_at, playlist_id')
    .eq('owner_id', user.id)
    .order('last_active_at', { ascending: false });
  if (error) return json({ error: error.message }, { status: 400 });
  return json(data);
}

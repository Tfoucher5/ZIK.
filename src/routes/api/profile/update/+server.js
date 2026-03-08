import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/config.js';

export async function POST({ request }) {
  const { userId, username, avatar_url } = await request.json();
  if (!userId) return json({ error: 'userId requis' }, { status: 400 });

  const updates = {};
  if (username !== undefined) {
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return json({ error: 'Pseudo invalide' }, { status: 400 });
    updates.username = username.trim();
  }
  if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
  if (!Object.keys(updates).length) return json({ error: 'Rien \u00e0 mettre \u00e0 jour' }, { status: 400 });

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) return json({ error: error.message }, { status: 400 });
  return json({ ok: true });
}

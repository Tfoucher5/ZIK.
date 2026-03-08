import { json } from '@sveltejs/kit';
import { verifyToken, userClient } from '$lib/server/middleware/auth.js';

export async function POST({ request }) {
  const token = request.headers.get('authorization')?.slice(7);
  if (!token) return json({ error: 'Non authentifi\u00e9' }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: 'Session invalide' }, { status: 401 });

  const { username, avatar_url } = await request.json();
  const updates = {};
  if (username !== undefined) {
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return json({ error: 'Pseudo invalide' }, { status: 400 });
    updates.username = username.trim();
  }
  if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
  if (!Object.keys(updates).length) return json({ error: 'Rien à mettre à jour' }, { status: 400 });

  const { error } = await userClient(token).from('profiles').update(updates).eq('id', user.id);
  if (error) return json({ error: error.message }, { status: 400 });
  return json({ ok: true });
}

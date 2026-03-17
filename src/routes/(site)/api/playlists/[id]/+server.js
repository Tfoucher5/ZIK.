import { json } from '@sveltejs/kit';
import { verifyToken, userClient } from '$lib/server/middleware/auth.js';

export async function DELETE({ params, request }) {
  const token = request.headers.get('authorization')?.slice(7);
  if (!token) return json({ error: 'Non authentifi\u00e9' }, { status: 401 });
  const user = await verifyToken(token);
  if (!user) return json({ error: 'Session invalide' }, { status: 401 });

  const plId  = params.id;
  const uSupa = userClient(token);

  const { data: pl, error: plErr } = await uSupa
    .from('custom_playlists').select('owner_id').eq('id', plId).single();
  if (plErr || !pl) return json({ error: 'Playlist introuvable' }, { status: 404 });
  if (pl.owner_id !== user.id) return json({ error: 'Non autoris\u00e9' }, { status: 403 });

  await uSupa.from('custom_playlist_tracks').delete().eq('playlist_id', plId);
  const { error } = await uSupa.from('custom_playlists').delete().eq('id', plId);
  if (error) return json({ error: error.message }, { status: 400 });
  return json({ ok: true });
}

import { error } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/middleware/auth.js';
import { getAdminClient } from '$lib/server/config.js';
import { enrichTrack } from '$lib/server/services/trackEnricher.js';

export async function POST({ params, request }) {
  const token = request.headers.get('authorization')?.slice(7);
  if (!token) throw error(401, 'Token manquant');

  const user = await verifyToken(token);
  if (!user) throw error(401, 'Token invalide');

  const sb = getAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'super_admin') throw error(403, 'Accès refusé');

  const { data: tracks } = await sb
    .from('custom_playlist_tracks')
    .select('id, artist, title, custom_artist, custom_title, custom_feats, cover_url, preview_url')
    .eq('playlist_id', params.id)
    .order('position');

  const allTracks = tracks || [];
  const total = allTracks.length;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

      for (let i = 0; i < total; i++) {
        const track = allTracks[i];
        const label = `${track.custom_artist || track.artist} — ${track.custom_title || track.title}`;
        try {
          const { updates, changes } = await enrichTrack(track);
          if (Object.keys(updates).length > 0) {
            await sb.from('custom_playlist_tracks').update(updates).eq('id', track.id);
          }
          send({
            current: i + 1,
            total,
            track: label,
            status: changes.length > 0 ? 'enriched' : 'unchanged',
            changes,
          });
        } catch {
          send({ current: i + 1, total, track: label, status: 'error', changes: [] });
        }
      }
      send({ current: total, total, status: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

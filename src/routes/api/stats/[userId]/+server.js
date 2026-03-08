import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/config.js';

export async function GET({ params }) {
  try {
    const [roomsRes, playersRes] = await Promise.all([
      supabase.from('rooms').select('code, name, emoji').eq('is_official', true),
      supabase.from('game_players')
        .select('score, games!inner(room_id, ended_at)')
        .eq('user_id', params.userId)
        .eq('is_guest', false)
        .not('games.ended_at', 'is', null)
        .order('score', { ascending: false }),
    ]);

    const officialRooms = roomsRes.data || [];
    const officialCodes = new Set(officialRooms.map(r => r.code));
    const roomInfo = {};
    officialRooms.forEach(r => { roomInfo[r.code] = r; });

    if (playersRes.error) return json({ error: playersRes.error.message }, { status: 500 });

    const bestByRoom = {};
    (playersRes.data || []).forEach(row => {
      const roomId = row.games?.room_id;
      if (!roomId || !officialCodes.has(roomId)) return;
      if (!bestByRoom[roomId] || row.score > bestByRoom[roomId]) bestByRoom[roomId] = row.score;
    });
    return json({ bestByRoom, roomInfo });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/config.js';

export async function GET({ params, url }) {
  try {
    const elo = parseInt(url.searchParams.get('elo') || '0');

    const [roomsRes, playersRes, aboveRes, totalRes] = await Promise.all([
      supabase.from('rooms').select('code, name, emoji, is_official, is_public'),
      supabase
        .from('game_players')
        .select('score, rank, games!inner(room_id, ended_at)')
        .eq('user_id', params.userId)
        .eq('is_guest', false)
        .not('games.ended_at', 'is', null),
      elo > 0
        ? supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('elo', elo)
        : Promise.resolve({ count: 0 }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    if (playersRes.error) return json({ error: playersRes.error.message }, { status: 500 });

    const roomMap = {};
    (roomsRes.data || []).forEach(r => { roomMap[r.code] = r; });

    const rows = playersRes.data || [];

    // Trier par date décroissante
    rows.sort((a, b) => new Date(b.games.ended_at) - new Date(a.games.ended_at));

    // Best scores par room officielle
    const bestByRoom = {};
    const officialRoomInfo = {};
    rows.forEach(row => {
      const roomId = row.games?.room_id;
      const room = roomMap[roomId];
      if (!room?.is_official) return;
      if (!bestByRoom[roomId] || row.score > bestByRoom[roomId]) bestByRoom[roomId] = row.score;
      officialRoomInfo[roomId] = room;
    });

    // Répartition par type de room
    const scoreByRoomType = {
      official: { count: 0, totalScore: 0 },
      public:   { count: 0, totalScore: 0 },
      private:  { count: 0, totalScore: 0 },
    };
    rows.forEach(row => {
      const room = roomMap[row.games?.room_id];
      const type = room?.is_official ? 'official' : room?.is_public ? 'public' : 'private';
      scoreByRoomType[type].count++;
      scoreByRoomType[type].totalScore += row.score;
    });

    // Win rate
    const wins = rows.filter(r => r.rank === 1).length;

    // Best / worst score
    const scores = rows.map(r => r.score);
    const bestScore  = scores.length ? Math.max(...scores) : 0;
    const worstScore = scores.length ? Math.min(...scores) : 0;
    const bestRank   = rows.length ? Math.min(...rows.map(r => r.rank ?? 999)) : null;

    // 10 parties les plus récentes pour la courbe + historique
    const recentGames = rows.slice(0, 10).map(row => {
      const room = roomMap[row.games?.room_id];
      return {
        score:     row.score,
        rank:      row.rank,
        endedAt:   row.games.ended_at,
        roomName:  room?.name  ?? 'Room custom',
        roomEmoji: room?.emoji ?? '🎮',
      };
    });

    // Parties ce mois-ci
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const gamesThisMonth = rows.filter(r =>
      new Date(r.games.ended_at) >= startOfMonth
    ).length;

    // Top % classement
    const aboveCount = aboveRes.count ?? 0;
    const totalCount = totalRes.count ?? 1;
    const topPercent = Math.max(1, Math.ceil((aboveCount / totalCount) * 100));

    return json({
      bestByRoom,
      roomInfo: officialRoomInfo,
      recentGames,
      scoreByRoomType,
      winRate:  { wins, total: rows.length },
      bestScore,
      worstScore,
      bestRank,
      gamesThisMonth,
      topPercent,
    });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

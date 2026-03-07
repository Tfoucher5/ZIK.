'use strict';

const express  = require('express');
const router   = express.Router();

const { supabase }                    = require('../config');
const { roomGames }                   = require('../state');
const { verifyToken, rateLimit, requireAuth, userClient } = require('../middleware/auth');
const { getSpotifyToken, normalizeSpotifyItem } = require('../services/spotify');
const { getFetch }                    = require('../services/fetch');
const { playlistCache }               = require('../state');

// ─── Caches ───────────────────────────────────────────────────────────────────
function makeCache(ttlMs) {
  let _data = null, _exp = 0;
  return {
    get()   { return _exp > Date.now() ? _data : null; },
    set(v)  { _data = v; _exp = Date.now() + ttlMs; },
  };
}
const _officialRoomsCache = makeCache(30_000);
const _lbWeeklyCache      = makeCache(60_000);
const _lbEloCache         = makeCache(60_000);

// ─── Official rooms ───────────────────────────────────────────────────────────
router.get('/rooms/official', async (req, res) => {
  try {
    let base = _officialRoomsCache.get();
    if (!base) {
      const { data, error } = await supabase
        .from('rooms')
        .select('code, name, emoji, description, is_official')
        .eq('is_official', true)
        .order('created_at');
      if (error) throw error;
      base = (data || []).map(r => ({
        id:          r.code,
        name:        r.name,
        emoji:       r.emoji,
        description: r.description || '',
        color:       'var(--accent)',
        gradient:    'linear-gradient(135deg,rgba(62,207,255,.12),transparent)',
      }));
      _officialRoomsCache.set(base);
    }
    // Online count always recalculated (live state)
    const result = base.map(r => ({
      ...r,
      online: Object.values(roomGames)
        .filter(g => g.roomId === r.id)
        .reduce((acc, g) => acc + Object.values(g.players).filter(p => !p._dcTimer).length, 0),
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Leaderboards ─────────────────────────────────────────────────────────────
router.get('/leaderboard/weekly', async (req, res) => {
  const cached = _lbWeeklyCache.get();
  if (cached) return res.json(cached);
  const { data, error } = await supabase.rpc('weekly_leaderboard');
  if (error) return res.status(500).json({ error: error.message });
  _lbWeeklyCache.set(data);
  res.json(data);
});

router.get('/leaderboard/weekly/room/:code', async (req, res) => {
  const { data, error } = await supabase.rpc('weekly_leaderboard_by_room', { p_room_code: req.params.code });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.get('/leaderboard/elo', async (req, res) => {
  const cached = _lbEloCache.get();
  if (cached) return res.json(cached);
  const { data, error } = await supabase
    .from('profiles')
    .select('username, avatar_url, elo, level, games_played')
    .order('elo', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  _lbEloCache.set(data);
  res.json(data);
});

// ─── User profile ─────────────────────────────────────────────────────────────
router.get('/profile/:username', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', req.params.username)
    .single();
  if (error) return res.status(404).json({ error: 'Profil introuvable' });
  res.json(data);
});

router.post('/profile/update', async (req, res) => {
  const { userId, username, avatar_url } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requis' });
  const updates = {};
  if (username !== undefined) {
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return res.status(400).json({ error: 'Pseudo invalide' });
    updates.username = username.trim();
  }
  if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Rien a mettre a jour' });
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ─── User stats ───────────────────────────────────────────────────────────────
router.get('/stats/:userId', async (req, res) => {
  try {
    const [roomsRes, playersRes] = await Promise.all([
      supabase.from('rooms').select('code, name, emoji').eq('is_official', true),
      supabase.from('game_players')
        .select('score, games!inner(room_id, ended_at)')
        .eq('user_id', req.params.userId)
        .eq('is_guest', false)
        .not('games.ended_at', 'is', null)
        .order('score', { ascending: false }),
    ]);

    const officialRooms = roomsRes.data || [];
    const officialCodes = new Set(officialRooms.map(r => r.code));
    const roomInfo = {};
    officialRooms.forEach(r => { roomInfo[r.code] = r; });

    if (playersRes.error) return res.status(500).json({ error: playersRes.error.message });

    const bestByRoom = {};
    (playersRes.data || []).forEach(row => {
      const roomId = row.games?.room_id;
      if (!roomId || !officialCodes.has(roomId)) return;
      if (!bestByRoom[roomId] || row.score > bestByRoom[roomId]) bestByRoom[roomId] = row.score;
    });
    res.json({ bestByRoom, roomInfo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Spotify status ───────────────────────────────────────────────────────────
router.get('/spotify/status', (req, res) => {
  res.json({ configured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) });
});

// ─── Spotify search ───────────────────────────────────────────────────────────
router.get('/spotify/search', rateLimit(30, 60_000), async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: 'Parametre q requis' });
  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();
    const params  = new URLSearchParams({ q, type: 'track', limit: '10', market: 'FR' });
    const r       = await fetchFn(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    res.json((data.tracks?.items || []).map(t => ({
      external_id: t.id,
      source:      'spotify',
      artist:      t.artists.map(a => a.name).join(', '),
      title:       t.name,
      preview_url: t.preview_url || null,
      cover_url:   t.album.images[1]?.url || t.album.images[0]?.url || null,
    })));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Spotify import (user token via PKCE) ────────────────────────────────────
router.get('/spotify/playlist-user/:id', rateLimit(10, 60_000), async (req, res) => {
  const userToken = req.headers['x-spotify-token'];
  const plId      = req.params.id;
  if (!userToken) return res.status(400).json({ error: 'X-Spotify-Token manquant' });

  const fetchFn = await getFetch();

  try {
    let plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      signal: AbortSignal.timeout(12000),
    });

    let currentToken = userToken;

    if (!plRes.ok) {
      if (plRes.status === 401) return res.status(401).json({ error: 'Token Spotify expire — reconnecte-toi.' });
      if (plRes.status === 404) return res.status(404).json({ error: 'Playlist introuvable.' });
      console.warn(`[Spotify] metadata ${plRes.status} — fallback CC`);
      currentToken = await getSpotifyToken();
      plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!plRes.ok) return res.status(plRes.status).json({ error: 'Playlist inaccessible.' });
    }

    const pl            = await plRes.json();
    const total         = pl.tracks?.total || 0;
    const embeddedItems = pl.tracks?.items || [];

    let allItems  = [];
    let offset    = 0;
    let loopTotal = total > 0 ? total : 9999;
    let itemsOk   = true;

    while (allItems.length < Math.min(loopTotal, 1000)) {
      const tRes = await fetchFn(
        `https://api.spotify.com/v1/playlists/${plId}/items?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${currentToken}` }, signal: AbortSignal.timeout(12000) }
      );
      if (tRes.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
      if (!tRes.ok) { itemsOk = false; break; }
      const page = await tRes.json();
      if (typeof page.total === 'number') loopTotal = Math.min(page.total, 1000);
      if (!page.items?.length) break;
      allItems = allItems.concat(page.items);
      offset  += page.items.length;
      if (page.items.length < 50) break;
    }

    const rawItems = itemsOk ? allItems : embeddedItems;
    const tracks   = rawItems.map(normalizeSpotifyItem).filter(Boolean);

    if (!tracks.length) {
      return res.status(422).json({ error: `Aucune piste recuperee (${rawItems.length} items bruts). Playlist vide ou privee ?` });
    }

    const limited   = total > 100 && tracks.length <= 100;
    const truncated = loopTotal > tracks.length;
    res.json({ name: pl.name, cover: pl.images?.[0]?.url || null, tracks, total: loopTotal, truncated, limited });
  } catch (e) {
    console.error('Spotify user-import error:', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ─── Spotify import (public, client credentials) ─────────────────────────────
router.get('/spotify/playlist/:id', rateLimit(10, 60_000), async (req, res) => {
  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();
    const plId    = req.params.id;

    const plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!plRes.ok) throw new Error('Playlist introuvable ou privee');
    const pl            = await plRes.json();
    const total         = pl.tracks?.total || 0;
    const embeddedItems = pl.tracks?.items || [];

    let allItems  = [];
    let offset    = 0;
    let loopTotal = total > 0 ? total : 9999;
    let itemsOk   = true;

    while (allItems.length < Math.min(loopTotal, 1000)) {
      const tRes = await fetchFn(
        `https://api.spotify.com/v1/playlists/${plId}/items?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) }
      );
      if (!tRes.ok) { itemsOk = false; break; }
      const page = await tRes.json();
      if (typeof page.total === 'number') loopTotal = Math.min(page.total, 1000);
      if (!page.items?.length) break;
      allItems = allItems.concat(page.items);
      offset  += page.items.length;
      if (page.items.length < 50) break;
    }

    const rawItems = itemsOk ? allItems : embeddedItems;
    const tracks   = rawItems.map(normalizeSpotifyItem).filter(Boolean);
    res.json({ name: pl.name, cover: pl.images?.[0]?.url || null, tracks, total: loopTotal });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Deezer search ────────────────────────────────────────────────────────────
router.get('/deezer/search', rateLimit(30, 60_000), async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: 'Parametre q requis' });
  try {
    const fetchFn = await getFetch();
    const r = await fetchFn(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20`, {
      headers: { 'User-Agent': 'ZIK-BlindTest/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    res.json((data.data || []).map(t => ({
      external_id: String(t.id),
      source:      'deezer',
      artist:      t.artist.name,
      title:       t.title,
      preview_url: t.preview || null,
      cover_url:   t.album.cover_xl || t.album.cover_big || null,
    })));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Deezer import playlist ───────────────────────────────────────────────────
router.get('/deezer/playlist/:id', rateLimit(10, 60_000), async (req, res) => {
  try {
    const fetchFn = await getFetch();
    const headers = { 'User-Agent': 'ZIK-BlindTest/1.0' };
    const plId    = req.params.id;

    const r = await fetchFn(`https://api.deezer.com/playlist/${plId}`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Playlist introuvable');

    const total = data.nb_tracks || data.tracks?.total || 0;
    if (!total) throw new Error('Playlist vide ou privee');

    let allTracks = [];
    while (allTracks.length < Math.min(total, 1000)) {
      const index = allTracks.length;
      const nextR = await fetchFn(
        `https://api.deezer.com/playlist/${plId}/tracks?index=${index}&limit=100`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (!nextR.ok) break;
      const nextData = await nextR.json();
      if (nextData.error || !nextData.data?.length) break;
      allTracks = allTracks.concat(nextData.data);
      if (nextData.data.length < 100) break;
    }

    if (!allTracks.length) throw new Error('Impossible de recuperer les titres (playlist vide ou privee)');

    const tracks = allTracks
      .filter(t => t.readable !== false)
      .map(t => ({
        external_id: String(t.id),
        source:      'deezer',
        artist:      t.artist.name,
        title:       t.title,
        preview_url: t.preview || null,
        cover_url:   t.album.cover_xl || t.album.cover_big || null,
      }));

    res.json({ name: data.title, cover: data.picture_xl || data.picture_big || null, tracks });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Playlists: secure delete ─────────────────────────────────────────────────
router.delete('/playlists/:id', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Non authentifie' });
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Session invalide' });

  const plId       = req.params.id;
  const uSupa      = userClient(token);

  const { data: pl, error: plErr } = await uSupa
    .from('custom_playlists').select('owner_id').eq('id', plId).single();
  if (plErr || !pl) return res.status(404).json({ error: 'Playlist introuvable' });
  if (pl.owner_id !== user.id) return res.status(403).json({ error: 'Non autorise' });

  await uSupa.from('custom_playlist_tracks').delete().eq('playlist_id', plId);
  const { error } = await uSupa.from('custom_playlists').delete().eq('id', plId);
  if (error) return res.status(400).json({ error: error.message });
  console.log(`Playlist ${plId} supprimee par ${user.email}`);
  res.json({ ok: true });
});

// ─── Playlists: mark official (super_admin only) ──────────────────────────────
router.post('/playlists/:id/official', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Non authentifie' });
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Session invalide' });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return res.status(403).json({ error: 'Super-admin uniquement' });

  const uSupa = userClient(token);
  const { is_official, linked_room_id } = req.body || {};
  const { error } = await uSupa.from('custom_playlists')
    .update({ is_official: !!is_official, linked_room_id: linked_room_id || null })
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  if (linked_room_id && is_official) delete playlistCache[linked_room_id];
  console.log(`Playlist ${req.params.id} marquee officielle -> room "${linked_room_id}" par ${user.email}`);
  res.json({ ok: true });
});

module.exports = router;

'use strict';

const express = require('express');
const router  = express.Router();

const { supabase }                     = require('../config');
const { customRooms, dbRooms, roomGames } = require('../state');
const { requireAuth, rateLimit, userClient } = require('../middleware/auth');
const { buildTrack }                   = require('../services/playlist');

// ─── Code generator for ephemeral rooms ──────────────────────────────────────
function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (customRooms[code]);
  return code;
}

// ─── GET /api/rooms — public rooms (+ all if super_admin) ────────────────────
router.get('/rooms', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  let isSuperAdmin = false;

  if (token) {
    const { verifyToken } = require('../middleware/auth');
    const user = await verifyToken(token);
    if (user) {
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isSuperAdmin = p?.role === 'super_admin';
    }
  }

  let query = supabase
    .from('rooms')
    .select('id, code, name, emoji, description, is_public, max_rounds, round_duration, break_duration, last_active_at, owner_id, playlist_id, profiles!owner_id(username, avatar_url)')
    .order('last_active_at', { ascending: false })
    .limit(50);

  if (!isSuperAdmin) query = query.eq('is_public', true);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/rooms/mine ──────────────────────────────────────────────────────
router.get('/rooms/mine', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const token = req.headers.authorization.slice(7);
  const { data, error } = await userClient(token)
    .from('rooms')
    .select('id, code, name, emoji, description, is_public, max_rounds, round_duration, break_duration, last_active_at, playlist_id')
    .eq('owner_id', user.id)
    .order('last_active_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── POST /api/rooms/custom — create ephemeral room ──────────────────────────
router.post('/rooms/custom', rateLimit(5, 60_000), async (req, res) => {
  const { name, emoji, tracks, maxRounds = 10, roundDuration = 30, breakDuration = 7 } = req.body || {};
  if (!name?.trim() || !Array.isArray(tracks) || tracks.length < 3) {
    return res.status(400).json({ error: 'name et au moins 3 tracks requis' });
  }
  const code = genRoomCode();
  const rd   = Math.min(Math.max(parseInt(roundDuration) || 30, 10), 60);
  const bd   = Math.min(Math.max(parseInt(breakDuration)  || 7,  3), 15);
  const mr   = Math.min(Math.max(parseInt(maxRounds)      || 10, 3), tracks.length);

  customRooms[code] = {
    id:            code,
    name:          String(name).trim().slice(0, 60),
    emoji:         emoji || '🎵',
    tracks:        tracks.map(t => buildTrack({
      artist:      String(t.artist || '').trim(),
      title:       String(t.title  || '').trim(),
      cover:       t.cover_url,
      preview_url: t.preview_url,
    })).filter(t => t.artist && t.title),
    maxRounds:     mr,
    roundDuration: rd,
    breakDuration: bd,
  };

  // TTL 4h
  setTimeout(() => {
    delete customRooms[code];
    delete roomGames[code];
  }, 4 * 60 * 60 * 1000);

  console.log(`Room ephemere "${code}" creee — "${name}", ${tracks.length} titres, ${mr} manches`);
  res.json({ code });
});

// ─── GET /api/rooms/custom/:code ─────────────────────────────────────────────
router.get('/rooms/custom/:code', (req, res) => {
  const room = customRooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room introuvable ou expiree' });
  res.json({ name: room.name, emoji: room.emoji, maxRounds: room.maxRounds, trackCount: room.tracks.length });
});

// ─── GET /api/rooms/:code — room info by code ─────────────────────────────────
router.get('/rooms/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();

  const ephemeral = customRooms[code];
  if (ephemeral) {
    return res.json({ source: 'ephemeral', name: ephemeral.name, emoji: ephemeral.emoji, maxRounds: ephemeral.maxRounds, trackCount: ephemeral.tracks.length });
  }

  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, name, emoji, description, is_public, max_rounds, round_duration, break_duration, playlist_id, profiles!owner_id(username)')
    .eq('code', code)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Room introuvable' });
  res.json({ source: 'db', ...data });
});

// ─── POST /api/rooms — create persistent room ─────────────────────────────────
router.post('/rooms', rateLimit(10, 60_000), async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const token = req.headers.authorization.slice(7);

  const { name, emoji, description, playlist_id, is_public, max_rounds, round_duration, break_duration } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'name requis' });

  const { data, error } = await userClient(token)
    .from('rooms')
    .insert({
      name:           String(name).trim().slice(0, 60),
      emoji:          emoji || '🎵',
      description:    String(description || '').slice(0, 200),
      owner_id:       user.id,
      playlist_id:    playlist_id || null,
      is_public:      is_public !== false,
      max_rounds:     Math.min(Math.max(parseInt(max_rounds)     || 10, 3), 50),
      round_duration: Math.min(Math.max(parseInt(round_duration) || 30, 10), 60),
      break_duration: Math.min(Math.max(parseInt(break_duration) || 7,  3), 15),
    })
    .select('id, code, name, emoji')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  console.log(`Room "${data.code}" creee par ${user.email}`);
  res.json(data);
});

// ─── PATCH /api/rooms/:id — update own room ───────────────────────────────────
router.patch('/rooms/:id', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const token = req.headers.authorization.slice(7);

  const allowed = ['name', 'emoji', 'description', 'playlist_id', 'is_public', 'max_rounds', 'round_duration', 'break_duration'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (updates.name) updates.name = String(updates.name).trim().slice(0, 60);

  const { error } = await userClient(token).from('rooms').update(updates).eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ─── DELETE /api/rooms/:id — delete own room ──────────────────────────────────
router.delete('/rooms/:id', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const token = req.headers.authorization.slice(7);
  const { error } = await userClient(token).from('rooms').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;

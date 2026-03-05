require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const yts = require('yt-search');
const stringSimilarity = require('string-similarity');
const ROOMS = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ⚠️ /config.js DOIT être avant express.static pour ne pas chercher un fichier physique
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`window.ZIK_SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL||'')};window.ZIK_SUPABASE_ANON_KEY=${JSON.stringify(process.env.SUPABASE_ANON_KEY||'')};`);
});

app.use(express.static('public'));
app.use(express.json());

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Fetch helper (compatible Node 16/17 et Node 18+) ────────────────────────
let _fetch;
async function getFetch() {
  if (_fetch) return _fetch;
  // Node 18+ a fetch natif
  if (typeof globalThis.fetch === 'function') {
    _fetch = globalThis.fetch;
    return _fetch;
  }
  // Fallback node-fetch pour Node < 18
  try {
    const mod = await import('node-fetch');
    _fetch = mod.default;
    console.log('ℹ️  Utilisation de node-fetch');
  } catch {
    console.error('❌ node-fetch introuvable — lance: npm install node-fetch');
    throw new Error('fetch indisponible');
  }
  return _fetch;
}

// ─── Playlists cache ──────────────────────────────────────────────────────────
const playlistCache = {}; // roomId -> tracks[]

async function fetchDeezerPlaylist(playlistId) {
  const fetchFn = await getFetch();
  const headers = { 'User-Agent': 'ZIK-BlindTest/1.0' };

  // Première page
  const res = await fetchFn(`https://api.deezer.com/playlist/${playlistId}?limit=100`, {
    headers, signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Deezer: ${data.error.message || JSON.stringify(data.error)}`);
  if (!data.tracks?.data?.length) throw new Error('Playlist vide ou privée');

  let allTracks = [...data.tracks.data];
  const total   = data.tracks.total || allTracks.length;

  // Pagination par index jusqu'à 1000 titres
  while (allTracks.length < Math.min(total, 1000)) {
    const index  = allTracks.length;
    const nextR  = await fetchFn(`https://api.deezer.com/playlist/${playlistId}/tracks?index=${index}&limit=100`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (!nextR.ok) break;
    const nextData = await nextR.json();
    if (nextData.error || !nextData.data?.length) break;
    allTracks = allTracks.concat(nextData.data);
  }

  data.tracks.data = allTracks;
  return data;
}

async function loadPlaylist(roomId) {
  // Custom rooms: tracks déjà en mémoire
  if (customRooms[roomId]) return customRooms[roomId].tracks;

  if (playlistCache[roomId]?.length > 0) return playlistCache[roomId];
  const room = ROOMS[roomId];
  if (!room) return [];

  const ids = room.playlist_ids || (room.playlist_id ? [room.playlist_id] : []);
  if (!ids.length) { console.error(`❌ Room "${roomId}": aucun playlist_id configuré`); return []; }

  for (const pid of ids) {
    try {
      const data = await fetchDeezerPlaylist(pid);
      const tracks = data.tracks.data
        .filter(t => t.readable !== false) // exclure titres non disponibles
        .map(t => ({
          artist:      t.artist.name,
          title:       t.title,
          cleanTitle:  cleanString(t.title),
          cleanArtist: cleanString(t.artist.name),
          cover:       t.album.cover_xl || t.album.cover_big || '',
        }));

      if (tracks.length < 5) throw new Error(`Seulement ${tracks.length} titres lisibles`);

      playlistCache[roomId] = tracks;
      console.log(`✅ Room "${roomId}" (playlist ${pid}): ${tracks.length} titres — "${data.title}"`);
      return tracks;
    } catch (err) {
      console.warn(`⚠️  Room "${roomId}" playlist ${pid} KO: ${err.message}`);
    }
  }

  console.error(`❌ Room "${roomId}": toutes les playlists ont échoué`);
  return [];
}

// Précharger toutes les playlists au démarrage avec diagnostic
async function preloadAllPlaylists() {
  console.log('🔄 Préchargement des playlists Deezer...');
  const results = await Promise.allSettled(Object.keys(ROOMS).map(id => loadPlaylist(id)));
  const ok  = results.filter(r => r.status === 'fulfilled' && r.value?.length > 0).length;
  const ko  = results.length - ok;
  console.log(`📊 Playlists: ${ok}/${results.length} OK${ko ? ` — ${ko} en erreur` : ''}`);
}
preloadAllPlaylists();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanString(str) {
  if (!str) return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprimer accents
    .replace(/ *\([^)]*\) */g, '').replace(/ *\[[^\]]*\] */g, '')
    .replace(/[''`]/g, "'").replace(/[-–—]/g, ' ')
    .trim().toLowerCase();
}

function calcSpeedBonus(timeTaken) {
  if (timeTaken < 10) return 2;
  if (timeTaken < 20) return 1;
  return 0;
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// Liste des rooms avec nb de joueurs en ligne
app.get('/api/rooms', (req, res) => {
  const result = Object.values(ROOMS).map(r => ({
    ...r,
    online: Object.values(roomGames).filter(g => g.roomId === r.id)
      .reduce((acc, g) => acc + Object.keys(g.players).length, 0),
  }));
  res.json(result);
});

// Profil utilisateur
app.get('/api/profile/:username', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', req.params.username)
    .single();
  if (error) return res.status(404).json({ error: 'Profil introuvable' });
  res.json(data);
});

// Classement hebdomadaire
app.get('/api/leaderboard/weekly', async (req, res) => {
  const { data, error } = await supabase.rpc('weekly_leaderboard');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Classement ELO global
app.get('/api/leaderboard/elo', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, avatar_url, elo, level, games_played')
    .order('elo', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Spotify : token client credentials (mis en cache 50 min) ────────────────
let _spotifyToken = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;
  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify non configuré — ajoute SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET dans .env');
  const fetchFn = await getFetch();
  const res = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Spotify token error ${res.status}:`, body);
    throw new Error(`Identifiants Spotify invalides (HTTP ${res.status}). Vérifie SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET.`);
  }
  const json = await res.json();
  _spotifyToken = json.access_token;
  _spotifyTokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return _spotifyToken;
}

// ─── Spotify : recherche de titres ───────────────────────────────────────────
app.get('/api/spotify/search', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: 'Paramètre q requis' });
  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();
    // Utiliser URLSearchParams pour éviter tout problème d'encodage
    const params  = new URLSearchParams({ q, type: 'track', limit: '10' });
    const r = await fetchFn(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`Spotify search error ${r.status}:`, body);
      throw new Error(`Spotify API HTTP ${r.status} — ${body.slice(0, 200)}`);
    }
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

// ─── Spotify : importer une playlist ─────────────────────────────────────────
// Stratégie :
// 1. GET /playlists/{id}/tracks avec pagination (fonctionne avec CC pour playlists publiques)
// 2. Si 403, fallback sur les tracks embedded dans GET /playlists/{id} (100 premiers)
app.get('/api/spotify/playlist/:id', async (req, res) => {
  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();
    const plId    = req.params.id;

    // 1. Métadonnées de la playlist
    const plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}?market=FR`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000),
    });
    if (!plRes.ok) {
      const body = await plRes.text().catch(() => '');
      console.error(`Spotify playlist ${plId} error ${plRes.status}:`, body.slice(0, 200));
      if (plRes.status === 404) throw new Error('Playlist introuvable — vérifie que le lien est correct et que la playlist est publique.');
      if (plRes.status === 403) throw new Error('Accès refusé par Spotify — la playlist est peut-être privée.');
      throw new Error(`Erreur Spotify (HTTP ${plRes.status})`);
    }
    const pl = await plRes.json();
    const total = pl.tracks?.total || 0;

    console.log(`Spotify playlist "${pl.name}": total=${total}, embedded=${pl.tracks?.items?.length || 0}`);

    // 2. Tenter la pagination via /tracks (fonctionne souvent avec CC pour playlists publiques)
    let allItems = [];
    let usedPagination = false;
    try {
      let offset = 0;
      const limit = 100;
      while (offset < Math.min(total, 500)) {
        const tRes = await fetchFn(
          `https://api.spotify.com/v1/playlists/${plId}/tracks?limit=${limit}&offset=${offset}&market=FR&fields=items(track(id,name,artists(name),album(images),preview_url)),next,total`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) }
        );
        if (!tRes.ok) {
          console.warn(`Spotify /tracks offset=${offset} returned ${tRes.status} — fallback sur embedded`);
          break;
        }
        const tData = await tRes.json();
        if (!tData.items?.length) break;
        allItems = allItems.concat(tData.items);
        offset += limit;
        if (tData.items.length < limit || !tData.next) break;
      }
      if (allItems.length > 0) usedPagination = true;
    } catch (paginationErr) {
      console.warn('Spotify pagination error:', paginationErr.message);
    }

    // 3. Fallback sur les tracks embedded si pagination vide
    if (!usedPagination) {
      allItems = pl.tracks?.items || [];
      console.log(`Spotify: utilisation des ${allItems.length} tracks embedded (pagination indisponible)`);
    }

    const tracks = allItems
      .filter(i => i?.track?.id)
      .map(i => ({
        external_id: i.track.id,
        source:      'spotify',
        artist:      i.track.artists.map(a => a.name).join(', '),
        title:       i.track.name,
        preview_url: i.track.preview_url || null,
        cover_url:   i.track.album?.images?.[1]?.url || i.track.album?.images?.[0]?.url || null,
      }));

    console.log(`Spotify: ${tracks.length} tracks valides extraits (sur ${allItems.length} items)`);

    if (!tracks.length) {
      if (total > 0) {
        throw new Error(`La playlist contient ${total} titre(s) mais aucun n'est accessible via l'API Spotify avec les identifiants actuels. Essaie l'import Deezer ou ajoute les titres manuellement.`);
      }
      throw new Error('Playlist vide ou privée — vérifie que la playlist est bien publique et contient des titres.');
    }

    const truncated = total > tracks.length;
    res.json({
      name:      pl.name,
      cover:     pl.images?.[0]?.url || null,
      tracks,
      truncated,
      total,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Deezer : recherche de titres ────────────────────────────────────────────
app.get('/api/deezer/search', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: 'Paramètre q requis' });
  try {
    const fetchFn = await getFetch();
    const r = await fetchFn(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20`, {
      headers: { 'User-Agent': 'ZIK-BlindTest/1.0' }, signal: AbortSignal.timeout(8000),
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

// ─── Deezer : importer une playlist (avec pagination complète) ───────────────
app.get('/api/deezer/playlist/:id', async (req, res) => {
  try {
    const fetchFn = await getFetch();
    const headers = { 'User-Agent': 'ZIK-BlindTest/1.0' };

    // Première page : récup métadonnées + premiers titres
    const r = await fetchFn(`https://api.deezer.com/playlist/${req.params.id}?limit=100`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Playlist introuvable');
    if (!data.tracks?.data?.length) throw new Error('Playlist vide ou privée');

    let allTracks = [...data.tracks.data];
    const total   = data.tracks.total || allTracks.length;

    // Pagination par index (plus fiable que suivre `next`)
    while (allTracks.length < Math.min(total, 1000)) {
      const index = allTracks.length;
      const nextR = await fetchFn(`https://api.deezer.com/playlist/${req.params.id}/tracks?index=${index}&limit=100`, {
        headers, signal: AbortSignal.timeout(10000),
      });
      if (!nextR.ok) break;
      const nextData = await nextR.json();
      if (nextData.error || !nextData.data?.length) break;
      allTracks = allTracks.concat(nextData.data);
    }

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

// ─── Profil : mise à jour (nom + avatar) ─────────────────────────────────────
app.post('/api/profile/update', async (req, res) => {
  const { userId, username, avatar_url } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requis' });
  const updates = {};
  if (username !== undefined) {
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return res.status(400).json({ error: 'Pseudo invalide' });
    updates.username = username.trim();
  }
  if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Rien à mettre à jour' });
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ─── Stats : meilleurs scores par room ───────────────────────────────────────
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('game_players')
      .select('score, games(room_id, ended_at)')
      .eq('user_id', req.params.userId)
      .eq('is_guest', false)
      .not('games', 'is', null)
      .order('score', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Meilleur score par room
    const bestByRoom = {};
    (data || []).forEach(row => {
      const roomId = row.games?.room_id;
      if (!roomId) return;
      if (!bestByRoom[roomId] || row.score > bestByRoom[roomId]) {
        bestByRoom[roomId] = row.score;
      }
    });
    res.json({ bestByRoom });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Spotify config status ────────────────────────────────────────────────────
app.get('/api/spotify/status', (req, res) => {
  res.json({ configured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) });
});

// ─── Custom rooms (éphémères, TTL 4h) ────────────────────────────────────────
const customRooms = {}; // code -> { id, name, emoji, tracks, maxRounds, roundDuration, breakDuration }

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (customRooms[code]);
  return code;
}

app.post('/api/rooms/custom', async (req, res) => {
  const { name, emoji, tracks, maxRounds = 10, roundDuration = 30, breakDuration = 7 } = req.body || {};
  if (!name?.trim() || !Array.isArray(tracks) || tracks.length < 3) {
    return res.status(400).json({ error: 'name et au moins 3 tracks requis' });
  }
  const code = genRoomCode();
  const rd   = Math.min(Math.max(parseInt(roundDuration) || 30, 10), 60);
  const bd   = Math.min(Math.max(parseInt(breakDuration)  || 7,  3),  15);
  const mr   = Math.min(Math.max(parseInt(maxRounds)      || 10, 3), tracks.length);

  customRooms[code] = {
    id:            code,
    name:          String(name).trim().slice(0, 60),
    emoji:         emoji || '🎵',
    tracks:        tracks.map(t => ({
      artist:      String(t.artist || '').trim(),
      title:       String(t.title  || '').trim(),
      cleanTitle:  cleanString(t.title  || ''),
      cleanArtist: cleanString(t.artist || ''),
      cover:       t.cover_url || '',
      preview_url: t.preview_url || null,
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

  console.log(`🎮 Custom room "${code}" créée — "${name}", ${tracks.length} titres, ${mr} manches`);
  res.json({ code });
});

app.get('/api/rooms/custom/:code', (req, res) => {
  const room = customRooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'Room introuvable ou expirée' });
  res.json({ name: room.name, emoji: room.emoji, maxRounds: room.maxRounds, trackCount: room.tracks.length });
});

// ─── Game State per Room ──────────────────────────────────────────────────────
// roomGames[roomId] = { players, socketToName, nameToSocket, game }
const roomGames = {};

const CONFIG = { roundDuration: 30, breakDuration: 7 };

function getOrCreateRoom(roomId) {
  if (!roomGames[roomId]) {
    const cust = customRooms[roomId];
    roomGames[roomId] = {
      roomId,
      players: {},
      socketToName: {},
      nameToSocket: {},
      game: {
        isActive: false,
        currentRound: 0,
        maxRounds:     cust?.maxRounds     || ROOMS[roomId]?.maxRounds || 10,
        roundDuration: cust?.roundDuration || CONFIG.roundDuration,
        breakDuration: cust?.breakDuration || CONFIG.breakDuration,
        timer: 0,
        interval: null,
        currentTrack: null,
        startTime: 0,
        sessionPlaylist: [],
        history: [],
        firstFullFinder: null,
        totalFullFound: 0,
        lastRoundData: null,
        dbGameId: null,
      }
    };
  }
  return roomGames[roomId];
}

function getRoomIO(roomId) {
  return io.to(`room:${roomId}`);
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('join_room', async ({ roomId, username, userId, isGuest }) => {
    if (!ROOMS[roomId] && !customRooms[roomId]) return socket.emit('error', 'Room inconnue ou expirée');
    if (!username?.trim()) return socket.emit('error', 'Pseudo requis');

    username = username.trim();
    const room = getOrCreateRoom(roomId);

    // Quitter l'ancienne room si besoin
    if (socket.currentRoom) {
      leaveRoom(socket, socket.currentRoom);
    }

    socket.join(`room:${roomId}`);
    socket.currentRoom = roomId;
    socket.currentUser = { username, userId, isGuest };

    // Enregistrer le joueur
    if (!room.players[username]) {
      room.players[username] = {
        name: username,
        userId: userId || null,
        isGuest: isGuest !== false,
        score: 0,
        foundArtist: false,
        foundTitle: false,
      };
    } else {
      // Reconnexion — annuler le timer de déconnexion
      clearTimeout(room.players[username]._dcTimer);
      delete room.players[username]._dcTimer;
      const oldSocketId = room.nameToSocket[username];
      if (oldSocketId) delete room.socketToName[oldSocketId];
    }

    room.socketToName[socket.id] = username;
    room.nameToSocket[username] = socket.id;

    getRoomIO(roomId).emit('update_players', Object.values(room.players));
    const cust = customRooms[roomId];
    socket.emit('room_joined', {
      roomId,
      roomConfig: ROOMS[roomId] || {
        id: roomId,
        name: cust?.name,
        emoji: cust?.emoji,
        trackCount: cust?.tracks?.length,
        maxRounds: cust?.maxRounds,
      },
    });
    socket.emit('init_history', room.game.history);

    if (room.game.isActive && room.game.lastRoundData) {
      socket.emit('start_round', room.game.lastRoundData);
    }

    console.log(`👤 ${username} → room "${roomId}"`);
  });

  socket.on('request_new_game', async () => {
    const roomId = socket.currentRoom;
    if (!roomId) return;
    const room = getOrCreateRoom(roomId);
    if (room.game.isActive) return;

    const playlist = await loadPlaylist(roomId);
    if (playlist.length === 0) {
      return socket.emit('server_error', 'Playlist indisponible, réessaie.');
    }

    room.game.history = [];
    room.game.currentRound = 0;
    room.game.sessionPlaylist = [...playlist]
      .sort(() => Math.random() - 0.5)
      .slice(0, room.game.maxRounds);

    resetScores(room);
    getRoomIO(roomId).emit('init_history', []);
    getRoomIO(roomId).emit('game_starting');

    // Créer la game en BDD
    try {
      const { data } = await supabase.from('games').insert({
        room_id: roomId,
        rounds: room.game.maxRounds,
      }).select().single();
      if (data) room.game.dbGameId = data.id;
    } catch (e) { /* non-bloquant */ }

    startNextRound(roomId);
  });

  socket.on('submit_guess', async (guess) => {
    const roomId = socket.currentRoom;
    if (!roomId) return;
    const room = getOrCreateRoom(roomId);
    const name = room.socketToName[socket.id];

    if (!room.game.isActive || !room.game.currentTrack || !room.players[name]) return;
    if (!guess?.trim()) return;

    const user = room.players[name];
    const input = cleanString(guess);
    const timeTaken = (Date.now() - room.game.startTime) / 1000;
    const speedBonus = calcSpeedBonus(timeTaken);
    const track = room.game.currentTrack;

    const simArtist = stringSimilarity.compareTwoStrings(input, track.cleanArtist);
    const simTitle  = stringSimilarity.compareTwoStrings(input, track.cleanTitle);

    // Vérifie si le mot saisi correspond exactement à un mot du champ (min 3 lettres)
    function wordMatch(input, target) {
      if (input.length < 3) return false;
      const words = target.split(/\s+/).filter(w => w.length >= 3);
      return words.some(w => stringSimilarity.compareTwoStrings(input, w) > 0.88);
    }
    const cover = track.cover || '';
    let hit = false;

    // Check artiste
    if (!user.foundArtist) {
      const match = input.length >= 3 && (
        simArtist > 0.70 ||
        (input.length >= 4 && simArtist > 0.60 && wordMatch(input, track.cleanArtist)) ||
        wordMatch(input, track.cleanArtist)
      );
      if (match) {
        user.foundArtist = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_artist', msg: `✅ Artiste ! (+${1 + speedBonus} pts)`, val: track.artist, cover });
        hit = true;
      } else if (simArtist > 0.48) {
        socket.emit('feedback', { type: 'close', msg: "🔥 Tu chauffes sur l'artiste !" });
        hit = true;
      }
    }

    // Check titre
    if (!user.foundTitle) {
      const match = input.length >= 3 && (
        simTitle > 0.70 ||
        (input.length >= 4 && simTitle > 0.60 && wordMatch(input, track.cleanTitle)) ||
        wordMatch(input, track.cleanTitle)
      );
      if (match) {
        user.foundTitle = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_title', msg: `✅ Titre ! (+${1 + speedBonus} pts)`, val: track.title, cover });
        hit = true;
      } else if (simTitle > 0.48 && !hit) {
        socket.emit('feedback', { type: 'close', msg: '🔥 Tu chauffes sur le titre !' });
        hit = true;
      }
    }

    if (!hit) socket.emit('feedback', { type: 'miss', msg: '❄️ Pas du tout...' });

    getRoomIO(roomId).emit('update_players', Object.values(room.players));

    if (user.foundArtist && user.foundTitle) {
      if (room.game.totalFullFound === 0 || !room.game.firstFullFinder) {
        room.game.firstFullFinder = user.name;
      }
      room.game.totalFullFound++;
      // Montrer la cover immédiatement à ce joueur
      socket.emit('reveal_cover', { cover: room.game.currentTrack.cover });
    }

    checkEveryoneFound(roomId);
  });

  socket.on('disconnect', () => {
    if (socket.currentRoom) leaveRoom(socket, socket.currentRoom);
  });
});

function leaveRoom(socket, roomId) {
  const room = roomGames[roomId];
  if (!room) return;
  const name = room.socketToName[socket.id];
  if (name) {
    delete room.nameToSocket[name];
    delete room.socketToName[socket.id];
    // Retirer le joueur après 30s (laisse le temps de se reconnecter)
    if (room.players[name]) {
      clearTimeout(room.players[name]._dcTimer);
      room.players[name]._dcTimer = setTimeout(() => {
        delete room.players[name];
        getRoomIO(roomId).emit('update_players', Object.values(room.players).filter(p => !p._dcTimer));
      }, 30_000);
    }
  }
  socket.leave(`room:${roomId}`);
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
async function startNextRound(roomId) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;

  if (game.currentRound >= game.maxRounds || game.sessionPlaylist.length === 0) {
    game.isActive = false;
    const finalScores = Object.values(room.players).sort((a, b) => b.score - a.score);
    getRoomIO(roomId).emit('game_over', finalScores);

    // Sauvegarder en BDD
    await saveGameResults(roomId, finalScores);
    return;
  }

  game.currentRound++;
  game.firstFullFinder = null;
  game.totalFullFound = 0;
  resetRoundFlags(room);
  game.currentTrack = game.sessionPlaylist.pop();

  try {
    const r = await yts(`${game.currentTrack.artist} ${game.currentTrack.title} topic`);
    if (!r.videos?.length) throw new Error('No video');

    const video = r.videos[0];
    const safeStart = Math.max(0, Math.floor(Math.random() * Math.max(1, video.seconds - game.roundDuration - 10)));

    game.isActive = true;
    game.startTime = Date.now();
    game.timer = game.roundDuration;
    game.lastRoundData = {
      videoId: video.videoId,
      startSeconds: safeStart,
      round: game.currentRound,
      total: game.maxRounds,
    };

    getRoomIO(roomId).emit('start_round', game.lastRoundData);
    startTimer(roomId);
  } catch (err) {
    console.error(`⚠️ Skip "${game.currentTrack.title}":`, err.message);
    startNextRound(roomId);
  }
}

function startTimer(roomId) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;
  clearInterval(game.interval);
  game.interval = setInterval(() => {
    game.timer--;
    getRoomIO(roomId).emit('timer_update', { current: game.timer, max: game.roundDuration });
    if (game.timer <= 0) endRound(roomId, '⏱️ Temps écoulé !');
  }, 1000);
}

function checkEveryoneFound(roomId) {
  const room = getOrCreateRoom(roomId);
  const activePlayers = Object.values(room.players);
  if (activePlayers.length > 0 && activePlayers.every(u => u.foundArtist && u.foundTitle) && room.game.isActive) {
    endRound(roomId, '🎉 Tout le monde a trouvé !');
  }
}

function endRound(roomId, reason) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;
  clearInterval(game.interval);
  game.isActive = false;

  const summary = {
    answer:      `${game.currentTrack.artist} - ${game.currentTrack.title}`,
    cover:       game.currentTrack.cover,
    reason,
    firstFinder: game.firstFullFinder,
    totalFound:  game.totalFullFound,
  };
  game.history.push(summary);

  // Envoyer résultats personnalisés à chaque joueur
  Object.keys(room.players).forEach(username => {
    const p = room.players[username];
    const socketId = room.nameToSocket[username];
    if (socketId) {
      io.to(socketId).emit('round_end', {
        ...summary,
        foundArtist: p.foundArtist,
        foundTitle:  p.foundTitle,
      });
    }
  });

  setTimeout(() => startNextRound(roomId), game.breakDuration * 1000);
}

// ─── Supabase : sauvegarder résultats ────────────────────────────────────────
async function saveGameResults(roomId, finalScores) {
  const room = getOrCreateRoom(roomId);
  const dbGameId = room.game.dbGameId;
  if (!dbGameId) return;

  try {
    // Clôturer la game
    await supabase.from('games').update({ ended_at: new Date().toISOString() }).eq('id', dbGameId);

    // Insérer scores des joueurs
    const players = finalScores.map((p, i) => ({
      game_id:  dbGameId,
      user_id:  p.userId || null,
      username: p.name,
      score:    p.score,
      rank:     i + 1,
      is_guest: p.isGuest || !p.userId,
    }));
    await supabase.from('game_players').insert(players);

    // Mettre à jour stats des joueurs connectés
    for (let i = 0; i < finalScores.length; i++) {
      const p = finalScores[i];
      if (p.userId && !p.isGuest) {
        await supabase.rpc('update_player_stats', {
          p_user_id:       p.userId,
          p_score:         p.score,
          p_rank:          i + 1,
          p_total_players: finalScores.length,
        });
      }
    }
    console.log(`💾 Game ${dbGameId} saved.`);
  } catch (err) {
    console.error('❌ Save error:', err.message);
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function resetRoundFlags(room) {
  Object.keys(room.players).forEach(n => {
    room.players[n].foundArtist = false;
    room.players[n].foundTitle  = false;
  });
}

function resetScores(room) {
  Object.keys(room.players).forEach(n => room.players[n].score = 0);
  getRoomIO(room.roomId).emit('update_players', Object.values(room.players));
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 ZIK → http://localhost:${PORT}`));

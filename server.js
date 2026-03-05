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
  const url = `https://api.deezer.com/playlist/${playlistId}?limit=100`;
  const res = await fetchFn(url, {
    headers: { 'User-Agent': 'ZIK-BlindTest/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Deezer: ${data.error.message || JSON.stringify(data.error)}`);
  if (!data.tracks?.data?.length) throw new Error('Playlist vide ou privée');
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
  return str.replace(/ *\([^)]*\) */g, '').replace(/ *\[[^\]]*\] */g, '').trim().toLowerCase();
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
    const url     = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`;
    const r = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`Spotify search error ${r.status}:`, body);
      throw new Error(`Spotify API HTTP ${r.status} — ${body.slice(0, 120)}`);
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
app.get('/api/spotify/playlist/:id', async (req, res) => {
  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();

    // Récup les métadonnées de la playlist
    const plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${req.params.id}?fields=name,images`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
    });
    if (!plRes.ok) throw new Error(`Playlist introuvable (HTTP ${plRes.status})`);
    const pl = await plRes.json();

    // Paginer les tracks (max 500)
    let allItems = [];
    let nextUrl  = `https://api.spotify.com/v1/playlists/${req.params.id}/tracks?limit=100&fields=next,items(track(id,name,artists,album,preview_url))`;
    while (nextUrl && allItems.length < 500) {
      const r = await fetchFn(nextUrl, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        if (r.status === 403) throw new Error('Spotify a restreint l\'accès aux tracks de playlist en mode serveur (API Nov 2024). Utilise Deezer pour importer, ou la recherche titre par titre.');
        throw new Error(`Tracks inaccessibles (HTTP ${r.status})`);
      }
      const page = await r.json();
      allItems = allItems.concat(page.items || []);
      nextUrl  = page.next || null;
    }

    const tracks = allItems
      .filter(i => i.track?.id)
      .map(i => ({
        external_id: i.track.id,
        source:      'spotify',
        artist:      i.track.artists.map(a => a.name).join(', '),
        title:       i.track.name,
        preview_url: i.track.preview_url || null,
        cover_url:   i.track.album.images[1]?.url || i.track.album.images[0]?.url || null,
      }));

    res.json({ name: pl.name, cover: pl.images[0]?.url || null, tracks });
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
    let nextUrl   = data.tracks.next || null;

    // Paginer jusqu'à 500 titres
    while (nextUrl && allTracks.length < 500) {
      const nextR = await fetchFn(nextUrl, { headers, signal: AbortSignal.timeout(10000) });
      if (!nextR.ok) break;
      const nextData = await nextR.json();
      if (nextData.error || !nextData.data?.length) break;
      allTracks = allTracks.concat(nextData.data);
      nextUrl   = nextData.next || null;
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
      // Reconnexion - update socket
      const oldSocketId = room.nameToSocket[username];
      if (oldSocketId) delete room.socketToName[oldSocketId];
    }

    room.socketToName[socket.id] = username;
    room.nameToSocket[username] = socket.id;

    getRoomIO(roomId).emit('update_players', Object.values(room.players));
    socket.emit('room_joined', { roomId, roomConfig: ROOMS[roomId] || { id: roomId, name: customRooms[roomId]?.name, emoji: customRooms[roomId]?.emoji } });
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
    let hit = false;

    // Check artiste
    if (!user.foundArtist) {
      const match = (simArtist > 0.72 || track.cleanArtist.includes(input) || input.includes(track.cleanArtist)) && input.length > 1;
      if (match) {
        user.foundArtist = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_artist', msg: `✅ Artiste ! (+${1 + speedBonus} pts)`, val: track.artist });
        hit = true;
      } else if (simArtist > 0.45) {
        socket.emit('feedback', { type: 'close', msg: "🔥 Tu chauffes sur l'artiste !" });
        hit = true;
      }
    }

    // Check titre
    if (!user.foundTitle) {
      const match = (simTitle > 0.72 || track.cleanTitle.includes(input) || input.includes(track.cleanTitle)) && input.length > 1;
      if (match) {
        user.foundTitle = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_title', msg: `✅ Titre ! (+${1 + speedBonus} pts)`, val: track.title });
        hit = true;
      } else if (simTitle > 0.45 && !hit) {
        socket.emit('feedback', { type: 'close', msg: '🔥 Tu chauffes sur le titre !' });
        hit = true;
      }
    }

    if (!hit) socket.emit('feedback', { type: 'miss', msg: '❄️ Pas du tout...' });

    getRoomIO(roomId).emit('update_players', Object.values(room.players));

    if (user.foundArtist && user.foundTitle) {
      room.game.totalFullFound++;
      if (!room.game.firstFullFinder) room.game.firstFullFinder = user.name;
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
    // Optionnel : retirer le joueur de la liste
    // delete room.players[name];
    // getRoomIO(roomId).emit('update_players', Object.values(room.players));
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
    const safeStart = Math.max(0, Math.floor(Math.random() * Math.max(1, video.seconds - CONFIG.roundDuration - 10)));

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

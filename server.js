require('dotenv').config();
const express     = require('express');
const http        = require('http');
const path        = require('path');
const compression = require('compression');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const yts = require('yt-search');
const stringSimilarity = require('string-similarity');
const ROOMS = require('./rooms');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  transports:        ['websocket', 'polling'],
  perMessageDeflate: { threshold: 1024 },
  httpCompression:   { threshold: 1024 },
});

app.use(compression());

// ─── Config JS (avant static) ─────────────────────────────────────────────────
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(
    `window.ZIK_SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL||'')};` +
    `window.ZIK_SUPABASE_ANON_KEY=${JSON.stringify(process.env.SUPABASE_ANON_KEY||'')};` +
    `window.ZIK_SPOTIFY_CLIENT_ID=${JSON.stringify(process.env.SPOTIFY_CLIENT_ID||'')};` +
    `window.ZIK_ADMIN_USER_ID=${JSON.stringify(process.env.ADMIN_USER_ID||'')};`
  );
});

// ─── Favicon SVG (évite que Spotify vole le favicon lors de l'OAuth) ──────────
app.get('/favicon.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#070b10"/>
  <text x="32" y="46" font-size="38" text-anchor="middle" font-family="sans-serif">🎵</text>
</svg>`);
});

// ─── Static assets (CSS, JS, images) ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '5m',
  etag:   true,
  lastModified: true,
}));
app.use(express.json({ limit: '2mb' }));

// Gestionnaire d'erreur JSON malformé (retourne du JSON, pas du HTML)
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload trop volumineux (max 2 Mo)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  next(err);
});

// ─── Routes HTML (URLs propres sans .html) ────────────────────────────────────
const views = path.join(__dirname, 'views');
app.get('/',           (req, res) => res.sendFile(path.join(views, 'index.html')));
app.get('/game',       (req, res) => res.sendFile(path.join(views, 'game.html')));
app.get('/playlists',  (req, res) => res.sendFile(path.join(views, 'playlists.html')));
app.get('/rooms',      (req, res) => res.sendFile(path.join(views, 'rooms.html')));
app.get('/profile',         (req, res) => res.sendFile(path.join(views, 'profile.html')));
app.get('/settings',        (req, res) => res.sendFile(path.join(views, 'settings.html')));
app.get('/cgu',             (req, res) => res.sendFile(path.join(views, 'cgu.html')));
app.get('/confidentialite', (req, res) => res.sendFile(path.join(views, 'confidentialite.html')));

// Redirects pour les anciens liens en .html
app.get('/game.html',      (req, res) => res.redirect(301, '/game'      + (Object.keys(req.query).length ? '?' + new URLSearchParams(req.query) : '')));
app.get('/playlists.html', (req, res) => res.redirect(301, '/playlists'));
app.get('/profile.html',   (req, res) => res.redirect(301, '/profile'));
app.get('/index.html',     (req, res) => res.redirect(301, '/'));

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Cache de tokens JWT (évite un appel Supabase par requête) ────────────────
const _tokenCache = new Map(); // token -> { user, exp }
const TOKEN_TTL   = 60_000;   // 60s

async function verifyToken(token) {
  const cached = _tokenCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.user;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  _tokenCache.set(token, { user, exp: Date.now() + TOKEN_TTL });
  return user;
}

// Nettoyage périodique du cache
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _tokenCache.entries()) if (v.exp < now) _tokenCache.delete(k);
}, 60_000);

// ─── Rate limiter (en mémoire, sans dépendance externe) ───────────────────────
const _rl = new Map(); // ip -> { count, resetAt }

function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const e   = _rl.get(ip);
    if (!e || e.resetAt < now) { _rl.set(ip, { count: 1, resetAt: now + windowMs }); return next(); }
    if (e.count >= max) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans un instant.' });
    e.count++;
    next();
  };
}

// Nettoyage périodique
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rl.entries()) if (v.resetAt < now) _rl.delete(k);
}, 60_000);

// ─── Fetch helper (compatible Node 16/17 et Node 18+) ────────────────────────
let _fetch;
async function getFetch() {
  if (_fetch) return _fetch;
  if (typeof globalThis.fetch === 'function') {
    _fetch = globalThis.fetch;
    return _fetch;
  }
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
// Init fetch au démarrage (évite la latence lazy-init sur la 1ère requête)
getFetch().catch(() => {});

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

// Cache pour les rooms DB chargées depuis Supabase
const dbRooms = {}; // code -> { name, emoji, max_rounds, round_duration, break_duration, playlist_id }

async function loadPlaylist(roomId) {
  // Custom rooms éphémères : tracks déjà en mémoire
  if (customRooms[roomId]) return customRooms[roomId].tracks;

  if (playlistCache[roomId]?.length > 0) return playlistCache[roomId];

  // DB rooms : charger depuis custom_playlist_tracks via playlist_id
  const dbRoom = dbRooms[roomId];
  if (dbRoom?.playlist_id) {
    try {
      const { data: trackRows } = await supabase
        .from('custom_playlist_tracks')
        .select('artist, title, cover_url, preview_url')
        .eq('playlist_id', dbRoom.playlist_id)
        .order('position');
      if (trackRows?.length >= 3) {
        const tracks = trackRows.map(t => buildTrack({ artist: t.artist, title: t.title, cover: t.cover_url, preview_url: t.preview_url }));
        playlistCache[roomId] = tracks;
        console.log(`Room DB "${roomId}": ${tracks.length} titres chargés`);
        return tracks;
      }
    } catch { /* fallback ci-dessous */ }
    return [];
  }

  const room = ROOMS[roomId];
  if (!room) return [];

  // 1. Chercher d'abord une playlist officielle Supabase liée à cette room
  try {
    const { data: officialPl } = await supabase
      .from('custom_playlists')
      .select('id')
      .eq('linked_room_id', roomId)
      .eq('is_official', true)
      .single();

    if (officialPl) {
      const { data: trackRows } = await supabase
        .from('custom_playlist_tracks')
        .select('artist, title, cover_url, preview_url')
        .eq('playlist_id', officialPl.id)
        .order('position');

      if (trackRows?.length >= 5) {
        const tracks = trackRows.map(t => buildTrack({ artist: t.artist, title: t.title, cover: t.cover_url, preview_url: t.preview_url }));
        playlistCache[roomId] = tracks;
        console.log(`✅ Room "${roomId}" (playlist Supabase officielle): ${tracks.length} titres`);
        return tracks;
      }
    }
  } catch { /* fallback Deezer */ }

  // 2. Fallback : playlist Deezer configurée dans rooms.js
  const ids = room.playlist_ids || (room.playlist_id ? [room.playlist_id] : []);
  if (!ids.length) { console.error(`❌ Room "${roomId}": aucun playlist_id configuré`); return []; }

  for (const pid of ids) {
    try {
      const data = await fetchDeezerPlaylist(pid);
      const tracks = data.tracks.data
        .filter(t => t.readable !== false)
        .map(t => buildTrack({ artist: t.artist.name, title: t.title, cover: t.album.cover_xl || t.album.cover_big }));

      if (tracks.length < 5) throw new Error(`Seulement ${tracks.length} titres lisibles`);

      playlistCache[roomId] = tracks;
      console.log(`✅ Room "${roomId}" (playlist Deezer ${pid}): ${tracks.length} titres — "${data.title}"`);
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

// Display string: strips parenthetical/bracket content for UI reveal
// (e.g. "22 (Prod. by Diabi)" → "22", "Savage (feat. Beyoncé)" → "Savage")
function displayString(str) {
  if (!str) return '';
  return str
    .replace(/ *\([^)]*\) */g, ' ')
    .replace(/ *\[[^\]]*\] */g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extracts main artist and featuring artists from an artist string.
// Always returns { main: string, feats: string[] }.
// Handles: "A feat. B & C", "A (feat. B, C)", "A, B, C" (Spotify), "A & B"
function parseFeaturing(artistStr) {
  if (!artistStr) return { main: '', feats: [] };

  // 1. feat./ft./featuring (parenthetical or inline) — capture everything after
  const m = artistStr.match(
    /^(.+?)(?:\s*\((?:feat\.?|ft\.?|featuring)\s+([^)]+)\)|\s+(?:feat\.?|ft\.?|featuring)\s+(.+))$/i
  );
  if (m) {
    const featStr = (m[2] || m[3]).trim();
    // Split the feat part on ", " or " & " to get individual artists
    const feats = featStr.split(/\s*(?:,|&)\s*/).map(s => s.trim()).filter(Boolean);
    return { main: m[1].trim(), feats };
  }

  // 2. Comma-separated (Spotify stores multi-artist as "A, B, C")
  const commaParts = artistStr.split(', ').map(s => s.trim()).filter(Boolean);
  if (commaParts.length > 1) {
    return { main: commaParts[0], feats: commaParts.slice(1) };
  }

  // 3. Ampersand: "A & B"
  const ampMatch = artistStr.match(/^(.+?)\s+&\s+(.+)$/);
  if (ampMatch) return { main: ampMatch[1].trim(), feats: [ampMatch[2].trim()] };

  return { main: artistStr, feats: [] };
}

// Build a normalized track object from raw data
function buildTrack({ artist, title, cover, preview_url }) {
  const { main, feats } = parseFeaturing(artist || '');
  return {
    artist,                                 // full string for display
    mainArtist:       main,
    featArtists:      feats,                // string[]
    title:            title || '',
    cleanArtist:      cleanString(main),    // match only against main artist
    cleanFeatArtists: feats.map(cleanString), // string[]
    cleanTitle:       cleanString(title),
    cover:            cover || '',
    preview_url:      preview_url || null,
  };
}

function calcSpeedBonus(timeTaken) {
  if (timeTaken < 10) return 2;
  if (timeTaken < 20) return 1;
  return 0;
}

// ─── Cache mémoire générique ───────────────────────────────────────────────────
function makeCache(ttlMs) {
  let _data = null, _exp = 0;
  return {
    get()  { return _exp > Date.now() ? _data : null; },
    set(v) { _data = v; _exp = Date.now() + ttlMs; },
    clear(){ _exp = 0; },
  };
}
const _officialRoomsCache = makeCache(30_000);  // 30s — liste statique, online recalculé live
const _lbWeeklyCache      = makeCache(60_000);  // 60s
const _lbEloCache         = makeCache(60_000);  // 60s

// ─── REST API ─────────────────────────────────────────────────────────────────

// Liste des rooms officielles depuis la BDD (+ compte joueurs en ligne)
app.get('/api/rooms/official', async (req, res) => {
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
    // Online count toujours recalculé (état live)
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
  const cached = _lbWeeklyCache.get();
  if (cached) return res.json(cached);
  const { data, error } = await supabase.rpc('weekly_leaderboard');
  if (error) return res.status(500).json({ error: error.message });
  _lbWeeklyCache.set(data);
  res.json(data);
});

// Classement hebdomadaire par room
app.get('/api/leaderboard/weekly/room/:code', async (req, res) => {
  const { data, error } = await supabase.rpc('weekly_leaderboard_by_room', { p_room_code: req.params.code });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// Classement ELO global
app.get('/api/leaderboard/elo', async (req, res) => {
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

// ─── Spotify : Token Management ───────────────────────────────────────────────
let _spotifyToken = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify non configuré');

  const fetchFn = await getFetch();
  const res = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  
  if (!res.ok) throw new Error(`Spotify Auth Error ${res.status}`);
  const json = await res.json();
  _spotifyToken = json.access_token;
  _spotifyTokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return _spotifyToken;
}

// ─── Spotify : Search ─────────────────────────────────────────────────────────
app.get('/api/spotify/search', rateLimit(30, 60_000), async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: 'Paramètre q requis' });
  try {
    const token = await getSpotifyToken();
    const fetchFn = await getFetch();
    const params = new URLSearchParams({ q, type: 'track', limit: '10', market: 'FR' });
    const r = await fetchFn(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    res.json((data.tracks?.items || []).map(t => ({
      external_id: t.id,
      source: 'spotify',
      artist: t.artists.map(a => a.name).join(', '),
      title: t.name,
      preview_url: t.preview_url || null,
      cover_url: t.album.images[1]?.url || t.album.images[0]?.url || null,
    })));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Spotify : normalise un item playlist (supporte /items et métadonnées) ────
function normalizeSpotifyItem(i) {
  // /items endpoint → champ "item" ; métadonnées embarquées → champ "track"
  const t = i?.item ?? i?.track;
  if (!t?.id || t.type === 'episode' || i.is_local) return null;
  return {
    external_id: t.id,
    source:      'spotify',
    artist:      t.artists?.map(a => a.name).join(', ') || '?',
    title:       t.name,
    preview_url: t.preview_url || null,
    cover_url:   t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null,
  };
}

// ─── Spotify : Import USER (Login PKCE) ────────────────────────────────────────
app.get('/api/spotify/playlist-user/:id', rateLimit(10, 60_000), async (req, res) => {
  const userToken = req.headers['x-spotify-token'];
  const plId = req.params.id;
  if (!userToken) return res.status(400).json({ error: 'X-Spotify-Token manquant' });

  const fetchFn = await getFetch();

  try {
    // 1. Métadonnées complètes (sans fields= — inclut pl.tracks.items embarquées, champ "track")
    let plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      signal: AbortSignal.timeout(12000),
    });

    let currentToken = userToken;

    if (!plRes.ok) {
      if (plRes.status === 401) return res.status(401).json({ error: 'Token Spotify expiré — reconnecte-toi.' });
      if (plRes.status === 404) return res.status(404).json({ error: 'Playlist introuvable.' });
      // 403 : fallback Client Credentials (playlists publiques)
      console.warn(`[Spotify] metadata ${plRes.status} — fallback CC`);
      currentToken = await getSpotifyToken();
      plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!plRes.ok) return res.status(plRes.status).json({ error: 'Playlist inaccessible.' });
    }

    const pl    = await plRes.json();
    const total = pl.tracks?.total || 0;
    const embeddedItems = pl.tracks?.items || [];
    console.log(`Spotify metadata "${pl.name}": total=${total}, embedded=${embeddedItems.length}`);

    // 2. Pagination via /playlists/{id}/items (endpoint officiel, limite max=50, champ "item")
    let allItems  = [];
    let offset    = 0;
    let loopTotal = total > 0 ? total : 9999;
    let itemsOk   = true;

    while (allItems.length < Math.min(loopTotal, 1000)) {
      const tRes = await fetchFn(
        `https://api.spotify.com/v1/playlists/${plId}/items?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${currentToken}` }, signal: AbortSignal.timeout(12000) }
      );
      if (tRes.status === 429) {
        await new Promise(r => setTimeout(r, 2000)); continue;
      }
      if (!tRes.ok) {
        console.warn(`Spotify /items offset=${offset} → HTTP ${tRes.status} — fallback embedded`);
        itemsOk = false;
        break;
      }
      const page = await tRes.json();
      if (typeof page.total === 'number') loopTotal = Math.min(page.total, 1000);
      if (!page.items?.length) break;
      allItems = allItems.concat(page.items);
      offset += page.items.length;
      if (page.items.length < 50) break;
    }

    // Fallback : utiliser les pistes embarquées dans la réponse metadata si /items échoue
    const rawItems = itemsOk ? allItems : embeddedItems;
    console.log(`Spotify source: ${itemsOk ? '/items' : 'embedded'}, ${rawItems.length} items bruts`);

    const tracks = rawItems.map(normalizeSpotifyItem).filter(Boolean);

    console.log(`Spotify import "${pl.name}": ${tracks.length}/${loopTotal} pistes valides`);

    if (!tracks.length) {
      return res.status(422).json({ error: `Aucune piste récupérée (${rawItems.length} items bruts). La playlist est peut-être vide ou privée.` });
    }

    res.json({ name: pl.name, cover: pl.images?.[0]?.url || null, tracks, total: loopTotal, truncated: loopTotal > tracks.length });
  } catch (e) {
    console.error('Spotify user-import error:', e.message);
    res.status(502).json({ error: e.message });
  }
});


// ─── Spotify : Import PUBLIC (Lien direct, Client Credentials) ───────────────
app.get('/api/spotify/playlist/:id', rateLimit(10, 60_000), async (req, res) => {
  try {
    const token   = await getSpotifyToken();
    const fetchFn = await getFetch();
    const plId    = req.params.id;

    // Métadonnées complètes (inclut pl.tracks.items embarquées)
    const plRes = await fetchFn(`https://api.spotify.com/v1/playlists/${plId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!plRes.ok) throw new Error('Playlist introuvable ou privée');
    const pl    = await plRes.json();
    const total = pl.tracks?.total || 0;
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
      offset += page.items.length;
      if (page.items.length < 50) break;
    }

    const rawItems = itemsOk ? allItems : embeddedItems;
    const tracks = rawItems.map(normalizeSpotifyItem).filter(Boolean);

    res.json({ name: pl.name, cover: pl.images?.[0]?.url || null, tracks, total: loopTotal });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── Deezer : recherche de titres ────────────────────────────────────────────
app.get('/api/deezer/search', rateLimit(30, 60_000), async (req, res) => {
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
app.get('/api/deezer/playlist/:id', rateLimit(10, 60_000), async (req, res) => {
  try {
    const fetchFn = await getFetch();
    const headers = { 'User-Agent': 'ZIK-BlindTest/1.0' };
    const plId    = req.params.id;

    // Métadonnées uniquement (le paramètre ?limit est ignoré par Deezer sur ce endpoint)
    const r = await fetchFn(`https://api.deezer.com/playlist/${plId}`, {
      headers, signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Playlist introuvable');

    // nb_tracks = total réel, tracks.total = total des tracks paginées
    const total = data.nb_tracks || data.tracks?.total || 0;
    if (!total) throw new Error('Playlist vide ou privée');

    // Pagination complète via /tracks depuis le début (plus fiable que les embedded)
    let allTracks = [];
    while (allTracks.length < Math.min(total, 1000)) {
      const index = allTracks.length;
      const nextR = await fetchFn(`https://api.deezer.com/playlist/${plId}/tracks?index=${index}&limit=100`, {
        headers, signal: AbortSignal.timeout(10000),
      });
      if (!nextR.ok) break;
      const nextData = await nextR.json();
      if (nextData.error || !nextData.data?.length) break;
      allTracks = allTracks.concat(nextData.data);
      if (nextData.data.length < 100) break; // dernière page
    }

    if (!allTracks.length) throw new Error('Impossible de récupérer les titres (playlist vide ou privée)');

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

// ─── Playlists custom : suppression sécurisée ────────────────────────────────
app.delete('/api/playlists/:id', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Session invalide' });

  const plId = req.params.id;

  // Client avec JWT de l'utilisateur → auth.uid() correct côté Supabase (RLS)
  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // Vérifier l'ownership
  const { data: pl, error: plErr } = await userSupabase
    .from('custom_playlists').select('owner_id').eq('id', plId).single();
  if (plErr || !pl) return res.status(404).json({ error: 'Playlist introuvable' });
  if (pl.owner_id !== user.id) return res.status(403).json({ error: 'Non autorisé' });

  // Supprimer les tracks puis la playlist (RLS satisfaite grâce au JWT)
  await userSupabase.from('custom_playlist_tracks').delete().eq('playlist_id', plId);
  const { error } = await userSupabase.from('custom_playlists').delete().eq('id', plId);
  if (error) return res.status(400).json({ error: error.message });
  console.log(`Playlist ${plId} supprimée par ${user.email}`);
  res.json({ ok: true });
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

// ─── Stats : meilleurs scores par room officielle ─────────────────────────────
app.get('/api/stats/:userId', async (req, res) => {
  try {
    // Les deux requêtes en parallèle
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
      if (!bestByRoom[roomId] || row.score > bestByRoom[roomId]) {
        bestByRoom[roomId] = row.score;
      }
    });
    res.json({ bestByRoom, roomInfo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Spotify config status ────────────────────────────────────────────────────
app.get('/api/spotify/status', (req, res) => {
  res.json({ configured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) });
});

// ─── Admin : marquer une playlist comme officielle ────────────────────────────
app.post('/api/playlists/:id/official', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Session invalide' });

  // Vérifier le rôle super_admin en DB
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return res.status(403).json({ error: 'Super-admin uniquement' });

  // Client avec JWT utilisateur → satisfait RLS
  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { is_official, linked_room_id } = req.body || {};
  const { error } = await userSupabase.from('custom_playlists')
    .update({ is_official: !!is_official, linked_room_id: linked_room_id || null })
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });

  if (linked_room_id && is_official) delete playlistCache[linked_room_id];
  console.log(`Playlist ${req.params.id} marquée officielle → room "${linked_room_id}" par ${user.email}`);
  res.json({ ok: true });
});

// ─── Rooms persistantes (Supabase) ───────────────────────────────────────────

// Helper auth commun (utilise le cache JWT)
async function requireAuth(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Non authentifié' }); return null; }
  const user = await verifyToken(token);
  if (!user) { res.status(401).json({ error: 'Session invalide' }); return null; }
  return user;
}

function userClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// GET /api/rooms — rooms publiques (+ toutes si super_admin)
app.get('/api/rooms', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  let isSuperAdmin = false;

  if (token) {
    const user = await verifyToken(token);
    if (user) {
      // Rôle mis en cache dans le profil utilisateur (lecture légère)
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      isSuperAdmin = p?.role === 'super_admin';
    }
  }

  // Rooms publiques : pas besoin du JWT utilisateur pour la requête SELECT
  const sb = supabase;
  let query = sb.from('rooms')
    .select('id, code, name, emoji, description, is_public, max_rounds, round_duration, break_duration, last_active_at, owner_id, playlist_id, profiles!owner_id(username, avatar_url)')
    .order('last_active_at', { ascending: false })
    .limit(50);

  if (!isSuperAdmin) query = query.eq('is_public', true);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/rooms/mine — rooms de l'utilisateur connecté
app.get('/api/rooms/mine', async (req, res) => {
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

// GET /api/rooms/:code — info d'une room par son code
app.get('/api/rooms/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();

  // Vérifier d'abord dans les rooms éphémères en mémoire
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

// POST /api/rooms — créer une room
app.post('/api/rooms', rateLimit(10, 60_000), async (req, res) => {
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
      max_rounds:     Math.min(Math.max(parseInt(max_rounds) || 10, 3), 50),
      round_duration: Math.min(Math.max(parseInt(round_duration) || 30, 10), 60),
      break_duration: Math.min(Math.max(parseInt(break_duration) || 7, 3), 15),
    })
    .select('id, code, name, emoji')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  console.log(`Room "${data.code}" créée par ${user.email}`);
  res.json(data);
});

// PATCH /api/rooms/:id — modifier sa room
app.patch('/api/rooms/:id', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const token = req.headers.authorization.slice(7);

  const allowed = ['name', 'emoji', 'description', 'playlist_id', 'is_public', 'max_rounds', 'round_duration', 'break_duration'];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (updates.name) updates.name = String(updates.name).trim().slice(0, 60);

  const { error } = await userClient(token)
    .from('rooms').update(updates).eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /api/rooms/:id — supprimer sa room
app.delete('/api/rooms/:id', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const token = req.headers.authorization.slice(7);
  const { error } = await userClient(token)
    .from('rooms').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
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

app.post('/api/rooms/custom', rateLimit(5, 60_000), async (req, res) => {
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
    tracks:        tracks.map(t => buildTrack({
      artist:  String(t.artist || '').trim(),
      title:   String(t.title  || '').trim(),
      cover:   t.cover_url,
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
  if (roomGames[roomId]) {
    // Annuler le timer de cleanup si quelqu'un rejoint alors que la room etait vide
    if (roomGames[roomId]._emptyTimer) {
      clearTimeout(roomGames[roomId]._emptyTimer);
      roomGames[roomId]._emptyTimer = null;
    }
    return roomGames[roomId];
  }
  {
    const cust = customRooms[roomId] || dbRooms[roomId];
    roomGames[roomId] = {
      roomId,
      players: {},
      socketToName: {},
      nameToSocket: {},
      game: {
        isActive: false,
        currentRound: 0,
        maxRounds:     cust?.max_rounds || cust?.maxRounds || ROOMS[roomId]?.maxRounds || 10,
        roundDuration: cust?.round_duration || cust?.roundDuration || CONFIG.roundDuration,
        breakDuration: cust?.break_duration || cust?.breakDuration || CONFIG.breakDuration,
        timer: 0,
        interval: null,
        breakTimer: null,
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
    if (!username?.trim()) return socket.emit('error', 'Pseudo requis');
    // Vérifier l'existence de la room (officielle, éphémère, ou DB)
    if (!ROOMS[roomId] && !customRooms[roomId] && !dbRooms[roomId]) {
      // Tentative de chargement depuis Supabase
      const { data: dbRoom } = await supabase
        .from('rooms')
        .select('code, name, emoji, max_rounds, round_duration, break_duration, playlist_id')
        .eq('code', roomId)
        .single();
      if (dbRoom) {
        dbRooms[roomId] = dbRoom;
      } else {
        return socket.emit('error', 'Room inconnue ou expirée');
      }
    }

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
        foundArtist:       false,
        foundTitle:        false,
        foundFeats:        [],   // boolean[] — one entry per feat artist
        _fullFoundCounted: false,
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

    // Charger la playlist si pas encore cachée
    if (!playlistCache[roomId] && (ROOMS[roomId] || dbRooms[roomId])) {
      loadPlaylist(roomId)
        .then(tracks => {
          if (tracks.length > 0) socket.emit('track_count_update', tracks.length);
        })
        .catch(() => {});
    }
    const cust        = customRooms[roomId] || dbRooms[roomId];
    const officialRoom = ROOMS[roomId];
    socket.emit('room_joined', {
      roomId,
      roomConfig: officialRoom
        ? { ...officialRoom, trackCount: playlistCache[roomId]?.length || null }
        : {
            id: roomId,
            name: cust?.name,
            emoji: cust?.emoji,
            trackCount: customRooms[roomId]?.tracks?.length || playlistCache[roomId]?.length || null,
            maxRounds: cust?.max_rounds || cust?.maxRounds,
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

    // Un mot doit matcher ET représenter ≥ 50 % du contenu du champ (sinon trop facile)
    function wordMatch(input, target) {
      if (input.length < 2) return false;
      const totalLen = target.replace(/\s+/g, '').length || 1;
      const words = target.split(/\s+/).filter(w => w.length >= 2);
      return words.some(w =>
        stringSimilarity.compareTwoStrings(input, w) > 0.88 &&
        w.length / totalLen >= 0.50          // le mot doit couvrir ≥ 50 % du contenu
      );
    }
    const cover = track.cover || '';
    let hit = false;

    // Check artiste principal
    if (!user.foundArtist) {
      const match = input.length >= 1 && (
        simArtist > 0.75 ||
        (input.length >= 3 && simArtist > 0.65 && wordMatch(input, track.cleanArtist))
      );
      if (match) {
        user.foundArtist = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_artist', msg: `✅ Artiste ! (+${1 + speedBonus} pts)`, val: displayString(track.mainArtist || track.artist), cover });
        hit = true;
      } else if (simArtist > 0.50) {
        socket.emit('feedback', { type: 'close', msg: "🔥 Tu chauffes sur l'artiste !" });
        hit = true;
      }
    }

    // Check featuring artists (bonus, one at a time)
    for (let fi = 0; fi < track.cleanFeatArtists.length; fi++) {
      if (user.foundFeats[fi]) continue;
      const cleanFeat = track.cleanFeatArtists[fi];
      const simFeat = stringSimilarity.compareTwoStrings(input, cleanFeat);
      const matchFeat = input.length >= 1 && (
        simFeat > 0.75 ||
        (input.length >= 3 && simFeat > 0.65 && wordMatch(input, cleanFeat))
      );
      if (matchFeat) {
        user.foundFeats[fi] = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_feat', featIndex: fi, msg: `✅ Feat ! (+${1 + speedBonus} pts)`, val: displayString(track.featArtists[fi]), cover });
        hit = true;
        break; // only one feat revealed per guess
      } else if (simFeat > 0.50 && !hit) {
        socket.emit('feedback', { type: 'close', msg: '🔥 Tu chauffes sur le feat !' });
        hit = true;
      }
    }

    // Check titre
    if (!user.foundTitle) {
      const match = input.length >= 1 && (
        simTitle > 0.75 ||
        (input.length >= 3 && simTitle > 0.65 && wordMatch(input, track.cleanTitle))
      );
      if (match) {
        user.foundTitle = true;
        user.score += 1 + speedBonus;
        socket.emit('feedback', { type: 'success_title', msg: `✅ Titre ! (+${1 + speedBonus} pts)`, val: displayString(track.title), cover });
        hit = true;
      } else if (simTitle > 0.50 && !hit) {
        socket.emit('feedback', { type: 'close', msg: '🔥 Tu chauffes sur le titre !' });
        hit = true;
      }
    }

    if (!hit) socket.emit('feedback', { type: 'miss', msg: '❄️ Pas du tout...' });

    getRoomIO(roomId).emit('update_players', Object.values(room.players));

    // "Fully found" = main artist + all feats + title
    const allFeatsFound = track.cleanFeatArtists.every((_, i) => user.foundFeats[i]);
    const allMainFound  = user.foundArtist && user.foundTitle && allFeatsFound;
    if (allMainFound && !user._fullFoundCounted) {
      user._fullFoundCounted = true;
      if (!room.game.firstFullFinder) room.game.firstFullFinder = user.name;
      room.game.totalFullFound++;
      socket.emit('reveal_cover', { cover: room.game.currentTrack.cover });
    }

    checkEveryoneFound(roomId);
  });

  socket.on('disconnect', () => {
    if (socket.currentRoom) leaveRoom(socket, socket.currentRoom);
  });
});

function cleanupRoom(roomId) {
  const room = roomGames[roomId];
  if (!room) return;
  clearInterval(room.game.interval);
  clearTimeout(room.game.breakTimer);
  room.game.interval  = null;
  room.game.breakTimer = null;
  delete roomGames[roomId];
  console.log(`Room "${roomId}" libérée de la mémoire`);
}

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
        if (!roomGames[roomId]) return; // room déjà nettoyée
        delete room.players[name];
        const active = Object.values(room.players).filter(p => !p._dcTimer);
        getRoomIO(roomId).emit('update_players', active);

        if (active.length === 0) {
          // Stopper la partie si personne ne reste
          if (room.game.isActive) {
            clearInterval(room.game.interval);
            clearTimeout(room.game.breakTimer);
            room.game.interval    = null;
            room.game.breakTimer  = null;
            room.game.isActive    = false;
            console.log(`Room "${roomId}" vide — partie stoppee`);
          }
          // Rooms ephemeres : cleanup apres 15 min
          // Rooms DB/officielles : liberer maintenant (elles se rechargent au besoin)
          if (customRooms[roomId]) {
            room._emptyTimer = setTimeout(() => cleanupRoom(roomId), 15 * 60 * 1000);
          } else {
            cleanupRoom(roomId);
          }
        }
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
      videoId:      video.videoId,
      startSeconds: safeStart,
      round:        game.currentRound,
      total:        game.maxRounds,
      featCount:    game.currentTrack.featArtists.length,
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
  const track = room.game.currentTrack;
  const activePlayers = Object.values(room.players);
  const allDone = p => {
    const allFeats = (track?.cleanFeatArtists || []).every((_, i) => p.foundFeats[i]);
    return p.foundArtist && p.foundTitle && allFeats;
  };
  if (activePlayers.length > 0 && activePlayers.every(allDone) && room.game.isActive) {
    endRound(roomId, '🎉 Tout le monde a trouvé !');
  }
}

function endRound(roomId, reason) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;
  clearInterval(game.interval);
  game.isActive = false;

  const summary = {
    answer:      `${displayString(game.currentTrack.artist)} - ${displayString(game.currentTrack.title)}`,
    cover:       game.currentTrack.cover,
    reason,
    firstFinder:  game.firstFullFinder,
    totalFound:   game.totalFullFound,
    featArtists:  (game.currentTrack.featArtists || []).map(displayString),
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
        foundFeats:  p.foundFeats || [],
      });
    }
  });

  game.breakTimer = setTimeout(() => {
    game.breakTimer = null;
    startNextRound(roomId);
  }, game.breakDuration * 1000);
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
    room.players[n].foundArtist       = false;
    room.players[n].foundTitle        = false;
    room.players[n].foundFeats        = [];
    room.players[n]._fullFoundCounted = false;
  });
}

function resetScores(room) {
  Object.keys(room.players).forEach(n => room.players[n].score = 0);
  getRoomIO(room.roomId).emit('update_players', Object.values(room.players));
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 ZIK → http://localhost:${PORT}`));

'use strict';

const { supabase }          = require('../config');
const { playlistCache, customRooms, dbRooms } = require('../state');
const { fetchDeezerPlaylist } = require('./deezer');
const ROOMS = require('../../rooms');

// ─── String helpers ───────────────────────────────────────────────────────────

function cleanString(str) {
  if (!str) return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ *\([^)]*\) */g, '').replace(/ *\[[^\]]*\] */g, '')
    .replace(/[''`]/g, "'").replace(/[-\u2013\u2014]/g, ' ')
    .trim().toLowerCase();
}

// Strips parenthetical/bracket content for UI reveal
// e.g. "Savage (feat. Beyonce)" -> "Savage"
function displayString(str) {
  if (!str) return '';
  return str
    .replace(/ *\([^)]*\) */g, ' ')
    .replace(/ *\[[^\]]*\] */g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract main artist and featuring artists from an artist string.
// Returns { main: string, feats: string[] }.
// Handles: "A feat. B & C", "A (feat. B, C)", "A, B, C" (Spotify), "A & B"
function parseFeaturing(artistStr) {
  if (!artistStr) return { main: '', feats: [] };

  // 1. feat./ft./featuring (parenthetical or inline)
  const m = artistStr.match(
    /^(.+?)(?:\s*\((?:feat\.?|ft\.?|featuring)\s+([^)]+)\)|\s+(?:feat\.?|ft\.?|featuring)\s+(.+))$/i
  );
  if (m) {
    const featStr = (m[2] || m[3]).trim();
    const feats   = featStr.split(/\s*(?:,|&)\s*/).map(s => s.trim()).filter(Boolean);
    return { main: m[1].trim(), feats };
  }

  // 2. Comma-separated (Spotify multi-artist)
  const commaParts = artistStr.split(', ').map(s => s.trim()).filter(Boolean);
  if (commaParts.length > 1) return { main: commaParts[0], feats: commaParts.slice(1) };

  // 3. Ampersand: "A & B"
  const ampMatch = artistStr.match(/^(.+?)\s+&\s+(.+)$/);
  if (ampMatch) return { main: ampMatch[1].trim(), feats: [ampMatch[2].trim()] };

  return { main: artistStr, feats: [] };
}

function buildTrack({ artist, title, cover, preview_url }) {
  const { main, feats } = parseFeaturing(artist || '');
  return {
    artist,
    mainArtist:       main,
    featArtists:      feats,
    title:            title || '',
    cleanArtist:      cleanString(main),
    cleanFeatArtists: feats.map(cleanString),
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

// ─── Generic TTL cache factory ────────────────────────────────────────────────
function makeCache(ttlMs) {
  let _data = null, _exp = 0;
  return {
    get()   { return _exp > Date.now() ? _data : null; },
    set(v)  { _data = v; _exp = Date.now() + ttlMs; },
    clear() { _exp = 0; },
  };
}

// ─── Playlist loading ─────────────────────────────────────────────────────────

async function loadPlaylist(roomId) {
  // Ephemeral custom rooms: tracks already in memory
  if (customRooms[roomId]) return customRooms[roomId].tracks;

  if (playlistCache[roomId]?.length > 0) return playlistCache[roomId];

  // DB rooms: load from custom_playlist_tracks via playlist_id
  const dbRoom = dbRooms[roomId];
  if (dbRoom?.playlist_id) {
    try {
      const { data: trackRows } = await supabase
        .from('custom_playlist_tracks')
        .select('artist, title, cover_url, preview_url')
        .eq('playlist_id', dbRoom.playlist_id)
        .order('position');
      if (trackRows?.length >= 3) {
        const tracks = trackRows.map(t => buildTrack({
          artist: t.artist, title: t.title, cover: t.cover_url, preview_url: t.preview_url,
        }));
        playlistCache[roomId] = tracks;
        console.log(`Room DB "${roomId}": ${tracks.length} titres charges`);
        return tracks;
      }
    } catch { /* fallback below */ }
    return [];
  }

  const room = ROOMS[roomId];
  if (!room) return [];

  // 1. Check for an official Supabase playlist linked to this room
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
        const tracks = trackRows.map(t => buildTrack({
          artist: t.artist, title: t.title, cover: t.cover_url, preview_url: t.preview_url,
        }));
        playlistCache[roomId] = tracks;
        console.log(`Room "${roomId}" (playlist Supabase officielle): ${tracks.length} titres`);
        return tracks;
      }
    }
  } catch { /* fallback to Deezer */ }

  // 2. Fallback: Deezer playlist configured in rooms.js
  const ids = room.playlist_ids || (room.playlist_id ? [room.playlist_id] : []);
  if (!ids.length) {
    console.error(`Room "${roomId}": aucun playlist_id configure`);
    return [];
  }

  for (const pid of ids) {
    try {
      const data   = await fetchDeezerPlaylist(pid);
      const tracks = data.tracks.data
        .filter(t => t.readable !== false)
        .map(t => buildTrack({ artist: t.artist.name, title: t.title, cover: t.album.cover_xl || t.album.cover_big }));

      if (tracks.length < 5) throw new Error(`Seulement ${tracks.length} titres lisibles`);

      playlistCache[roomId] = tracks;
      console.log(`Room "${roomId}" (Deezer ${pid}): ${tracks.length} titres — "${data.title}"`);
      return tracks;
    } catch (err) {
      console.warn(`Room "${roomId}" playlist ${pid} KO: ${err.message}`);
    }
  }

  console.error(`Room "${roomId}": toutes les playlists ont echoue`);
  return [];
}

async function preloadAllPlaylists() {
  console.log('Prechargement des playlists Deezer...');
  const results = await Promise.allSettled(Object.keys(ROOMS).map(id => loadPlaylist(id)));
  const ok  = results.filter(r => r.status === 'fulfilled' && r.value?.length > 0).length;
  const ko  = results.length - ok;
  console.log(`Playlists: ${ok}/${results.length} OK${ko ? ` — ${ko} en erreur` : ''}`);
}

module.exports = {
  cleanString,
  displayString,
  parseFeaturing,
  buildTrack,
  calcSpeedBonus,
  makeCache,
  loadPlaylist,
  preloadAllPlaylists,
};

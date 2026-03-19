import { supabase } from "../config.js";
import { playlistCache, customRooms, dbRooms } from "../state.js";
import { fetchDeezerPlaylist } from "./deezer.js";

// ─── String helpers ───────────────────────────────────────────────────────────

export function cleanString(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ *\([^)]*\) */g, "")
    .replace(/ *\[[^\]]*\] */g, "")
    .replace(/[''`]/g, "'")
    .replace(/[-\u2013\u2014]/g, " ")
    .trim()
    .toLowerCase();
}

export function displayString(str) {
  if (!str) return "";
  return str
    .replace(/ *\([^)]*\) */g, " ")
    .replace(/ *\[[^\]]*\] */g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFeaturing(artistStr) {
  if (!artistStr) return { main: "", feats: [] };

  // 1. Explicit feat keyword in parentheses: "Artist (feat. X, Y)"
  const mParen = artistStr.match(
    /^(.+?)\s*\((?:feat\.?|ft\.?|featuring|with|avec)\s+([^)]+)\)\s*$/i,
  );
  if (mParen) {
    const feats = mParen[2]
      .split(/\s*[,&]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { main: mParen[1].trim(), feats };
  }

  // 2. Explicit feat keyword without parentheses: "Artist feat. X & Y"
  const mFeat = artistStr.match(
    /^(.+?)\s+(?:feat\.?|ft\.?|featuring|with|avec)\s+(.+)$/i,
  );
  if (mFeat) {
    const feats = mFeat[2]
      .split(/\s*[,&]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { main: mFeat[1].trim(), feats };
  }

  // 3. Comma-separated artists (Spotify format: "Artist1, Artist2, Artist3")
  //    Only split if 3+ artists, or exactly 2 but neither contains & (to avoid
  //    splitting duo names like "Earth, Wind & Fire" incorrectly won't appear
  //    since the comma format is from APIs that list separate artists).
  //    Require 2+ artists without & in either part to be safe.
  const commaParts = artistStr
    .split(", ")
    .map((s) => s.trim())
    .filter(Boolean);
  if (commaParts.length >= 3) {
    return { main: commaParts[0], feats: commaParts.slice(1) };
  }
  if (
    commaParts.length === 2 &&
    !commaParts[0].includes("&") &&
    !commaParts[1].includes("&")
  ) {
    return { main: commaParts[0], feats: [commaParts[1]] };
  }

  // 4. No feat found — treat the whole string as one artist
  //    (handles duos like "Bigflo & Oli", "Macklemore & Ryan Lewis")
  return { main: artistStr, feats: [] };
}

export function buildTrack({ artist, title, cover, preview_url }) {
  const { main, feats } = parseFeaturing(artist || "");
  return {
    artist,
    mainArtist: main,
    featArtists: feats,
    title: title || "",
    cleanArtist: cleanString(main),
    cleanFeatArtists: feats.map(cleanString),
    cleanTitle: cleanString(title),
    cover: cover || "",
    preview_url: preview_url || null,
  };
}

export function calcSpeedBonus(timeTaken) {
  if (timeTaken < 10) return 2;
  if (timeTaken < 20) return 1;
  return 0;
}

export function makeCache(ttlMs) {
  let _data = null,
    _exp = 0;
  return {
    get() {
      return _exp > Date.now() ? _data : null;
    },
    set(v) {
      _data = v;
      _exp = Date.now() + ttlMs;
    },
    clear() {
      _exp = 0;
    },
  };
}

// ─── Playlist loading ─────────────────────────────────────────────────────────

export async function loadPlaylist(roomId) {
  if (customRooms[roomId]) return customRooms[roomId].tracks;
  if (playlistCache[roomId]?.length > 0) return playlistCache[roomId];

  const dbRoom = dbRooms[roomId];
  if (dbRoom?.playlist_id) {
    try {
      const { data: trackRows } = await supabase
        .from("custom_playlist_tracks")
        .select("artist, title, cover_url, preview_url")
        .eq("playlist_id", dbRoom.playlist_id)
        .order("position");
      if (trackRows?.length >= 3) {
        const tracks = trackRows.map((t) =>
          buildTrack({
            artist: t.artist,
            title: t.title,
            cover: t.cover_url,
            preview_url: t.preview_url,
          }),
        );
        playlistCache[roomId] = tracks;
        console.log(`Room DB "${roomId}": ${tracks.length} titres charges`);
        return tracks;
      }
    } catch {
      /* fallback below */
    }
    return [];
  }

  console.warn(`Room "${roomId}": aucun fallback disponible`);
  return [];
}

export async function preloadAllPlaylists() {
  console.log("Prechargement des playlists...");
  try {
    const { data: dbRoomsList } = await supabase
      .from("rooms")
      .select(
        "code, name, emoji, max_rounds, round_duration, break_duration, playlist_id",
      )
      .not("playlist_id", "is", null);
    if (!dbRoomsList?.length) {
      console.log("Aucune room DB avec playlist configuree.");
      return;
    }
    dbRoomsList.forEach((r) => {
      dbRooms[r.code] = r;
    });
    const results = await Promise.allSettled(
      dbRoomsList.map((r) => loadPlaylist(r.code)),
    );
    const ok = results.filter(
      (r) => r.status === "fulfilled" && r.value?.length > 0,
    ).length;
    const ko = results.length - ok;
    console.log(
      `Playlists: ${ok}/${results.length} OK${ko ? ` — ${ko} en erreur` : ""}`,
    );
  } catch (e) {
    console.error("Erreur prechargement:", e.message);
  }
}

import { supabase, getAdminClient } from "../config.js";
import { playlistCache, customRooms, dbRooms } from "../state.js";
import {
  fetchDeezerPlaylist,
  fetchDeezerTrackPreview,
  iTunesPreviewSearch,
  parseExpFromUrl,
} from "./deezer.js";

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

export function buildTrack({
  artist,
  title,
  cover,
  preview_url,
  custom_artist,
  custom_title,
  custom_feats,
  extraAnswers,
}) {
  const effectiveArtist = custom_artist || artist;
  const { main, feats: parsedFeats } = parseFeaturing(effectiveArtist || "");
  const effectiveFeats = Array.isArray(custom_feats)
    ? custom_feats
    : parsedFeats;
  const effectiveTitle = custom_title || title || "";
  const extras = (extraAnswers || []).map((e) => ({
    label: e.label,
    value: e.value,
    clean: cleanString(e.value),
  }));
  return {
    artist: effectiveArtist,
    mainArtist: main,
    featArtists: effectiveFeats,
    title: effectiveTitle,
    cleanArtist: cleanString(main),
    cleanFeatArtists: effectiveFeats.map(cleanString),
    cleanTitle: cleanString(effectiveTitle),
    cover: cover || "",
    preview_url: preview_url || null,
    extraAnswers: extras,
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

// ─── Deezer preview refresh ───────────────────────────────────────────────────

const PREVIEW_REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours de marge
const PREVIEW_PERMANENT_EXPIRY = "2099-01-01T00:00:00.000Z"; // iTunes & URLs sans token
const REFRESH_CONCURRENCY = 8;

export async function refreshExpiredPreviews(trackRows) {
  const now = Date.now();

  const toRefresh = trackRows.filter((t) => {
    if (!t.preview_url) return false;
    const expiresAt = t.preview_expires_at
      ? new Date(t.preview_expires_at).getTime()
      : (parseExpFromUrl(t.preview_url) ?? 0) * 1000;
    return expiresAt < now + PREVIEW_REFRESH_MARGIN_MS;
  });

  if (!toRefresh.length) return;

  console.log(`Refresh preview_url: ${toRefresh.length} tracks expirées...`);
  let updated = 0;

  for (let i = 0; i < toRefresh.length; i += REFRESH_CONCURRENCY) {
    const batch = toRefresh.slice(i, i + REFRESH_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (t) => {
        try {
          let freshUrl = t.external_id
            ? await fetchDeezerTrackPreview(t.external_id)
            : null;

          if (!freshUrl) {
            const artist = t.custom_artist || t.artist;
            const title = t.custom_title || t.title;
            freshUrl = await iTunesPreviewSearch(artist, title);
          }

          if (!freshUrl) return;

          const exp = parseExpFromUrl(freshUrl);
          await getAdminClient()
            .from("custom_playlist_tracks")
            .update({
              preview_url: freshUrl,
              preview_expires_at: exp
                ? new Date(exp * 1000).toISOString()
                : PREVIEW_PERMANENT_EXPIRY,
            })
            .eq("id", t.id);
          t.preview_url = freshUrl;
          updated++;
        } catch {
          /* skip */
        }
      }),
    );
  }

  console.log(
    `Refresh terminé: ${updated}/${toRefresh.length} tracks mises à jour`,
  );
}

// ─── Playlist loading ─────────────────────────────────────────────────────────

export async function loadPlaylist(roomId) {
  if (customRooms[roomId]) return customRooms[roomId].tracks;
  if (playlistCache[roomId]?.length > 0) return playlistCache[roomId];

  const dbRoom = dbRooms[roomId];
  if (!dbRoom) {
    console.warn(`Room "${roomId}": aucun fallback disponible`);
    return [];
  }

  // Essayer d'abord room_playlists (multi-playlist)
  try {
    const { data: links } = await supabase
      .from("room_playlists")
      .select("playlist_id, position")
      .eq("room_id", dbRoom.id)
      .order("position");

    if (links?.length > 0) {
      const playlistIds = links.map((l) => l.playlist_id);
      const { data: trackRows } = await supabase
        .from("custom_playlist_tracks")
        .select(
          "id, artist, title, cover_url, preview_url, external_id, source, preview_expires_at, custom_artist, custom_title",
        )
        .in("playlist_id", playlistIds)
        .order("position");

      if (trackRows?.length >= 3) {
        await refreshExpiredPreviews(trackRows);
        const tracks = trackRows.map((t) =>
          buildTrack({
            artist: t.artist,
            title: t.title,
            cover: t.cover_url,
            preview_url: t.preview_url,
          }),
        );
        playlistCache[roomId] = tracks;
        console.log(
          `Room DB "${roomId}": ${tracks.length} titres chargés (${playlistIds.length} playlist(s))`,
        );
        return tracks;
      }
    }
  } catch {
    /* fallback vers playlist_id legacy */
  }

  // Fallback : playlist_id unique (legacy)
  if (dbRoom.playlist_id) {
    try {
      const { data: trackRows } = await supabase
        .from("custom_playlist_tracks")
        .select(
          "id, artist, title, cover_url, preview_url, external_id, source, preview_expires_at, custom_artist, custom_title, custom_feats, track_answers(value, answer_types(name))",
        )
        .eq("playlist_id", dbRoom.playlist_id)
        .order("position");
      if (trackRows?.length >= 3) {
        await refreshExpiredPreviews(trackRows);
        const tracks = trackRows.map((t) =>
          buildTrack({
            artist: t.artist,
            title: t.title,
            cover: t.cover_url,
            preview_url: t.preview_url,
            custom_artist: t.custom_artist || null,
            custom_title: t.custom_title || null,
            custom_feats: t.custom_feats || null,
            extraAnswers: (t.track_answers || []).map((a) => ({
              label: a.answer_types?.name || "",
              value: a.value,
            })),
          }),
        );
        playlistCache[roomId] = tracks;
        console.log(
          `Room DB "${roomId}": ${tracks.length} titres chargés (legacy)`,
        );
        return tracks;
      }
    } catch {
      /* rien */
    }
    return [];
  }

  console.warn(`Room "${roomId}": aucune playlist configurée`);
  return [];
}

export async function preloadAllPlaylists() {
  console.log("Prechargement des playlists...");
  try {
    const { data: dbRoomsList } = await supabase
      .from("rooms")
      .select(
        "id, code, name, emoji, max_rounds, round_duration, break_duration, playlist_id",
      );
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

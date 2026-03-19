import { json } from "@sveltejs/kit";
import { customRooms, roomGames } from "$lib/server/state.js";
import { buildTrack } from "$lib/server/services/playlist.js";
import { checkRateLimit } from "$lib/server/middleware/auth.js";

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  } while (customRooms[code]);
  return code;
}

export async function POST({ request }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  checkRateLimit(ip, 5, 60_000);

  const {
    name,
    emoji,
    tracks,
    maxRounds = 10,
    roundDuration = 30,
    breakDuration = 7,
  } = await request.json();
  if (!name?.trim() || !Array.isArray(tracks) || tracks.length < 3) {
    return json({ error: "name et au moins 3 tracks requis" }, { status: 400 });
  }

  const code = genRoomCode();
  const rd = Math.min(Math.max(parseInt(roundDuration) || 30, 10), 60);
  const bd = Math.min(Math.max(parseInt(breakDuration) || 7, 3), 15);
  const mr = Math.min(Math.max(parseInt(maxRounds) || 10, 3), tracks.length);

  customRooms[code] = {
    id: code,
    name: String(name).trim().slice(0, 60),
    emoji: emoji || "🎵",
    tracks: tracks
      .map((t) =>
        buildTrack({
          artist: String(t.artist || "").trim(),
          title: String(t.title || "").trim(),
          cover: t.cover_url,
          preview_url: t.preview_url,
        }),
      )
      .filter((t) => t.artist && t.title),
    maxRounds: mr,
    roundDuration: rd,
    breakDuration: bd,
  };

  setTimeout(
    () => {
      delete customRooms[code];
      delete roomGames[code];
    },
    4 * 60 * 60 * 1000,
  );

  return json({ code });
}

import { json } from "@sveltejs/kit";
import { customRooms } from "$lib/server/state.js";

export function GET({ params }) {
  const room = customRooms[params.code.toUpperCase()];
  if (!room)
    return json({ error: "Room introuvable ou expir\u00e9e" }, { status: 404 });
  return json({
    name: room.name,
    emoji: room.emoji,
    maxRounds: room.maxRounds,
    trackCount: room.tracks.length,
  });
}

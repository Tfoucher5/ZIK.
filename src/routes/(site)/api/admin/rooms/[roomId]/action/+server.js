import { error, json } from "@sveltejs/kit";
import { verifyToken, logAdminAction } from "$lib/server/middleware/auth.js";
import { getAdminClient } from "$lib/server/config.js"; // pour vérifier le rôle
import {
  adminPauseRoom,
  adminResumeRoom,
  adminSkipRound,
  adminEndGame,
  adminKickPlayer,
  adminBlockRoom,
  adminUnblockRoom,
  adminAnnounce,
  adminCloseRoom,
  adminSendChat,
} from "$lib/server/socket/game.js";

const ALLOWED_ACTIONS = [
  "pause",
  "resume",
  "skip_round",
  "end_game",
  "kick",
  "block",
  "unblock",
  "announce",
  "close_room",
  "chat",
];

export async function POST({ request, params }) {
  const body = await request.json();
  const token = body._token;
  if (!token) throw error(403, "Token manquant");

  const user = await verifyToken(token);
  if (!user) throw error(403, "Token invalide");

  const sb = getAdminClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") throw error(403, "Accès refusé");

  const { action, username } = body;
  if (!ALLOWED_ACTIONS.includes(action)) throw error(400, "Action invalide");

  const roomId = params.roomId;
  let ok = false;

  switch (action) {
    case "pause":
      ok = adminPauseRoom(roomId);
      break;
    case "resume":
      ok = adminResumeRoom(roomId);
      break;
    case "skip_round":
      ok = adminSkipRound(roomId);
      break;
    case "end_game":
      ok = adminEndGame(roomId);
      break;
    case "kick":
      if (!username) throw error(400, "username requis");
      ok = adminKickPlayer(roomId, username);
      break;
    case "block":
      ok = adminBlockRoom(roomId);
      break;
    case "unblock":
      ok = adminUnblockRoom(roomId);
      break;
    case "announce":
      ok = adminAnnounce(roomId, body.message);
      break;
    case "close_room":
      ok = adminCloseRoom(roomId);
      break;
    case "chat":
      ok = adminSendChat(roomId, body.message, profile?.username);
      break;
  }

  if (ok) {
    await logAdminAction(user.id, `room_${action}`, null, "room", {
      roomId,
      username: username ?? null,
    });
  }

  return json({ success: ok });
}

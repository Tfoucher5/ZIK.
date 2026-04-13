import { error } from "@sveltejs/kit";
import { verifyToken } from "$lib/server/middleware/auth.js";
import { getAdminClient } from "$lib/server/config.js";

export async function GET({ url, request }) {
  const token = url.searchParams.get("token");
  if (!token) throw error(403, "Token manquant");

  const user = await verifyToken(token);
  if (!user) throw error(403, "Token invalide");

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") throw error(403, "Accès refusé");

  const stream = new ReadableStream({
    start(controller) {
      function push() {
        const roomGames = Object.entries(globalThis.__zik_roomGames ?? {}).map(
          ([roomId, g]) => ({
            roomId,
            players: Object.keys(g.socketToName ?? {}).length,
            round: g.currentRound ?? 0,
            maxRounds: g.maxRounds ?? 0,
            state: g.state ?? "unknown",
          }),
        );

        const salonRooms = Object.entries(
          globalThis.__zik_salonRooms ?? {},
        ).map(([code, s]) => ({
          code,
          host: s.hostName ?? "?",
          players: (s.players ?? []).length,
          state: s.game?.state ?? s.state ?? "lobby",
        }));

        const totalConnected =
          roomGames.reduce((sum, r) => sum + r.players, 0) +
          salonRooms.reduce((sum, s) => sum + s.players, 0);

        const payload = JSON.stringify({
          roomGames,
          salonRooms,
          totalConnected,
          ts: Date.now(),
        });
        controller.enqueue(`data: ${payload}\n\n`);
      }

      push();
      const interval = setInterval(push, 2000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { error } from "@sveltejs/kit";
import { verifyToken } from "$lib/server/middleware/auth.js";
import { getAdminClient } from "$lib/server/config.js";
import { adminGetRoomsSnapshot } from "$lib/server/socket/game.js";

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
        const rooms = adminGetRoomsSnapshot();
        const payload = JSON.stringify({ rooms, ts: Date.now() });
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

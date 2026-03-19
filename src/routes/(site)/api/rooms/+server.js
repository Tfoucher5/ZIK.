import { json } from "@sveltejs/kit";
import { supabase } from "$lib/server/config.js";
import {
  requireAuth,
  verifyToken,
  userClient,
  checkRateLimit,
} from "$lib/server/middleware/auth.js";

export async function GET({ request }) {
  const token = request.headers.get("authorization")?.slice(7);
  let isSuperAdmin = false;

  if (token) {
    const user = await verifyToken(token);
    if (user) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isSuperAdmin = p?.role === "super_admin";
    }
  }

  let query = supabase
    .from("rooms")
    .select(
      "id, code, name, emoji, description, is_public, max_rounds, round_duration, break_duration, last_active_at, owner_id, playlist_id, profiles!owner_id(username, avatar_url)",
    )
    .order("last_active_at", { ascending: false })
    .limit(50);

  if (!isSuperAdmin) query = query.eq("is_public", true);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, { status: 400 });
  return json(data);
}

export async function POST({ request }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  checkRateLimit(ip, 10, 60_000);
  const { user, token } = await requireAuth(request);

  const body = await request.json();
  const {
    name,
    emoji,
    description,
    playlist_id,
    is_public,
    max_rounds,
    round_duration,
    break_duration,
    auto_start,
  } = body || {};
  if (!name?.trim()) return json({ error: "name requis" }, { status: 400 });

  const { data, error } = await userClient(token)
    .from("rooms")
    .insert({
      name: String(name).trim().slice(0, 60),
      emoji: emoji || "🎵",
      description: String(description || "").slice(0, 200),
      owner_id: user.id,
      playlist_id: playlist_id || null,
      is_public: is_public !== false,
      auto_start: auto_start === true,
      max_rounds: Math.min(Math.max(parseInt(max_rounds) || 10, 3), 50),
      round_duration: Math.min(
        Math.max(parseInt(round_duration) || 30, 10),
        60,
      ),
      break_duration: Math.min(Math.max(parseInt(break_duration) || 7, 3), 15),
    })
    .select("id, code, name, emoji")
    .single();

  if (error) return json({ error: error.message }, { status: 400 });
  return json(data);
}

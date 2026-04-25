import { supabase } from "$lib/server/config.js";
import { error } from "@sveltejs/kit";

export async function load({ params }) {
  const code = params.code.toUpperCase();

  const { data: room } = await supabase
    .from("rooms")
    .select(
      "code, name, emoji, description, is_public, is_official, game_mode, last_active_at, profiles!owner_id(username)",
    )
    .eq("code", code)
    .eq("is_public", true)
    .single();

  if (!room) throw error(404, "Room introuvable ou privée");

  return { room };
}

import { createClient } from "@supabase/supabase-js";
import { error } from "@sveltejs/kit";
import { supabase, getAdminClient } from "../config.js";

// ─── JWT token cache (avoids a Supabase round-trip per request) ──────────────
const _tokenCache = new Map(); // token -> { user, exp }
const TOKEN_TTL = 60_000;

export async function verifyToken(token) {
  const cached = _tokenCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.user;
  const {
    data: { user },
    error: err,
  } = await supabase.auth.getUser(token);
  if (err || !user) return null;
  _tokenCache.set(token, { user, exp: Date.now() + TOKEN_TTL });
  return user;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _tokenCache.entries())
    if (v.exp < now) _tokenCache.delete(k);
}, 60_000);

// ─── In-memory rate limiter ───────────────────────────────────────────────────
const _rl = new Map(); // ip -> { count, resetAt }

export function checkRateLimit(ip, max, windowMs) {
  const now = Date.now();
  const e = _rl.get(ip);
  if (!e || e.resetAt < now) {
    _rl.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (e.count >= max)
    throw error(429, "Trop de requetes, reessaie dans un instant.");
  e.count++;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rl.entries()) if (v.resetAt < now) _rl.delete(k);
}, 60_000);

// ─── Route helpers ────────────────────────────────────────────────────────────

export async function requireAuth(request) {
  const token = request.headers.get("authorization")?.slice(7);
  if (!token) throw error(401, "Non authentifie");
  const user = await verifyToken(token);
  if (!user) throw error(401, "Session invalide");
  return { user, token };
}

export function userClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function requireAdmin(request) {
  const formData = await request.formData();
  const token = formData.get("_token");
  if (!token) throw error(403, "Token manquant");

  const user = await verifyToken(token);
  if (!user) throw error(403, "Token invalide");

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") throw error(403, "Accès refusé");

  return { adminUser: user, formData };
}

export async function logAdminAction(
  adminId,
  action,
  targetId,
  targetType,
  payload = {},
) {
  await getAdminClient()
    .from("admin_audit_log")
    .insert({
      admin_id: adminId,
      action,
      target_id: targetId,
      target_type: targetType,
      payload,
    });
}

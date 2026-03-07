'use strict';

const { createClient } = require('@supabase/supabase-js');
const { supabase } = require('../config');

// ─── JWT token cache (avoids a Supabase round-trip per request) ──────────────
const _tokenCache = new Map(); // token -> { user, exp }
const TOKEN_TTL   = 60_000;   // 60s

async function verifyToken(token) {
  const cached = _tokenCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.user;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  _tokenCache.set(token, { user, exp: Date.now() + TOKEN_TTL });
  return user;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _tokenCache.entries()) if (v.exp < now) _tokenCache.delete(k);
}, 60_000);

// ─── In-memory rate limiter ───────────────────────────────────────────────────
const _rl = new Map(); // ip -> { count, resetAt }

function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const e   = _rl.get(ip);
    if (!e || e.resetAt < now) { _rl.set(ip, { count: 1, resetAt: now + windowMs }); return next(); }
    if (e.count >= max) return res.status(429).json({ error: 'Trop de requetes, reessaie dans un instant.' });
    e.count++;
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rl.entries()) if (v.resetAt < now) _rl.delete(k);
}, 60_000);

// ─── Route helpers ────────────────────────────────────────────────────────────

async function requireAuth(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Non authentifie' }); return null; }
  const user = await verifyToken(token);
  if (!user) { res.status(401).json({ error: 'Session invalide' }); return null; }
  return user;
}

function userClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

module.exports = { verifyToken, rateLimit, requireAuth, userClient };

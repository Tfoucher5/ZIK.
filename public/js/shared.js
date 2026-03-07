'use strict';

// ─── ZIK shared utilities ─────────────────────────────────────────────────────
// Loaded on every page that uses auth/nav. Requires:
//   - /config.js  (sets window.ZIK_SUPABASE_URL etc.)
//   - Supabase CDN (sets window.supabase)

// ─── XSS-safe escaping ───────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Error display ────────────────────────────────────────────────────────────
function showErr(el, msg) {
  el.textContent  = msg;
  el.style.display = 'block';
}

// ─── Default avatar (DiceBear initials) ──────────────────────────────────────
function dicebear(name) {
  return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
}

// ─── Profile cache (sessionStorage, TTL 5 min) ───────────────────────────────
const PROFILE_TTL = 5 * 60 * 1000;

function getCachedProfile(uid) {
  try {
    const raw = sessionStorage.getItem('zik_profile_' + uid);
    if (!raw) return null;
    const { p, ts } = JSON.parse(raw);
    if (Date.now() - ts > PROFILE_TTL) { sessionStorage.removeItem('zik_profile_' + uid); return null; }
    return p;
  } catch { return null; }
}

function setCachedProfile(uid, profile) {
  try { sessionStorage.setItem('zik_profile_' + uid, JSON.stringify({ p: profile, ts: Date.now() })); } catch {}
}

function clearCachedProfile(uid) {
  try { if (uid) sessionStorage.removeItem('zik_profile_' + uid); } catch {}
}

// ─── Nav helpers ──────────────────────────────────────────────────────────────
function showNavUser(name, avatar) {
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('nav-username').textContent = name;
  const img = document.getElementById('nav-avatar');
  if (avatar && img) img.src = avatar;
}

function showNavAuth() {
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
}

function bindNavDropdown() {
  const trigger  = document.getElementById('nav-profile-trigger');
  const dropdown = document.getElementById('nav-dropdown');
  if (trigger && dropdown) {
    trigger.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }
}

// ─── Auth modal (standard: login / register / confirm views) ─────────────────
function openAuthModal(view) {
  showView(view);
  document.getElementById('auth-modal').style.display = 'flex';
  setTimeout(() => {
    const first = document.querySelector(`#view-${view} input`);
    if (first) first.focus();
  }, 80);
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

function showView(v) {
  ['login', 'register', 'confirm'].forEach(n => {
    const el = document.getElementById(`view-${n}`);
    if (el) el.style.display = n === v ? 'block' : 'none';
  });
}

// ─── Shared Supabase client ───────────────────────────────────────────────────
// Pages that need auth can reference `ZIK_SB` directly instead of
// re-creating the client. Config and Supabase CDN must be loaded first.
(function () {
  const url = window.ZIK_SUPABASE_URL      || '';
  const key = window.ZIK_SUPABASE_ANON_KEY || '';
  const ok  = url.startsWith('https://') && key.length > 20;
  window.ZIK_SB = ok && typeof supabase !== 'undefined'
    ? supabase.createClient(url, key)
    : null;
  if (!ok) console.warn('[ZIK] Supabase non configure — auth desactivee.');
})();

// ─── Shared auth actions (login / register) ───────────────────────────────────
// Used by pages with the standard auth form (loginEmail, loginPassword,
// loginSubmit, regUsername, regEmail, regPassword, registerSubmit).

async function handleLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!ZIK_SB) return showErr(errEl, 'Supabase non configure.');

  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPassword').value;
  if (!email || !pwd) return showErr(errEl, 'Remplis tous les champs.');

  const btn = document.getElementById('loginSubmit');
  btn.disabled = true; btn.textContent = 'Connexion...';
  const { error } = await ZIK_SB.auth.signInWithPassword({ email, password: pwd });
  btn.disabled = false; btn.textContent = 'Se connecter';

  if (error) {
    const msg = error.message.toLowerCase();
    showErr(errEl,
      msg.includes('invalid')  ? 'Email ou mot de passe incorrect.' :
      msg.includes('confirm')  ? 'Confirme ton email avant de te connecter.' :
      error.message
    );
  }
}

async function handleRegister() {
  const errEl = document.getElementById('register-error');
  errEl.style.display = 'none';
  if (!ZIK_SB) return showErr(errEl, 'Supabase non configure.');

  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const pwd      = document.getElementById('regPassword').value;

  if (!username || !email || !pwd) return showErr(errEl, 'Remplis tous les champs.');
  if (username.length < 3)         return showErr(errEl, 'Pseudo trop court (min. 3 caracteres).');
  if (pwd.length < 6)              return showErr(errEl, 'Mot de passe trop court (min. 6 caracteres).');
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return showErr(errEl, 'Pseudo invalide (lettres, chiffres, - et _ uniquement).');

  const { data: exists } = await ZIK_SB.from('profiles').select('id').eq('username', username).maybeSingle();
  if (exists) return showErr(errEl, 'Ce pseudo est deja pris.');

  const btn = document.getElementById('registerSubmit');
  btn.disabled = true; btn.textContent = 'Creation...';
  const { error } = await ZIK_SB.auth.signUp({ email, password: pwd, options: { data: { username } } });
  btn.disabled = false; btn.textContent = 'Creer mon compte';

  if (error) showErr(errEl, error.message);
  else showView('confirm');
}

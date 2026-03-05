'use strict';

// ─── Supabase (clés injectées par /config.js depuis le .env) ─────────────────
const SUPABASE_URL      = window.ZIK_SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = window.ZIK_SUPABASE_ANON_KEY || '';
const SB_OK = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

const { createClient } = supabase;
const sb = SB_OK ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!SB_OK) console.warn('[ZIK] Supabase non configuré — auth désactivée, mode guest uniquement.');

let currentUser = null;
let pendingRoom = null;

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindUI();
  await initAuth();
  loadRooms();
  loadLeaderboards();
});

// ─── Auth ────────────────────────────────────────────────────────────────────
async function initAuth() {
  if (!sb) { showNavAuth(); return; }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await applyUser(session.user);
    else showNavAuth();

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await applyUser(session.user);
        closeAuthModal();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null; showNavAuth();
      }
    });
  } catch (e) {
    console.error('[ZIK] Auth init error:', e);
    showNavAuth();
  }
}

async function applyUser(user) {
  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    currentUser = { ...user, profile };
    const name = profile?.username || user.email?.split('@')[0] || 'Joueur';
    const avatar = profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
    showNavUser(name, avatar);
  } catch (e) {
    currentUser = { ...user, profile: null };
    showNavUser(user.email?.split('@')[0] || 'Joueur', '');
  }
}

function showNavUser(name, avatar) {
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('nav-username').textContent = name;
  const img = document.getElementById('nav-avatar');
  if (avatar) img.src = avatar;
}

function showNavAuth() {
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
}

// ─── UI Bindings ─────────────────────────────────────────────────────────────
function bindUI() {
  // Nav
  document.getElementById('openLoginBtn').onclick    = () => openAuthModal('login');
  document.getElementById('openRegisterBtn').onclick = () => openAuthModal('register');
  document.getElementById('logoutBtn').onclick       = () => sb?.auth.signOut();
  document.getElementById('closeModal').onclick      = closeAuthModal;

  // Nav profile dropdown
  const trigger  = document.getElementById('nav-profile-trigger');
  const dropdown = document.getElementById('nav-dropdown');
  if (trigger && dropdown) {
    trigger.onclick = e => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  // Google OAuth
  document.getElementById('googleLoginBtn')?.addEventListener('click', signInWithGoogle);
  document.getElementById('googleRegisterBtn')?.addEventListener('click', signInWithGoogle);

  // Rejoindre par code
  document.getElementById('joinByCodeBtn').onclick = joinByCode;
  document.getElementById('roomCodeInput').onkeypress = e => { if (e.key === 'Enter') joinByCode(); };
  document.getElementById('roomCodeInput').oninput = e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  // Close overlay on backdrop click
  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
  document.getElementById('guest-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeGuestModal(); });

  // View switches
  document.getElementById('switchToRegister').onclick = e => { e.preventDefault(); showView('register'); };
  document.getElementById('switchToLogin').onclick    = e => { e.preventDefault(); showView('login'); };
  document.getElementById('closeConfirm').onclick     = closeAuthModal;

  // Login
  document.getElementById('loginSubmit').onclick  = handleLogin;
  document.getElementById('loginPassword').onkeypress = e => { if (e.key === 'Enter') handleLogin(); };

  // Register
  document.getElementById('registerSubmit').onclick = handleRegister;
  document.getElementById('regPassword').onkeypress  = e => { if (e.key === 'Enter') handleRegister(); };

  // Guest
  document.getElementById('cancelGuest').onclick   = closeGuestModal;
  document.getElementById('confirmGuest').onclick  = confirmGuest;
  document.getElementById('guestUsername').onkeypress = e => { if (e.key === 'Enter') confirmGuest(); };
  document.getElementById('guestToLogin').onclick  = e => { e.preventDefault(); closeGuestModal(); openAuthModal('login'); };
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
async function signInWithGoogle() {
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

// ─── Auth actions ─────────────────────────────────────────────────────────────
async function handleLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!sb) return showErr(errEl, 'Supabase non configuré — vérifie ton fichier .env.');

  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPassword').value;
  if (!email || !pwd) return showErr(errEl, 'Remplis tous les champs.');

  const btn = document.getElementById('loginSubmit');
  btn.disabled = true; btn.textContent = 'Connexion...';
  const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
  btn.disabled = false; btn.textContent = 'Se connecter';

  if (error) {
    const msg = error.message.toLowerCase();
    showErr(errEl,
      msg.includes('invalid') ? 'Email ou mot de passe incorrect.' :
      msg.includes('confirm') ? 'Confirme ton email avant de te connecter.' :
      error.message
    );
  }
}

async function handleRegister() {
  const errEl = document.getElementById('register-error');
  errEl.style.display = 'none';
  if (!sb) return showErr(errEl, 'Supabase non configuré — vérifie ton fichier .env.');

  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const pwd      = document.getElementById('regPassword').value;

  if (!username || !email || !pwd) return showErr(errEl, 'Remplis tous les champs.');
  if (username.length < 3)         return showErr(errEl, 'Pseudo trop court (min. 3 caractères).');
  if (pwd.length < 6)              return showErr(errEl, 'Mot de passe trop court (min. 6 caractères).');
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return showErr(errEl, 'Pseudo invalide (lettres, chiffres, - et _ uniquement).');

  // Vérif dispo pseudo
  const { data: exists } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  if (exists) return showErr(errEl, 'Ce pseudo est déjà pris.');

  const btn = document.getElementById('registerSubmit');
  btn.disabled = true; btn.textContent = 'Création...';
  const { error } = await sb.auth.signUp({ email, password: pwd, options: { data: { username } } });
  btn.disabled = false; btn.textContent = 'Créer mon compte';

  if (error) showErr(errEl, error.message);
  else showView('confirm');
}

// ─── Rooms ───────────────────────────────────────────────────────────────────
async function loadRooms() {
  const grid = document.getElementById('rooms-grid');
  try {
    const res   = await fetch('/api/rooms');
    const rooms = await res.json();
    let total = 0;

    grid.innerHTML = rooms.map((r, i) => {
      total += r.online || 0;
      return `
        <div class="room-card" style="--rc-color:${r.color};--rc-gradient:${r.gradient};animation-delay:${i * 60}ms" onclick="joinRoom('${r.id}')">
          <div class="room-stripe"></div>
          <div class="room-card-inner">
            <span class="room-emoji">${r.emoji}</span>
            <div class="room-name">${esc(r.name)}</div>
            <div class="room-desc">${esc(r.description)}</div>
            <div class="room-footer">
              <span class="room-online"><span class="dot"></span>${r.online || 0} en ligne</span>
              <button class="room-btn" onclick="event.stopPropagation();joinRoom('${r.id}')">JOUER →</button>
            </div>
          </div>
        </div>`;
    }).join('');

    document.getElementById('total-online').textContent = `${total} joueur${total !== 1 ? 's' : ''} en ligne`;
  } catch {
    grid.innerHTML = '<p style="color:var(--dim);padding:20px">Impossible de charger les rooms.</p>';
  }
  setTimeout(loadRooms, 30_000);
}

async function joinByCode() {
  const code  = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  const errEl = document.getElementById('roomCodeError');
  errEl.style.display = 'none';

  if (code.length < 4) { errEl.textContent = 'Code invalide.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('joinByCodeBtn');
  btn.disabled = true; btn.textContent = '...';

  try {
    const r = await fetch(`/api/rooms/custom/${code}`);
    if (!r.ok) throw new Error('Room introuvable ou expirée.');
    joinRoom(code);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Rejoindre →';
  }
}

function joinRoom(roomId) {
  pendingRoom = roomId;
  if (currentUser) {
    const name = currentUser.profile?.username || currentUser.email?.split('@')[0] || 'Joueur';
    goToGame(roomId, name, currentUser.id, false);
  } else {
    openGuestModal(roomId);
  }
}

function goToGame(roomId, username, userId, isGuest) {
  const p = new URLSearchParams({ roomId, username, userId: userId || '', isGuest: isGuest ? '1' : '0' });
  window.location.href = `/game?${p}`;
}

// ─── Guest modal ─────────────────────────────────────────────────────────────
function openGuestModal(roomId) {
  pendingRoom = roomId;
  const saved = localStorage.getItem('zik_guest');
  if (saved) document.getElementById('guestUsername').value = saved;
  document.getElementById('guest-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('guestUsername').focus(), 80);
}
function closeGuestModal() { document.getElementById('guest-modal').style.display = 'none'; }
function confirmGuest() {
  const u = document.getElementById('guestUsername').value.trim();
  if (!u) { document.getElementById('guestUsername').focus(); return; }
  localStorage.setItem('zik_guest', u);
  closeGuestModal();
  goToGame(pendingRoom, u, null, true);
}

// ─── Auth modal helpers ───────────────────────────────────────────────────────
function openAuthModal(view) {
  showView(view);
  document.getElementById('auth-modal').style.display = 'flex';
  setTimeout(() => {
    const first = document.querySelector(`#view-${view} input`);
    if (first) first.focus();
  }, 80);
}
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
function showView(v) {
  ['login','register','confirm'].forEach(n => {
    document.getElementById(`view-${n}`).style.display = n === v ? 'block' : 'none';
  });
}

// ─── Leaderboards ─────────────────────────────────────────────────────────────
async function loadLeaderboards() {
  renderLb('weekly-list', '/api/leaderboard/weekly', p => `${p.weekly_score} pts`, p => `${p.games_count} parties`);
  renderLb('elo-list',    '/api/leaderboard/elo',    p => `⚡ ${p.elo}`,           p => `${p.games_played} parties`);
}

async function renderLb(elId, url, scoreFn, metaFn) {
  const el = document.getElementById(elId);
  try {
    const data = await fetch(url).then(r => r.json());
    if (!Array.isArray(data) || !data.length) { el.innerHTML = '<p class="lb-empty">Pas encore de données</p>'; return; }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = data.map((p, i) => `
      <div class="lb-row">
        <div class="lb-rank">${medals[i] || `#${i+1}`}</div>
        <div class="lb-name">${esc(p.username)}</div>
        <div>
          <div class="lb-score">${scoreFn(p)}</div>
          <div class="lb-meta">${metaFn(p)}</div>
        </div>
      </div>`).join('');
  } catch { el.innerHTML = '<p class="lb-empty">—</p>'; }
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

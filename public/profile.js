'use strict';

const SUPABASE_URL      = window.ZIK_SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = window.ZIK_SUPABASE_ANON_KEY || '';
const SB_OK = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
const { createClient } = supabase;
const sb = SB_OK ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindNav();
  bindModals();
  await initAuth();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function initAuth() {
  if (!sb) { showAuthWall(); return; }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) await applyUser(session.user);
    else showAuthWall();

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await applyUser(session.user);
        closeAuthModal();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        showAuthWall();
      }
    });
  } catch { showAuthWall(); }
}

async function applyUser(user) {
  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    currentUser = { ...user, profile };
    const name   = profile?.username || user.email?.split('@')[0] || 'Joueur';
    const avatar = profile?.avatar_url || dicebear(name);
    showNavUser(name, avatar);
    showProfilePage(profile);
    await loadStats(user.id);
  } catch {
    currentUser = { ...user, profile: null };
    showNavUser(user.email?.split('@')[0] || 'Joueur', '');
    showAuthWall();
  }
}

function dicebear(name) {
  return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
}

function showNavUser(name, avatar) {
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('nav-username').textContent = name;
  const img = document.getElementById('nav-avatar');
  if (avatar) img.src = avatar;
}

function showAuthWall() {
  document.getElementById('auth-wall').style.display = 'flex';
  document.getElementById('profile-page').style.display = 'none';
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
}

function showProfilePage(profile) {
  document.getElementById('auth-wall').style.display = 'none';
  document.getElementById('profile-page').style.display = 'block';

  const name   = profile?.username || currentUser?.email?.split('@')[0] || 'Joueur';
  const avatar = profile?.avatar_url || dicebear(name);
  const level  = profile?.level || 1;
  const xp     = profile?.xp || 0;
  const nextLvl = Math.pow(level, 2) * 100;

  document.getElementById('profile-username-display').textContent = name;
  document.getElementById('profile-level-display').textContent    = `Niveau ${level} — ${xp} XP`;
  document.getElementById('profile-avatar-img').src = avatar;

  document.getElementById('stat-elo').textContent   = profile?.elo    ?? '—';
  document.getElementById('stat-level').textContent = profile?.level  ?? '—';
  document.getElementById('stat-games').textContent = profile?.games_played ?? '—';
  document.getElementById('stat-total').textContent = profile?.total_score  ?? '—';
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats(userId) {
  try {
    const r = await fetch(`/api/stats/${userId}`);
    if (!r.ok) return;
    const { bestByRoom } = await r.json();
    renderBestScores(bestByRoom || {});
  } catch {
    document.getElementById('best-scores-list').innerHTML =
      '<p class="profile-empty">Impossible de charger les stats.</p>';
  }
}

function renderBestScores(bestByRoom) {
  const el = document.getElementById('best-scores-list');
  const entries = Object.entries(bestByRoom).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.innerHTML = '<p class="profile-empty">Aucune partie jouée sur les rooms officielles.</p>';
    return;
  }
  // Get room info for display
  fetch('/api/rooms').then(r => r.json()).then(rooms => {
    const roomMap = {};
    rooms.forEach(r => { roomMap[r.id] = r; });
    el.innerHTML = entries.map(([roomId, score]) => {
      const room = roomMap[roomId];
      if (!room) return '';
      return `<div class="best-score-row">
        <span class="best-score-emoji">${room.emoji || '🎵'}</span>
        <div class="best-score-info">
          <div class="best-score-room">${esc(room.name)}</div>
          <div style="font-size:.75rem;color:var(--dim)">${room.description || ''}</div>
        </div>
        <span class="best-score-pts">${score} pts</span>
      </div>`;
    }).filter(Boolean).join('') || '<p class="profile-empty">Aucune partie sur les rooms officielles.</p>';
  }).catch(() => {
    el.innerHTML = entries.map(([roomId, score]) =>
      `<div class="best-score-row">
        <span class="best-score-emoji">🎵</span>
        <div class="best-score-info"><div class="best-score-room">${esc(roomId)}</div></div>
        <span class="best-score-pts">${score} pts</span>
      </div>`
    ).join('');
  });
}

// ─── Edit profile modal ───────────────────────────────────────────────────────
function openEditModal() {
  const profile = currentUser?.profile;
  const name    = profile?.username || currentUser?.email?.split('@')[0] || '';
  const avatar  = profile?.avatar_url || '';

  document.getElementById('edit-username').value    = name;
  document.getElementById('edit-avatar-url').value  = avatar;
  document.getElementById('edit-profile-error').style.display = 'none';
  updateAvatarPreview(avatar || dicebear(name));
  document.getElementById('modal-edit-profile').style.display = 'flex';
  setTimeout(() => document.getElementById('edit-username').focus(), 80);
}

function updateAvatarPreview(url) {
  const img = document.getElementById('avatar-preview');
  img.src = url || dicebear('?');
}

async function saveProfile() {
  const username   = document.getElementById('edit-username').value.trim();
  const avatar_url = document.getElementById('edit-avatar-url').value.trim();
  const errEl      = document.getElementById('edit-profile-error');
  errEl.style.display = 'none';

  if (!username) return showErr(errEl, 'Le pseudo est requis.');
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return showErr(errEl, 'Pseudo invalide (3-20 caractères, lettres/chiffres/_/-).');

  // Vérif unicité si changement
  const oldUsername = currentUser?.profile?.username;
  if (username !== oldUsername) {
    const { data: exists } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
    if (exists) return showErr(errEl, 'Ce pseudo est déjà pris.');
  }

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true; btn.textContent = '...';

  try {
    const r = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, username, avatar_url: avatar_url || null }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

    // Mettre à jour localement
    if (!currentUser.profile) currentUser.profile = {};
    currentUser.profile.username  = username;
    currentUser.profile.avatar_url = avatar_url || null;

    const avatar = avatar_url || dicebear(username);
    showNavUser(username, avatar);
    document.getElementById('profile-username-display').textContent = username;
    document.getElementById('profile-avatar-img').src = avatar;

    document.getElementById('modal-edit-profile').style.display = 'none';
    toast('Profil mis à jour !', 'success');
  } catch (e) {
    showErr(errEl, e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Enregistrer';
  }
}

// ─── Bindings ─────────────────────────────────────────────────────────────────
function bindNav() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => sb?.auth.signOut());
  document.getElementById('openLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('openLoginBtn2')?.addEventListener('click', () => openAuthModal('login'));

  const trigger  = document.getElementById('nav-profile-trigger');
  const dropdown = document.getElementById('nav-dropdown');
  if (trigger && dropdown) {
    trigger.onclick = e => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }
}

function bindModals() {
  document.getElementById('editProfileBtn')?.addEventListener('click', openEditModal);
  document.getElementById('editAvatarBtn')?.addEventListener('click', openEditModal);
  document.getElementById('closeEditProfile')?.addEventListener('click', () => {
    document.getElementById('modal-edit-profile').style.display = 'none';
  });
  document.getElementById('cancelEditProfile')?.addEventListener('click', () => {
    document.getElementById('modal-edit-profile').style.display = 'none';
  });
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
  document.getElementById('modal-edit-profile')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('modal-edit-profile').style.display = 'none';
  });

  // Live preview avatar URL
  document.getElementById('edit-avatar-url')?.addEventListener('input', e => {
    const val = e.target.value.trim();
    updateAvatarPreview(val || dicebear(document.getElementById('edit-username').value || '?'));
  });
  document.getElementById('edit-username')?.addEventListener('input', e => {
    const avatarUrl = document.getElementById('edit-avatar-url').value.trim();
    if (!avatarUrl) updateAvatarPreview(dicebear(e.target.value || '?'));
  });
  document.getElementById('resetAvatarBtn')?.addEventListener('click', () => {
    document.getElementById('edit-avatar-url').value = '';
    updateAvatarPreview(dicebear(document.getElementById('edit-username').value || '?'));
  });

  // Auth modal
  document.getElementById('closeModal')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAuthModal();
  });
  document.getElementById('closeConfirm')?.addEventListener('click', closeAuthModal);
  document.getElementById('loginSubmit')?.addEventListener('click', handleLogin);
  document.getElementById('loginPassword')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
    sb?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/profile.html' } });
  });
}

async function handleLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPassword').value;
  if (!email || !pwd) return showErr(errEl, 'Remplis tous les champs.');
  const btn = document.getElementById('loginSubmit');
  btn.disabled = true; btn.textContent = 'Connexion...';
  const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
  btn.disabled = false; btn.textContent = 'Se connecter';
  if (error) showErr(errEl, 'Email ou mot de passe incorrect.');
}

function openAuthModal(view) {
  document.getElementById('view-login').style.display = view === 'login' ? 'block' : 'none';
  document.getElementById('view-confirm').style.display = 'none';
  document.getElementById('auth-modal').style.display = 'flex';
  setTimeout(() => {
    const f = document.querySelector(`#view-${view} input`);
    if (f) f.focus();
  }, 80);
}
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${type ? ' ' + type : ''}`;
  el.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

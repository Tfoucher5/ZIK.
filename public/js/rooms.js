'use strict';
/* global supabase, SUPABASE_URL, SUPABASE_ANON_KEY */

const SUPABASE_URL  = window.ZIK_SUPABASE_URL  || '';
const SUPABASE_ANON_KEY = window.ZIK_SUPABASE_ANON_KEY || '';
const SB_OK = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const { createClient } = supabase;
const sb = SB_OK ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let editingRoomId = null;   // null = creation, string = edition
let deletingRoomId = null;
let userPlaylists = [];     // playlists de l'utilisateur pour le select

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
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

  bindEvents();
  loadPublicRooms();
});

// ─── Auth ────────────────────────────────────────────────────────────────────
async function applyUser(user) {
  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    currentUser = { ...user, profile };
    const name   = profile?.username || user.email?.split('@')[0] || 'Joueur';
    const avatar = profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
    showNavUser(name, avatar);
    hideAuthWall();
    showRoomsTabs();
    loadUserPlaylists();
  } catch {
    currentUser = { ...user, profile: null };
    showNavUser(user.email?.split('@')[0] || 'Joueur', '');
    hideAuthWall();
    showRoomsTabs();
  }
}

function showNavUser(name, avatar) {
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('nav-username').textContent = name;
  const img = document.getElementById('nav-avatar');
  if (avatar) img.src = avatar;
}

function showAuthWall() {
  document.getElementById('auth-wall').style.display = 'block';
  document.getElementById('rooms-tabs').style.display = 'none';
  document.getElementById('tab-public').style.display = 'none';
  document.getElementById('tab-mine').style.display   = 'none';
  document.getElementById('nav-auth').style.display   = 'flex';
  document.getElementById('nav-user').style.display   = 'none';
  document.getElementById('createRoomBtn').style.display = 'none';
}

function hideAuthWall() {
  document.getElementById('auth-wall').style.display  = 'none';
  document.getElementById('createRoomBtn').style.display = 'flex';
}

function showRoomsTabs() {
  document.getElementById('rooms-tabs').style.display = 'flex';
  document.getElementById('tab-public').style.display = 'block';
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('tab-public').style.display = name === 'public' ? 'block' : 'none';
  document.getElementById('tab-mine').style.display   = name === 'mine'   ? 'block' : 'none';
  if (name === 'mine') loadMyRooms();
}

// ─── Load public rooms ────────────────────────────────────────────────────────
async function loadPublicRooms() {
  const loading = document.getElementById('public-loading');
  const empty   = document.getElementById('public-empty');
  const grid    = document.getElementById('public-grid');

  loading.style.display = 'block';
  empty.style.display   = 'none';
  grid.style.display    = 'none';

  try {
    const token = (await sb?.auth.getSession())?.data?.session?.access_token;
    const r = await fetch('/api/rooms', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const rooms = await r.json();
    loading.style.display = 'none';
    if (!rooms.length) { empty.style.display = 'block'; return; }
    grid.innerHTML = rooms.map(roomCard).join('');
    grid.style.display = 'grid';
  } catch {
    loading.textContent = 'Erreur de chargement.';
  }
}

// ─── Load my rooms ────────────────────────────────────────────────────────────
async function loadMyRooms() {
  const loading = document.getElementById('mine-loading');
  const empty   = document.getElementById('mine-empty');
  const grid    = document.getElementById('mine-grid');

  loading.style.display = 'block';
  empty.style.display   = 'none';
  grid.style.display    = 'none';

  try {
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const r = await fetch('/api/rooms/mine', { headers: { Authorization: `Bearer ${token}` } });
    const rooms = await r.json();
    loading.style.display = 'none';
    if (!rooms.length) { empty.style.display = 'block'; return; }
    grid.innerHTML = rooms.map(r => roomCard(r, true)).join('');
    grid.style.display = 'grid';
  } catch {
    loading.textContent = 'Erreur de chargement.';
  }
}

// ─── Room card HTML ───────────────────────────────────────────────────────────
function roomCard(r, owned = false) {
  const ownerName = r.profiles?.username || 'Inconnu';
  const desc      = r.description ? `<p class="room-card-desc">${esc(r.description)}</p>` : '';
  const privTag   = !r.is_public ? `<span class="room-card-tag room-card-private">Privee</span>` : '';
  const actions   = owned
    ? `<div class="room-card-actions">
         <button class="btn-ghost sm" onclick="openEditRoom('${r.id}')">Modifier</button>
         <button class="btn-danger sm" style="padding:6px 12px;font-size:.75rem" onclick="askDeleteRoom('${r.id}')">Supprimer</button>
       </div>`
    : '';
  return `
    <div class="room-card">
      <div class="room-card-head">
        <span class="room-card-emoji">${esc(r.emoji)}</span>
        <div>
          <div class="room-card-name">${esc(r.name)}</div>
          <div class="room-card-owner">par ${esc(ownerName)}</div>
        </div>
      </div>
      ${desc}
      <div class="room-card-meta">
        <span class="room-card-tag">${r.max_rounds} manches</span>
        <span class="room-card-tag">${r.round_duration}s/manche</span>
        <span class="room-card-tag">Code : <strong>${r.code}</strong></span>
        ${privTag}
      </div>
      <div class="room-card-footer">
        <a href="/game?room=${r.code}" class="btn-accent sm" style="text-decoration:none">Rejoindre</a>
        ${actions}
      </div>
    </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Load user playlists for select ──────────────────────────────────────────
async function loadUserPlaylists() {
  if (!currentUser) return;
  try {
    const { data } = await sb.from('custom_playlists')
      .select('id, name, emoji')
      .eq('owner_id', currentUser.id)
      .order('name');
    userPlaylists = data || [];
    populatePlaylistSelect(null);
  } catch { /* non-bloquant */ }
}

function populatePlaylistSelect(selectedId) {
  const sel = document.getElementById('room-playlist');
  sel.innerHTML = '<option value="">Choisir une playlist...</option>' +
    userPlaylists.map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.emoji)} ${esc(p.name)}</option>`
    ).join('');
}

// ─── Create / Edit room modal ─────────────────────────────────────────────────
function openCreateRoom() {
  editingRoomId = null;
  document.getElementById('room-modal-title').textContent = 'Creer une room';
  document.getElementById('saveRoomBtn').textContent      = 'Creer';
  document.getElementById('room-name').value          = '';
  document.getElementById('room-emoji').value         = '🎵';
  document.getElementById('room-desc').value          = '';
  document.getElementById('room-max-rounds').value    = '10';
  document.getElementById('room-round-duration').value = '30';
  document.getElementById('room-break-duration').value = '7';
  document.getElementById('room-is-public').checked   = true;
  populatePlaylistSelect(null);
  document.getElementById('room-modal').style.display = 'flex';
}

async function openEditRoom(id) {
  editingRoomId = id;
  document.getElementById('room-modal-title').textContent = 'Modifier la room';
  document.getElementById('saveRoomBtn').textContent      = 'Enregistrer';

  const token = (await sb.auth.getSession()).data.session?.access_token;
  const r = await fetch(`/api/rooms/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const room = await r.json();

  document.getElementById('room-name').value           = room.name || '';
  document.getElementById('room-emoji').value          = room.emoji || '🎵';
  document.getElementById('room-desc').value           = room.description || '';
  document.getElementById('room-max-rounds').value     = room.max_rounds || 10;
  document.getElementById('room-round-duration').value = room.round_duration || 30;
  document.getElementById('room-break-duration').value = room.break_duration || 7;
  document.getElementById('room-is-public').checked    = room.is_public !== false;
  populatePlaylistSelect(room.playlist_id);
  document.getElementById('room-modal').style.display = 'flex';
}

function closeRoomModal() {
  document.getElementById('room-modal').style.display = 'none';
  editingRoomId = null;
}

async function saveRoom() {
  const name          = document.getElementById('room-name').value.trim();
  const emoji         = document.getElementById('room-emoji').value.trim() || '🎵';
  const description   = document.getElementById('room-desc').value.trim();
  const playlist_id   = document.getElementById('room-playlist').value || null;
  const is_public     = document.getElementById('room-is-public').checked;
  const max_rounds    = parseInt(document.getElementById('room-max-rounds').value) || 10;
  const round_duration = parseInt(document.getElementById('room-round-duration').value) || 30;
  const break_duration = parseInt(document.getElementById('room-break-duration').value) || 7;

  if (!name) { toast('Le nom est requis.', 'error'); return; }

  const btn = document.getElementById('saveRoomBtn');
  btn.disabled = true; btn.textContent = '...';

  try {
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const body  = { name, emoji, description, playlist_id, is_public, max_rounds, round_duration, break_duration };

    let r;
    if (editingRoomId) {
      r = await fetch(`/api/rooms/${editingRoomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } else {
      r = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    }

    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

    toast(editingRoomId ? 'Room mise a jour.' : `Room creee ! Code : ${data.code}`, 'success');
    closeRoomModal();
    loadPublicRooms();
    if (document.querySelector('.rtab.active')?.dataset.tab === 'mine') loadMyRooms();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingRoomId ? 'Enregistrer' : 'Creer';
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function askDeleteRoom(id) {
  deletingRoomId = id;
  document.getElementById('delete-modal').style.display = 'flex';
}

async function confirmDeleteRoom() {
  if (!deletingRoomId) return;
  try {
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const r = await fetch(`/api/rooms/${deletingRoomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error((await r.json()).error);
    toast('Room supprimee.', 'success');
    document.getElementById('delete-modal').style.display = 'none';
    deletingRoomId = null;
    loadPublicRooms();
    loadMyRooms();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.classList.add('toast-show'), 10);
  setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ─── Auth modal ───────────────────────────────────────────────────────────────
function openAuthModal(mode = 'login') {
  document.getElementById('auth-modal').style.display = 'flex';
  document.getElementById('auth-login-form').style.display    = mode === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = mode === 'register' ? 'block' : 'none';
}
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

// ─── Nav dropdown ─────────────────────────────────────────────────────────────
function bindEvents() {
  // Tabs
  document.querySelectorAll('.rtab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Create room buttons
  document.getElementById('createRoomBtn').addEventListener('click', openCreateRoom);
  document.getElementById('createRoomBtn2')?.addEventListener('click', openCreateRoom);

  // Room modal
  document.getElementById('closeRoomModal').addEventListener('click', closeRoomModal);
  document.getElementById('cancelRoomModal').addEventListener('click', closeRoomModal);
  document.getElementById('saveRoomBtn').addEventListener('click', saveRoom);

  // Delete modal
  document.getElementById('cancelDeleteRoom').addEventListener('click', () => {
    document.getElementById('delete-modal').style.display = 'none';
    deletingRoomId = null;
  });
  document.getElementById('confirmDeleteRoom').addEventListener('click', confirmDeleteRoom);

  // Auth
  document.getElementById('openLoginBtn').addEventListener('click',   () => openAuthModal('login'));
  document.getElementById('openRegisterBtn').addEventListener('click', () => openAuthModal('register'));
  document.getElementById('openLoginBtn2')?.addEventListener('click',   () => openAuthModal('login'));
  document.getElementById('openRegisterBtn2')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
  document.getElementById('switchToRegister').addEventListener('click', () => {
    document.getElementById('auth-login-form').style.display    = 'none';
    document.getElementById('auth-register-form').style.display = 'block';
  });
  document.getElementById('switchToLogin').addEventListener('click', () => {
    document.getElementById('auth-register-form').style.display = 'none';
    document.getElementById('auth-login-form').style.display    = 'block';
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.style.display = 'none';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; }
  });

  document.getElementById('registerBtn').addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('reg-error');
    errEl.style.display = 'none';
    if (!username) { errEl.textContent = 'Pseudo requis'; errEl.style.display = 'block'; return; }
    const { error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; }
    else { errEl.style.display = 'none'; toast('Compte cree ! Verifie ton email.', 'success'); closeAuthModal(); }
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => sb.auth.signOut());

  // Nav dropdown
  document.getElementById('nav-profile-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('nav-dropdown').classList.toggle('open');
  });
  document.addEventListener('click', () => {
    document.getElementById('nav-dropdown')?.classList.remove('open');
  });

  // Close modals on backdrop click
  document.getElementById('room-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeRoomModal(); });
  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
}

'use strict';

const SUPABASE_URL      = window.ZIK_SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = window.ZIK_SUPABASE_ANON_KEY || '';
const SB_OK = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
const { createClient } = supabase;
const sb = SB_OK ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser   = null;
let editingPl     = null;   // playlist en cours d'édition
let editorTracks  = [];     // tracks chargés dans l'éditeur
let searchSource  = 'deezer';
let importPreviewTracks = []; // tracks issus d'un import en attente

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindNavAuth();
  bindModals();
  bindEditor();
  await initAuth();
  checkSpotifyStatus();
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
    const avatar = profile?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0c1018&textColor=3ecfff`;
    showNavUser(name, avatar);
    hideAuthWall();
    await loadPlaylists();
  } catch {
    currentUser = { ...user, profile: null };
    showNavUser(user.email?.split('@')[0] || 'Joueur', '');
    hideAuthWall();
    await loadPlaylists();
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
  document.getElementById('playlists-grid').style.display = 'none';
  document.getElementById('playlists-loading').style.display = 'none';
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
}
function hideAuthWall() {
  document.getElementById('auth-wall').style.display = 'none';
}

// ─── Load playlists ────────────────────────────────────────────────────────────
async function loadPlaylists() {
  const grid    = document.getElementById('playlists-grid');
  const loading = document.getElementById('playlists-loading');
  loading.style.display = 'block';
  grid.style.display = 'none';

  const { data, error } = await sb
    .from('custom_playlists')
    .select('*')
    .eq('owner_id', currentUser.id)
    .order('updated_at', { ascending: false });

  loading.style.display = 'none';
  grid.style.display = 'grid';

  if (error) { grid.innerHTML = `<p style="color:var(--dim)">${error.message}</p>`; return; }

  grid.innerHTML = '';

  // Carte "nouvelle playlist"
  const newCard = document.createElement('div');
  newCard.className = 'pl-card pl-card-new';
  newCard.innerHTML = `<span class="pl-card-new-icon">+</span><span>Nouvelle playlist</span>`;
  newCard.onclick = () => openPlaylistModal();
  grid.appendChild(newCard);

  (data || []).forEach(pl => grid.appendChild(buildPlCard(pl)));
}

function buildPlCard(pl) {
  const card = document.createElement('div');
  card.className = 'pl-card';
  card.innerHTML = `
    <span class="pl-card-emoji">${esc(pl.emoji)}</span>
    <div class="pl-card-name">${esc(pl.name)}</div>
    <div class="pl-card-meta">${pl.track_count} titre${pl.track_count !== 1 ? 's' : ''}</div>
    <div class="pl-card-footer">
      <span class="pl-card-badge ${pl.is_public ? '' : 'private'}">${pl.is_public ? 'Publique' : 'Privée'}</span>
      <button class="pl-card-edit">Modifier →</button>
    </div>`;
  card.querySelector('.pl-card-edit').onclick = e => { e.stopPropagation(); openEditor(pl); };
  card.onclick = () => openEditor(pl);
  return card;
}

// ─── Playlist modal (créer / éditer infos) ────────────────────────────────────
function openPlaylistModal(pl = null) {
  editingPl = pl;
  document.getElementById('modal-pl-title').textContent = pl ? 'Modifier la playlist' : 'Nouvelle playlist';
  document.getElementById('pl-emoji').value    = pl?.emoji    ?? '🎵';
  document.getElementById('pl-name').value     = pl?.name     ?? '';
  document.getElementById('pl-public').checked = pl?.is_public ?? false;
  document.getElementById('savePlaylistBtn').textContent = pl ? 'Enregistrer' : 'Créer';
  document.getElementById('pl-form-error').style.display = 'none';
  document.getElementById('modal-playlist').style.display = 'flex';
  setTimeout(() => document.getElementById('pl-name').focus(), 80);
}
function closePlaylistModal() { document.getElementById('modal-playlist').style.display = 'none'; }

async function savePlaylist() {
  const name      = document.getElementById('pl-name').value.trim();
  const emoji     = document.getElementById('pl-emoji').value.trim() || '🎵';
  const is_public = document.getElementById('pl-public').checked;
  const errEl     = document.getElementById('pl-form-error');

  if (!name) { showErr(errEl, 'Le nom est requis.'); return; }

  const btn = document.getElementById('savePlaylistBtn');
  btn.disabled = true;

  if (editingPl) {
    const { error } = await sb.from('custom_playlists')
      .update({ name, emoji, is_public, updated_at: new Date().toISOString() })
      .eq('id', editingPl.id);
    if (error) { showErr(errEl, error.message); btn.disabled = false; return; }
    toast('Playlist mise à jour', 'success');
    // Mettre à jour l'éditeur si ouvert
    if (document.getElementById('modal-editor').style.display === 'flex') {
      editingPl = { ...editingPl, name, emoji, is_public };
      document.getElementById('editor-pl-name').textContent = name;
      document.getElementById('editor-emoji').textContent   = emoji;
    }
  } else {
    const { data, error } = await sb.from('custom_playlists')
      .insert({ owner_id: currentUser.id, name, emoji, is_public })
      .select().single();
    if (error) { showErr(errEl, error.message); btn.disabled = false; return; }
    toast('Playlist créée !', 'success');
    closePlaylistModal();
    openEditor(data);
    await loadPlaylists();
    btn.disabled = false;
    return;
  }

  btn.disabled = false;
  closePlaylistModal();
  await loadPlaylists();
}

// ─── Editor ───────────────────────────────────────────────────────────────────
async function openEditor(pl) {
  editingPl = pl;
  editorTracks = [];
  importPreviewTracks = [];

  document.getElementById('editor-pl-name').textContent = pl.name;
  document.getElementById('editor-emoji').textContent   = pl.emoji;
  document.getElementById('modal-editor').style.display = 'flex';

  // Reset tabs
  switchTab('search');
  document.getElementById('search-results').innerHTML     = '';
  document.getElementById('import-spotify-preview').innerHTML = '';
  document.getElementById('import-deezer-preview').innerHTML  = '';
  document.getElementById('search-query').value = '';
  document.getElementById('spotify-pl-url').value = '';
  document.getElementById('deezer-pl-url').value  = '';

  await loadEditorTracks();
}

function closeEditorModal() { document.getElementById('modal-editor').style.display = 'none'; }

async function loadEditorTracks() {
  const { data, error } = await sb
    .from('custom_playlist_tracks')
    .select('*')
    .eq('playlist_id', editingPl.id)
    .order('position');
  if (error) { toast(error.message, 'error'); return; }
  editorTracks = data || [];
  renderEditorTracks();
  updateEditorCount();
}

function renderEditorTracks() {
  const list = document.getElementById('tracks-list');
  const hint = document.getElementById('tracks-empty-hint');
  if (!editorTracks.length) { list.innerHTML = ''; hint.style.display = 'inline'; return; }
  hint.style.display = 'none';
  list.innerHTML = editorTracks.map((t, i) => `
    <div class="track-row-pl" data-id="${t.id}">
      <span class="track-num">${i + 1}</span>
      <img class="track-cover" src="${t.cover_url || ''}" alt="" onerror="this.style.display='none'">
      <div class="track-info">
        <div class="track-title">${esc(t.title)}</div>
        <div class="track-artist">${esc(t.artist)}</div>
      </div>
      <span class="track-source">${t.source}</span>
      <button class="track-remove-btn" onclick="removeTrack('${t.id}')">✕</button>
    </div>`).join('');
}

function updateEditorCount() {
  const n = editorTracks.length;
  document.getElementById('editor-track-count').textContent = `${n} titre${n !== 1 ? 's' : ''}`;
}

async function removeTrack(trackId) {
  const { error } = await sb.from('custom_playlist_tracks').delete().eq('id', trackId);
  if (error) { toast(error.message, 'error'); return; }
  editorTracks = editorTracks.filter(t => t.id !== trackId);
  renderEditorTracks();
  updateEditorCount();
}

function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

async function addTrack(trackData) {
  // Doublons : external_id ou (artist+title normalisés)
  const extId = trackData.external_id;
  const norm  = normalize(trackData.artist) + '|' + normalize(trackData.title);
  const isDup = editorTracks.some(t =>
    (extId && t.external_id === extId) ||
    (normalize(t.artist) + '|' + normalize(t.title)) === norm
  );
  if (isDup) { toast('Ce titre est déjà dans la playlist.', 'error'); return false; }
  const { data, error } = await sb.from('custom_playlist_tracks').insert({
    playlist_id: editingPl.id,
    artist:      trackData.artist,
    title:       trackData.title,
    preview_url: trackData.preview_url || null,
    cover_url:   trackData.cover_url   || null,
    source:      trackData.source      || 'manual',
    external_id: trackData.external_id || null,
    position:    editorTracks.length,
  }).select().single();

  if (error) { toast(error.message, 'error'); return false; }
  editorTracks.push(data);
  renderEditorTracks();
  updateEditorCount();
  return true;
}

// ─── Delete playlist ──────────────────────────────────────────────────────────
async function deletePlaylist() {
  if (!editingPl) return;
  if (!confirm(`Supprimer "${editingPl.name}" ? Cette action est irréversible.`)) return;

  const btn = document.getElementById('deletePlaylistBtn');
  btn.disabled = true; btn.textContent = '...';

  try {
    // Endpoint serveur avec auth token explicite (plus fiable que client-side Supabase)
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`/api/playlists/${editingPl.id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

    closeEditorModal();
    editingPl = null;
    toast('Playlist supprimée.', 'success');
    await loadPlaylists();
  } catch (e) {
    toast('Erreur suppression : ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'Supprimer';
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.etab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.getElementById(`tab-${name}`).style.display = 'block';
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('search-query').value.trim();
  if (!q) return;
  const btn = document.getElementById('searchBtn');
  btn.disabled = true; btn.textContent = '...';
  const res  = document.getElementById('search-results');
  res.innerHTML = '<p style="color:var(--dim);font-size:.83rem;padding:8px 0">Recherche...</p>';

  try {
    const r    = await fetch(`/api/${searchSource}/search?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    renderSearchResults(data);
  } catch (e) {
    res.innerHTML = `<p style="color:#f87171;font-size:.83rem;padding:8px 0">${e.message}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Rechercher';
  }
}

function renderSearchResults(tracks) {
  const res = document.getElementById('search-results');
  if (!tracks.length) { res.innerHTML = '<p style="color:var(--dim);font-size:.83rem;padding:8px 0">Aucun résultat.</p>'; return; }
  res.innerHTML = tracks.map((t, i) => `
    <div class="track-row">
      <img class="track-cover" src="${t.cover_url || ''}" alt="" onerror="this.style.display='none'">
      <div class="track-info">
        <div class="track-title">${esc(t.title)}</div>
        <div class="track-artist">${esc(t.artist)}</div>
      </div>
      <span class="track-source">${t.source}</span>
      <button class="track-add-btn" id="sr-btn-${i}" onclick="addFromSearch(${i}, this)">+ Ajouter</button>
    </div>`).join('');
  // Stocker les tracks dans l'objet window temporairement
  window._searchResults = tracks;
}

async function addFromSearch(idx, btn) {
  const track = window._searchResults?.[idx];
  if (!track) return;
  btn.disabled = true; btn.textContent = '...';
  const ok = await addTrack(track);
  if (ok) { btn.textContent = '✓ Ajouté'; btn.classList.add('added'); }
  else { btn.disabled = false; btn.textContent = '+ Ajouter'; }
}

// ─── Import Spotify ───────────────────────────────────────────────────────────
async function checkSpotifyStatus() {
  try {
    const r = await fetch('/api/spotify/status');
    const { configured } = await r.json();
    document.getElementById('spotify-unconfigured').style.display = configured ? 'none' : 'block';
    document.getElementById('spotify-configured').style.display   = configured ? 'block' : 'none';
  } catch { /* ignore */ }
}

function extractSpotifyId(input) {
  input = input.trim();
  // URL : https://open.spotify.com/playlist/XXXX?...
  const m = input.match(/playlist\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  // ID direct
  if (/^[a-zA-Z0-9]{22}$/.test(input)) return input;
  return null;
}

async function importSpotify() {
  const raw = document.getElementById('spotify-pl-url').value.trim();
  const id  = extractSpotifyId(raw);
  const prev = document.getElementById('import-spotify-preview');
  if (!id) { prev.innerHTML = '<p style="color:#f87171;font-size:.83rem">URL ou ID Spotify invalide.</p>'; return; }

  const btn = document.getElementById('importSpotifyBtn');
  btn.disabled = true; btn.textContent = '...';
  prev.innerHTML = '<p style="color:var(--dim);font-size:.83rem">Chargement...</p>';

  try {
    const r    = await fetch(`/api/spotify/playlist/${id}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    importPreviewTracks = data.tracks;
    const truncNote = data.truncated ? `<p style="color:#fbbf24;font-size:.75rem;margin-top:6px">⚠️ Limité aux ${data.tracks.length} premiers titres (Spotify API — total : ${data.total})</p>` : '';
    prev.innerHTML = `
      <div class="import-preview-header">
        ${data.cover ? `<img class="import-preview-cover" src="${data.cover}" alt="">` : ''}
        <div>
          <div class="import-preview-name">${esc(data.name)}</div>
          <div class="import-preview-count">${data.tracks.length} titres${data.truncated ? ` / ${data.total}` : ''}</div>
        </div>
      </div>
      ${truncNote}
      <div class="import-actions">
        <button class="btn-accent sm" onclick="confirmImport('spotify')">Tout importer (${data.tracks.length} titres)</button>
        <button class="btn-ghost sm" onclick="document.getElementById('import-spotify-preview').innerHTML=''">Annuler</button>
      </div>`;
  } catch (e) {
    prev.innerHTML = `<p style="color:#f87171;font-size:.83rem">${e.message}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Importer';
  }
}

// ─── Import Deezer ────────────────────────────────────────────────────────────
function extractDeezerId(input) {
  input = input.trim();
  const m = input.match(/playlist\/(\d+)/);
  if (m) return m[1];
  if (/^\d+$/.test(input)) return input;
  return null;
}

async function importDeezer() {
  const raw = document.getElementById('deezer-pl-url').value.trim();
  const id  = extractDeezerId(raw);
  const prev = document.getElementById('import-deezer-preview');
  if (!id) { prev.innerHTML = '<p style="color:#f87171;font-size:.83rem">URL ou ID Deezer invalide.</p>'; return; }

  const btn = document.getElementById('importDeezerBtn');
  btn.disabled = true; btn.textContent = '...';
  prev.innerHTML = '<p style="color:var(--dim);font-size:.83rem">Chargement...</p>';

  try {
    const r    = await fetch(`/api/deezer/playlist/${id}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    importPreviewTracks = data.tracks;
    prev.innerHTML = `
      <div class="import-preview-header">
        ${data.cover ? `<img class="import-preview-cover" src="${data.cover}" alt="">` : ''}
        <div>
          <div class="import-preview-name">${esc(data.name)}</div>
          <div class="import-preview-count">${data.tracks.length} titres</div>
        </div>
      </div>
      <div class="import-actions">
        <button class="btn-accent sm" onclick="confirmImport('deezer')">Tout importer (${data.tracks.length} titres)</button>
        <button class="btn-ghost sm" onclick="document.getElementById('import-deezer-preview').innerHTML=''">Annuler</button>
      </div>`;
  } catch (e) {
    prev.innerHTML = `<p style="color:#f87171;font-size:.83rem">${e.message}</p>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Importer';
  }
}

// ─── Confirm import (bulk insert) ────────────────────────────────────────────
async function confirmImport(source) {
  if (!importPreviewTracks.length) return;

  const previewEl = document.getElementById(`import-${source}-preview`);
  previewEl.innerHTML = '<p style="color:var(--dim);font-size:.83rem">Import en cours...</p>';

  // Filtrer les doublons sur external_id déjà présents
  const existingIds = new Set(editorTracks.map(t => t.external_id).filter(Boolean));
  const newTracks   = importPreviewTracks.filter(t => !existingIds.has(t.external_id));

  if (!newTracks.length) {
    previewEl.innerHTML = '<p style="color:var(--dim);font-size:.83rem">Tous les titres sont déjà dans la playlist.</p>';
    return;
  }

  const rows = newTracks.map((t, i) => ({
    playlist_id: editingPl.id,
    artist:      t.artist,
    title:       t.title,
    preview_url: t.preview_url  || null,
    cover_url:   t.cover_url    || null,
    source:      t.source,
    external_id: t.external_id  || null,
    position:    editorTracks.length + i,
  }));

  const { data, error } = await sb.from('custom_playlist_tracks').insert(rows).select();
  if (error) {
    previewEl.innerHTML = `<p style="color:#f87171;font-size:.83rem">${error.message}</p>`;
    return;
  }

  editorTracks = editorTracks.concat(data);
  renderEditorTracks();
  updateEditorCount();
  previewEl.innerHTML = '';
  importPreviewTracks = [];
  toast(`${data.length} titre${data.length !== 1 ? 's' : ''} importé${data.length !== 1 ? 's' : ''} !`, 'success');
}

// ─── Add manual track ─────────────────────────────────────────────────────────
async function addManual() {
  const artist  = document.getElementById('manual-artist').value.trim();
  const title   = document.getElementById('manual-title').value.trim();
  const preview = document.getElementById('manual-preview').value.trim();
  const errEl   = document.getElementById('manual-error');

  if (!artist || !title) { showErr(errEl, 'Artiste et titre sont requis.'); return; }

  const btn = document.getElementById('addManualBtn');
  btn.disabled = true;
  const ok = await addTrack({ artist, title, preview_url: preview || null, source: 'manual' });
  btn.disabled = false;

  if (ok) {
    document.getElementById('manual-artist').value  = '';
    document.getElementById('manual-title').value   = '';
    document.getElementById('manual-preview').value = '';
    errEl.style.display = 'none';
    toast('Titre ajouté !', 'success');
  }
}

// ─── Bindings ─────────────────────────────────────────────────────────────────
function bindNavAuth() {
  document.getElementById('openLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('openRegisterBtn')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('logoutBtn')?.addEventListener('click', () => sb?.auth.signOut());
  document.getElementById('wallLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('wallRegisterBtn')?.addEventListener('click', () => openAuthModal('register'));

  const trigger  = document.getElementById('nav-profile-trigger');
  const dropdown = document.getElementById('nav-dropdown');
  if (trigger && dropdown) {
    trigger.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }
}

function bindModals() {
  document.getElementById('newPlaylistBtn').addEventListener('click', () => openPlaylistModal());
  document.getElementById('closePlaylistModal').addEventListener('click', closePlaylistModal);
  document.getElementById('cancelPlaylistModal').addEventListener('click', closePlaylistModal);
  document.getElementById('savePlaylistBtn').addEventListener('click', savePlaylist);
  document.getElementById('pl-name').addEventListener('keypress', e => { if (e.key === 'Enter') savePlaylist(); });
  document.getElementById('modal-playlist').addEventListener('click', e => { if (e.target === e.currentTarget) closePlaylistModal(); });

  // Auth modal
  document.getElementById('closeModal').addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
  document.getElementById('switchToRegister').addEventListener('click', e => { e.preventDefault(); showView('register'); });
  document.getElementById('switchToLogin').addEventListener('click', e => { e.preventDefault(); showView('login'); });
  document.getElementById('closeConfirm').addEventListener('click', closeAuthModal);
  document.getElementById('loginSubmit').addEventListener('click', handleLogin);
  document.getElementById('loginPassword').addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('registerSubmit').addEventListener('click', handleRegister);
  document.getElementById('googleLoginBtn')?.addEventListener('click', () => {
    sb?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
  });
}

function bindEditor() {
  document.getElementById('closeEditorModal').addEventListener('click', closeEditorModal);
  document.getElementById('modal-editor').addEventListener('click', e => { if (e.target === e.currentTarget) closeEditorModal(); });
  document.getElementById('editPlaylistInfoBtn').addEventListener('click', () => openPlaylistModal(editingPl));
  document.getElementById('deletePlaylistBtn').addEventListener('click', deletePlaylist);
  document.getElementById('launchRoomBtn').addEventListener('click', openRoomSettings);

  // Room settings modal
  document.getElementById('closeRoomSettingsModal').addEventListener('click', closeRoomSettings);
  document.getElementById('cancelRoomSettings').addEventListener('click', closeRoomSettings);
  document.getElementById('confirmRoomSettings').addEventListener('click', createRoom);
  document.getElementById('modal-room-settings').addEventListener('click', e => { if (e.target === e.currentTarget) closeRoomSettings(); });

  // Range labels
  const mkRange = (id, valId, suffix = '') => {
    const el  = document.getElementById(id);
    const val = document.getElementById(valId);
    el.addEventListener('input', () => { val.textContent = el.value + suffix; });
  };
  mkRange('rs-rounds',   'rs-rounds-val');
  mkRange('rs-duration', 'rs-duration-val', 's');
  mkRange('rs-break',    'rs-break-val',    's');

  // Room code modal
  document.getElementById('closeRoomCodeModal').addEventListener('click', () => { document.getElementById('modal-room-code').style.display = 'none'; });
  document.getElementById('copyRoomCodeBtn').addEventListener('click', copyRoomLink);
  document.getElementById('joinRoomNowBtn').addEventListener('click', joinRoomNow);

  // Tabs
  document.querySelectorAll('.etab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search
  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('search-query').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
  document.querySelectorAll('.src-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchSource = btn.dataset.src;
    });
  });

  // Import
  document.getElementById('importSpotifyBtn').addEventListener('click', importSpotify);
  document.getElementById('importDeezerBtn').addEventListener('click', importDeezer);
  document.getElementById('spotify-pl-url').addEventListener('keypress', e => { if (e.key === 'Enter') importSpotify(); });
  document.getElementById('deezer-pl-url').addEventListener('keypress', e => { if (e.key === 'Enter') importDeezer(); });

  // Manual
  document.getElementById('addManualBtn').addEventListener('click', addManual);
}

// ─── Room creation ────────────────────────────────────────────────────────────
let _createdRoomCode = null;

function openRoomSettings() {
  if (!editingPl) return;
  if (editorTracks.length < 3) { toast('Il faut au moins 3 titres dans la playlist.', 'error'); return; }

  // Ajuster le max des manches au nb de titres
  const maxEl = document.getElementById('rs-rounds');
  maxEl.max = editorTracks.length;
  maxEl.value = Math.min(10, editorTracks.length);
  document.getElementById('rs-rounds-val').textContent = maxEl.value;
  document.getElementById('rs-duration-val').textContent = document.getElementById('rs-duration').value + 's';
  document.getElementById('rs-break-val').textContent    = document.getElementById('rs-break').value + 's';
  document.getElementById('room-settings-pl-name').textContent = `Playlist : ${editingPl.emoji} ${editingPl.name} — ${editorTracks.length} titre${editorTracks.length !== 1 ? 's' : ''}`;
  document.getElementById('room-settings-error').style.display = 'none';
  document.getElementById('modal-room-settings').style.display = 'flex';
}

function closeRoomSettings() { document.getElementById('modal-room-settings').style.display = 'none'; }

async function createRoom() {
  const btn = document.getElementById('confirmRoomSettings');
  const errEl = document.getElementById('room-settings-error');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Création...';

  try {
    const r = await fetch('/api/rooms/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          editingPl.name,
        emoji:         editingPl.emoji,
        tracks:        editorTracks,
        maxRounds:     parseInt(document.getElementById('rs-rounds').value),
        roundDuration: parseInt(document.getElementById('rs-duration').value),
        breakDuration: parseInt(document.getElementById('rs-break').value),
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

    _createdRoomCode = data.code;
    closeRoomSettings();
    showRoomCode(data.code);
  } catch (e) {
    showErr(errEl, e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Créer la room';
  }
}

function showRoomCode(code) {
  const url = `${location.origin}/game?roomId=${code}`;
  document.getElementById('room-code-display').textContent = code;
  document.getElementById('room-share-url').textContent    = url;
  document.getElementById('modal-room-code').style.display = 'flex';
}

function copyRoomLink() {
  if (!_createdRoomCode) return;
  const url = `${location.origin}/game?roomId=${_createdRoomCode}`;
  navigator.clipboard.writeText(url).then(() => toast('Lien copié !', 'success')).catch(() => toast('Copie échouée', 'error'));
}

function joinRoomNow() {
  if (!_createdRoomCode) return;
  const name = currentUser?.profile?.username || currentUser?.email?.split('@')[0] || 'Joueur';
  const uid  = currentUser?.id || '';
  const p    = new URLSearchParams({ roomId: _createdRoomCode, username: name, userId: uid, isGuest: uid ? '0' : '1' });
  window.location.href = `/game?${p}`;
}

// ─── Auth actions ─────────────────────────────────────────────────────────────
async function handleLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!sb) return showErr(errEl, 'Supabase non configuré.');
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPassword').value;
  if (!email || !pwd) return showErr(errEl, 'Remplis tous les champs.');
  const btn = document.getElementById('loginSubmit');
  btn.disabled = true; btn.textContent = 'Connexion...';
  const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
  btn.disabled = false; btn.textContent = 'Se connecter';
  if (error) showErr(errEl, error.message.includes('invalid') ? 'Email ou mot de passe incorrect.' : error.message);
}

async function handleRegister() {
  const errEl = document.getElementById('register-error');
  errEl.style.display = 'none';
  if (!sb) return showErr(errEl, 'Supabase non configuré.');
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const pwd      = document.getElementById('regPassword').value;
  if (!username || !email || !pwd) return showErr(errEl, 'Remplis tous les champs.');
  if (username.length < 3) return showErr(errEl, 'Pseudo trop court.');
  if (pwd.length < 6)      return showErr(errEl, 'Mot de passe trop court (min. 6 caractères).');
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) return showErr(errEl, 'Pseudo invalide.');
  const { data: exists } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  if (exists) return showErr(errEl, 'Ce pseudo est déjà pris.');
  const btn = document.getElementById('registerSubmit');
  btn.disabled = true; btn.textContent = 'Création...';
  const { error } = await sb.auth.signUp({ email, password: pwd, options: { data: { username } } });
  btn.disabled = false; btn.textContent = 'Créer mon compte';
  if (error) showErr(errEl, error.message);
  else showView('confirm');
}

// ─── Auth modal helpers ────────────────────────────────────────────────────────
function openAuthModal(view) {
  showView(view);
  document.getElementById('auth-modal').style.display = 'flex';
  setTimeout(() => { const f = document.querySelector(`#view-${view} input`); if (f) f.focus(); }, 80);
}
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }
function showView(v) {
  ['login', 'register', 'confirm'].forEach(n => {
    document.getElementById(`view-${n}`).style.display = n === v ? 'block' : 'none';
  });
}

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

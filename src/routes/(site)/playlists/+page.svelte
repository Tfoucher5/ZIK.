<script>
  import { onMount, getContext } from 'svelte';
  import { page } from '$app/stores';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const spotifyClientId = _ctx.spotifyClientId;
  const user = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  // Playlists list
  let playlists = $state([]);
  let plLoading = $state(true);

  // Playlist modal (create/edit)
  let plModalOpen  = $state(false);
  let editingPl    = $state(null);
  let plName       = $state('');
  let plEmoji      = $state('&#x1F3B5;');
  let plPublic     = $state(false);
  let plError      = $state('');
  let plSaving     = $state(false);

  // Editor modal
  let editorOpen   = $state(false);
  let editorPl     = $state(null);
  let editorTracks = $state([]);
  let editorTab    = $state('search');
  let isAdmin      = $derived(user?.profile?.role === 'super_admin');

  // Search
  let searchQuery   = $state('');
  let searchSource  = $state('deezer');
  let searchResults = $state([]);
  let searchLoading = $state(false);

  // Import Spotify
  let spotifyUrl       = $state('');
  let spImportPreview  = $state(null);
  let spLoading        = $state(false);
  let spConnected      = $state(false);

  // Import Deezer
  let deezerUrl       = $state('');
  let dzImportPreview = $state(null);
  let dzLoading       = $state(false);

  // Manual
  let manArtist  = $state('');
  let manTitle   = $state('');
  let manPreview = $state('');
  let manError   = $state('');

  // Admin section
  let adminOfficials = $state([]);
  let adminIsOfficial = $state(false);
  let adminLinkedRoom = $state('');

  // Éditeur de réponses custom par track
  let answersModalOpen  = $state(false);
  let answersTrack      = $state(null);  // { id, artist, title }
  let answersData       = $state([]);    // [{ id?, answer_type_id, value }]
  let answersTypes      = $state([]);    // [{ id, name }]
  let answersSaving     = $state(false);

  async function openAnswersEditor(track) {
    answersTrack = track;
    answersData  = [];
    answersTypes = [];
    answersModalOpen = true;
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/playlists/tracks/${track.id}/answers`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    answersTypes = json.types || [];
    answersData  = (json.answers || []).map(a => ({
      answer_type_id: a.answer_type_id,
      value: a.value,
    }));
  }

  function addAnswerRow() {
    answersData = [...answersData, { answer_type_id: answersTypes[0]?.id ?? 1, value: '' }];
  }

  function removeAnswerRow(i) {
    answersData = answersData.filter((_, idx) => idx !== i);
  }

  async function saveAnswers() {
    answersSaving = true;
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/playlists/tracks/${answersTrack.id}/answers`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ answers: answersData }),
    });
    answersSaving = false;
    if (res.ok) {
      toast('Réponses enregistrées', 'success');
      answersModalOpen = false;
    } else {
      const j = await res.json();
      toast(j.error || 'Erreur', 'error');
    }
  }

  // Room settings (ephemeral room from playlist)
  let rsOpen     = $state(false);
  let rsRounds   = $state(10);
  let rsDuration = $state(30);
  let rsBreak    = $state(7);
  let rsError    = $state('');
  let rsSaving   = $state(false);

  // Room code modal (after creation)
  let rcOpen = $state(false);
  let rcCode = $state('');

  let toastMsg  = $state('');
  let toastType = $state('');
  let _tt = null;
  function toast(msg, type = '') {
    clearTimeout(_tt); toastMsg = msg; toastType = type;
    _tt = setTimeout(() => { toastMsg = ''; }, 3200);
  }

  // ─── Spotify token helpers ─────────────────────────────────────────────────
  function getSpotifyToken() {
    const t   = sessionStorage.getItem('sp_token');
    const exp = parseInt(sessionStorage.getItem('sp_token_exp') || '0');
    return (t && Date.now() < exp) ? t : null;
  }
  function clearSpotifyToken() {
    sessionStorage.removeItem('sp_token');
    sessionStorage.removeItem('sp_token_exp');
  }

  // ─── PKCE helpers ──────────────────────────────────────────────────────────
  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }
  function genVerifier(len = 64) { return b64url(crypto.getRandomValues(new Uint8Array(len))); }
  async function genChallenge(v) { return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))); }

  async function connectSpotify() {
    const clientId = spotifyClientId;
    if (!clientId) { toast('SPOTIFY_CLIENT_ID non configur\u00e9.', 'error'); return; }
    const verifier  = genVerifier();
    const challenge = await genChallenge(verifier);
    sessionStorage.setItem('sp_verifier', verifier);
    const params = new URLSearchParams({
      response_type: 'code', client_id: clientId,
      scope: 'playlist-read-private playlist-read-collaborative user-read-private',
      redirect_uri: window.location.origin + '/playlists', code_challenge_method: 'S256',
      code_challenge: challenge, state: 'sp_import',
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + params;
  }

  function disconnectSpotify() { clearSpotifyToken(); spConnected = false; toast('Spotify d\u00e9connect\u00e9.', 'success'); }

  async function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    if (params.get('error') || !code || state !== 'sp_import') {
      if (params.get('error')) history.replaceState({}, '', '/playlists');
      return;
    }
    history.replaceState({}, '', '/playlists');
    const verifier = sessionStorage.getItem('sp_verifier');
    const clientId = spotifyClientId;
    if (!verifier || !clientId) return;
    try {
      const r = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: window.location.origin + '/playlists', client_id: clientId, code_verifier: verifier }),
      });
      const json = await r.json();
      if (!json.access_token) throw new Error(json.error_description || 'Token exchange failed');
      sessionStorage.setItem('sp_token',     json.access_token);
      sessionStorage.setItem('sp_token_exp', Date.now() + json.expires_in * 1000);
      sessionStorage.removeItem('sp_verifier');
      spConnected = true;
      toast('Spotify connect\u00e9 !', 'success');
    } catch (e) { toast('Erreur Spotify : ' + e.message, 'error'); }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    await handleSpotifyCallback();
    spConnected = !!getSpotifyToken();
    if (!sb || !user) { plLoading = false; return; }
    await loadPlaylists();
  });

  // Reload playlists when user logs in after page load (async auth resolution)
  let _lastLoadedUid = null;
  $effect(() => {
    const uid = user?.id;
    if (uid && uid !== _lastLoadedUid && sb) {
      _lastLoadedUid = uid;
      loadPlaylists();
    }
  });

  async function ensureSession() {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) throw new Error('Session expir\u00e9e \u2014 reconnecte-toi.');
    const exp = session.expires_at * 1000;
    if (exp - Date.now() < 60_000) {
      const { data, error: rErr } = await sb.auth.refreshSession();
      if (rErr || !data.session) throw new Error('Session expir\u00e9e \u2014 reconnecte-toi.');
    }
    return session;
  }

  async function loadPlaylists() {
    plLoading = true;
    const { data, error } = await sb.from('custom_playlists').select('*, custom_playlist_tracks!playlist_id(count)').eq('owner_id', user.id).order('updated_at', { ascending: false });
    if (data) data.forEach(pl => { pl.track_count = pl.custom_playlist_tracks?.[0]?.count ?? 0; });
    plLoading = false;
    playlists = error ? [] : (data || []);
  }

  // ─── Playlist create/edit modal ────────────────────────────────────────────
  function openPlModal(pl = null) {
    editingPl = pl;
    plName   = pl?.name   ?? '';
    plEmoji  = pl?.emoji  ?? '🎵';
    plPublic = pl?.is_public ?? false;
    plError  = '';
    plModalOpen = true;
    setTimeout(() => document.getElementById('pl-name-input')?.focus(), 80);
  }

  async function savePl() {
    const name = plName.trim();
    const emoji = plEmoji.trim() || '🎵';
    if (!name) { plError = 'Le nom est requis.'; return; }
    plSaving = true; plError = '';
    try { await ensureSession(); } catch (e) { plError = e.message; plSaving = false; return; }

    if (editingPl) {
      const { error } = await sb.from('custom_playlists')
        .update({ name, emoji, is_public: plPublic, updated_at: new Date().toISOString() })
        .eq('id', editingPl.id);
      if (error) { plError = error.message; plSaving = false; return; }
      toast('Playlist mise \u00e0 jour', 'success');
      if (editorOpen && editorPl?.id === editingPl.id) {
        editorPl = { ...editorPl, name, emoji, is_public: plPublic };
      }
    } else {
      const { data, error } = await sb.from('custom_playlists')
        .insert({ owner_id: user.id, name, emoji, is_public: plPublic })
        .select().single();
      if (error) { plError = error.message; plSaving = false; return; }
      toast('Playlist cr\u00e9\u00e9e !', 'success');
      plModalOpen = false;
      await loadPlaylists();
      openEditor(data);
      plSaving = false;
      return;
    }
    plSaving = false;
    plModalOpen = false;
    await loadPlaylists();
  }

  // ─── Editor ────────────────────────────────────────────────────────────────
  async function openEditor(pl) {
    editorPl = pl;
    editorTracks = [];
    editorTab = 'search';
    searchResults = [];
    spImportPreview = null;
    dzImportPreview = null;
    searchQuery = ''; spotifyUrl = ''; deezerUrl = '';
    editorOpen = true;
    await loadEditorTracks();
    if (isAdmin) await loadAdminRooms();
    adminIsOfficial = !!pl.is_official;
    adminLinkedRoom = pl.linked_room_id || '';
  }

  async function loadEditorTracks() {
    const { data, error } = await sb.from('custom_playlist_tracks').select('*').eq('playlist_id', editorPl.id).order('position');
    if (error) { toast(error.message, 'error'); return; }
    editorTracks = data || [];
  }

  async function removeTrack(trackId) {
    const { error } = await sb.from('custom_playlist_tracks').delete().eq('id', trackId);
    if (error) { toast(error.message, 'error'); return; }
    editorTracks = editorTracks.filter(t => t.id !== trackId);
  }

  function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  async function addTrack(trackData) {
    const extId = trackData.external_id;
    const norm  = normalize(trackData.artist) + '|' + normalize(trackData.title);
    const isDup = editorTracks.some(t => (extId && t.external_id === extId) || (normalize(t.artist) + '|' + normalize(t.title)) === norm);
    if (isDup) { toast('Ce titre est d\u00e9j\u00e0 dans la playlist.', 'error'); return false; }
    try { await ensureSession(); } catch (e) { toast(e.message, 'error'); return false; }
    const { data, error } = await sb.from('custom_playlist_tracks').insert({
      playlist_id: editorPl.id, artist: trackData.artist, title: trackData.title,
      preview_url: trackData.preview_url || null, cover_url: trackData.cover_url || null,
      source: trackData.source || 'manual', external_id: trackData.external_id || null,
      position: editorTracks.length,
    }).select().single();
    if (error) { toast(error.message, 'error'); return false; }
    editorTracks = [...editorTracks, data];
    return true;
  }

  async function deletePl() {
    if (!editorPl) return;
    if (!confirm(`Supprimer "${editorPl.name}" ? Cette action est irr\u00e9versible.`)) return;
    const deletedId = editorPl.id;
    editorOpen = false; editorPl = null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(`/api/playlists/${deletedId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      toast('Playlist supprim\u00e9e.', 'success');
      await loadPlaylists();
    } catch (e) { toast('Erreur suppression : ' + e.message, 'error'); }
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  async function doSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    searchLoading = true; searchResults = []; _addingIdx = {};
    try {
      const r = await fetch(`/api/${searchSource}/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      searchResults = data;
    } catch (e) { toast(e.message, 'error'); }
    searchLoading = false;
  }

  let _addingIdx = $state({});
  async function addFromSearch(i) {
    _addingIdx = { ..._addingIdx, [i]: true };
    const ok = await addTrack(searchResults[i]);
    _addingIdx = { ..._addingIdx, [i]: ok ? 'done' : false };
  }

  // ─── Spotify import ────────────────────────────────────────────────────────
  function extractSpotifyId(input) {
    const m = input.trim().match(/playlist\/([a-zA-Z0-9]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9]{22}$/.test(input.trim())) return input.trim();
    return null;
  }

  async function importSpotify() {
    const id = extractSpotifyId(spotifyUrl);
    if (!id) { toast('URL ou ID Spotify invalide.', 'error'); return; }
    const token = getSpotifyToken();
    if (!token) { toast('Connecte ton compte Spotify d\u2019abord.', 'error'); return; }
    spLoading = true; spImportPreview = null;
    try {
      const r = await fetch(`/api/spotify/playlist-user/${id}`, { headers: { 'X-Spotify-Token': token } });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 401) clearSpotifyToken();
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      spImportPreview = data;
    } catch (e) { toast(e.message, 'error'); }
    spLoading = false;
  }

  async function confirmSpotifyImport() {
    if (!spImportPreview) return;
    const existingIds = new Set(editorTracks.map(t => t.external_id).filter(Boolean));
    const newTracks   = spImportPreview.tracks.filter(t => !existingIds.has(t.external_id));
    if (!newTracks.length) { toast('Tous les titres sont d\u00e9j\u00e0 dans la playlist.', 'error'); return; }
    try { await ensureSession(); } catch (e) { toast(e.message, 'error'); return; }
    const rows = newTracks.map((t, i) => ({ playlist_id: editorPl.id, artist: t.artist, title: t.title, preview_url: t.preview_url || null, cover_url: t.cover_url || null, source: t.source, external_id: t.external_id || null, position: editorTracks.length + i }));
    const { data, error } = await sb.from('custom_playlist_tracks').insert(rows).select();
    if (error) { toast(error.message, 'error'); return; }
    editorTracks = [...editorTracks, ...data];
    spImportPreview = null;
    toast(`${data.length} titre${data.length !== 1 ? 's' : ''} import\u00e9${data.length !== 1 ? 's' : ''} !`, 'success');
  }

  // ─── Deezer import ─────────────────────────────────────────────────────────
  function extractDeezerId(input) {
    const m = input.trim().match(/playlist\/(\d+)/);
    if (m) return m[1];
    if (/^\d+$/.test(input.trim())) return input.trim();
    return null;
  }

  async function importDeezer() {
    const id = extractDeezerId(deezerUrl);
    if (!id) { toast('URL ou ID Deezer invalide.', 'error'); return; }
    dzLoading = true; dzImportPreview = null;
    try {
      const r = await fetch(`/api/deezer/playlist/${id}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      dzImportPreview = data;
    } catch (e) { toast(e.message, 'error'); }
    dzLoading = false;
  }

  async function confirmDeezerImport() {
    if (!dzImportPreview) return;
    const existingIds = new Set(editorTracks.map(t => t.external_id).filter(Boolean));
    const newTracks   = dzImportPreview.tracks.filter(t => !existingIds.has(t.external_id));
    if (!newTracks.length) { toast('Tous les titres sont d\u00e9j\u00e0 dans la playlist.', 'error'); return; }
    try { await ensureSession(); } catch (e) { toast(e.message, 'error'); return; }
    const rows = newTracks.map((t, i) => ({ playlist_id: editorPl.id, artist: t.artist, title: t.title, preview_url: t.preview_url || null, cover_url: t.cover_url || null, source: t.source, external_id: t.external_id || null, position: editorTracks.length + i }));
    const { data, error } = await sb.from('custom_playlist_tracks').insert(rows).select();
    if (error) { toast(error.message, 'error'); return; }
    editorTracks = [...editorTracks, ...data];
    dzImportPreview = null;
    toast(`${data.length} titre${data.length !== 1 ? 's' : ''} import\u00e9${data.length !== 1 ? 's' : ''} !`, 'success');
  }

  // ─── Manual add ────────────────────────────────────────────────────────────
  async function addManual() {
    const artist  = manArtist.trim();
    const title   = manTitle.trim();
    const preview = manPreview.trim();
    if (!artist || !title) { manError = 'Artiste et titre sont requis.'; return; }
    manError = '';
    const ok = await addTrack({ artist, title, preview_url: preview || null, source: 'manual' });
    if (ok) { manArtist = ''; manTitle = ''; manPreview = ''; toast('Titre ajout\u00e9 !', 'success'); }
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────
  async function loadAdminRooms() {
    try {
      const r = await fetch('/api/rooms/official');
      adminOfficials = r.ok ? await r.json() : [];
    } catch { adminOfficials = []; }
  }

  async function saveOfficial() {
    if (!isAdmin || !editorPl) return;
    const { data: { session } } = await sb.auth.getSession();
    try {
      const r = await fetch(`/api/playlists/${editorPl.id}/official`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ is_official: adminIsOfficial, linked_room_id: adminLinkedRoom || null }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      toast('Statut officiel mis \u00e0 jour.', 'success');
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  }

  // ─── Room settings (ephemeral) ─────────────────────────────────────────────
  function openRoomSettings() {
    if (!editorPl) return;
    if (editorTracks.length < 3) { toast('Il faut au moins 3 titres dans la playlist.', 'error'); return; }
    rsRounds   = Math.min(10, editorTracks.length);
    rsDuration = 30; rsBreak = 7; rsError = '';
    rsOpen = true;
  }

  async function createRoom() {
    rsSaving = true; rsError = '';
    try {
      const r = await fetch('/api/rooms/custom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editorPl.name, emoji: editorPl.emoji, tracks: editorTracks,
          maxRounds: rsRounds, roundDuration: rsDuration, breakDuration: rsBreak,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      rcCode = data.code; rsOpen = false; rcOpen = true;
    } catch (e) { rsError = e.message; }
    rsSaving = false;
  }

  function joinRoomNow() {
    const username = user?.profile?.username || user?.email?.split('@')[0] || 'Joueur';
    const uid      = user?.id || '';
    const p        = new URLSearchParams({ roomId: rcCode, username, userId: uid, isGuest: uid ? '0' : '1' });
    window.location.href = `/game?${p}`;
  }

  function copyLink() {
    const url = `${location.origin}/game?roomId=${rcCode}`;
    navigator.clipboard.writeText(url).then(() => toast('Lien copi\u00e9 !', 'success')).catch(() => toast('Copie \u00e9chou\u00e9e', 'error'));
  }
</script>

<svelte:head>
  <title>ZIK — Mes Playlists | Importe depuis Spotify et Deezer</title>
  <meta name="description" content="Crée et gère tes playlists de blind test. Importe depuis Spotify ou Deezer, ajoute tes titres favoris et lance une room privée avec tes amis.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.zik-music.fr/playlists">
  <link rel="stylesheet" href="/css/playlists.css">
</svelte:head>

<div class="pl-header">
  <div class="pl-header-inner">
    <h1>Mes <em>Playlists</em></h1>
    <p class="pl-sub">Crée et gère tes playlists personnalisées pour le blind test.</p>
    {#if user}
      <button class="btn-accent" onclick={() => openPlModal()}>+ Nouvelle playlist</button>
    {/if}
  </div>
</div>

<div class="pl-main">
  {#if !authReady && !user}
    <div class="pl-loading">Chargement...</div>
  {:else if !user}
    <div class="auth-wall">
      <div class="auth-wall-icon">&#x1F3B5;</div>
      <h2>Connecte-toi pour accéder à tes playlists</h2>
      <p>Crée un compte gratuit pour sauvegarder et partager tes playlists.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
        <button class="btn-ghost" onclick={() => openAuthModal('login')}>Se connecter</button>
        <button class="btn-accent" onclick={() => openAuthModal('register')}>Créer un compte</button>
      </div>
    </div>
  {:else if plLoading}
    <div class="pl-loading">Chargement...</div>
  {:else}
    <div id="playlists-grid" class="playlists-grid">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="pl-card pl-card-new" onclick={() => openPlModal()}>
        <span class="pl-card-new-icon">+</span>
        <span>Nouvelle playlist</span>
      </div>
      {#each playlists as pl (pl.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="pl-card" onclick={() => openEditor(pl)}>
          <span class="pl-card-emoji">{pl.emoji}</span>
          <div class="pl-card-name">{pl.name}</div>
          <div class="pl-card-meta">{pl.track_count ?? 0} titre{(pl.track_count ?? 0) !== 1 ? 's' : ''}</div>
          <div class="pl-card-footer">
            <span class="pl-card-badge {pl.is_public ? '' : 'private'}">{pl.is_public ? 'Publique' : 'Privée'}</span>
            <button class="pl-card-edit" onclick={e => { e.stopPropagation(); openEditor(pl); }}>Modifier &rarr;</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Playlist create/edit modal -->
{#if plModalOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div id="modal-playlist" class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) plModalOpen = false; }}>
  <div class="modal modal-lg">
    <button class="close-btn" onclick={() => plModalOpen = false}>&#x2715;</button>
    <h2>{editingPl ? 'Modifier la playlist' : 'Nouvelle playlist'}</h2>
    <p class="mdesc">Donne un nom et un emoji à ta playlist.</p>
    <div class="pl-form-row">
      <div class="field" style="flex:0 0 80px"><label for="emoji">Emoji</label><input type="text" bind:value={plEmoji} maxlength="4" class="emoji-input"></div>
      <div class="field" style="flex:1"><label for="nom">Nom</label><input id="pl-name-input" type="text" bind:value={plName} placeholder="Ma playlist rap" maxlength="60"
        onkeypress={e => { if (e.key === 'Enter') savePl(); }}></div>
    </div>
    <div class="field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" bind:checked={plPublic} style="width:auto;accent-color:var(--accent)">
        Rendre cette playlist publique
      </label>
    </div>
    {#if plError}<div class="alert-err">{plError}</div>{/if}
    <div class="modal-footer">
      <button class="btn-ghost" onclick={() => plModalOpen = false}>Annuler</button>
      <button class="btn-accent" onclick={savePl} disabled={plSaving}>{plSaving ? '...' : editingPl ? 'Enregistrer' : 'Créer'}</button>
    </div>
  </div>
</div>
{/if}

<!-- Editor modal -->
{#if editorOpen && editorPl}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) editorOpen = false; }}>
  <div class="modal modal-xl">
    <button class="close-btn" onclick={() => editorOpen = false}>&#x2715;</button>

    <div class="editor-header">
      <span class="editor-pl-emoji">{editorPl.emoji}</span>
      <div>
        <h2>{editorPl.name}</h2>
        <span class="pill">{editorTracks.length} titre{editorTracks.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="editor-header-actions">
        <button class="btn-ghost sm" onclick={() => openPlModal(editorPl)}>Modifier</button>
        <button class="btn-accent sm" onclick={openRoomSettings}>Lancer une room &rarr;</button>
        <button class="btn-danger sm" onclick={deletePl}>Supprimer</button>
      </div>
    </div>

    <!-- Admin section -->
    {#if isAdmin}
    <div class="admin-section">
      <div class="admin-section-title">Admin &mdash; Playlist officielle</div>
      <div class="admin-row">
        <label class="admin-label">
          <input type="checkbox" bind:checked={adminIsOfficial} style="width:auto;accent-color:var(--accent)">
          Marquer comme playlist officielle
        </label>
      </div>
      <div class="admin-row">
        <label class="admin-label" style="flex:1" for="linkedRoom">Room liée</label>
        <select bind:value={adminLinkedRoom} class="admin-select">
          <option value="">&mdash; Aucune &mdash;</option>
          {#each adminOfficials as r (r.id)}
            <option value={r.id}>{r.emoji || ''} {r.name}</option>
          {/each}
        </select>
      </div>
      <button class="btn-accent sm" onclick={saveOfficial}>Enregistrer</button>
    </div>
    {/if}

    <!-- Tabs -->
    <div class="editor-tabs">
      {#each ['search','import-spotify','import-deezer','manual'] as t}
        {@const labels = { search: 'Rechercher un titre', 'import-spotify': 'Importer Spotify', 'import-deezer': 'Importer Deezer', manual: 'Ajouter manuellement' }}
        <button class="etab" class:active={editorTab === t} onclick={() => editorTab = t}
          style={t === 'import-spotify' && !isAdmin ? 'display:none' : ''}>{labels[t]}</button>
      {/each}
    </div>

    <!-- Tab: search -->
    {#if editorTab === 'search'}
    <div class="tab-pane">
      <div class="search-bar">
        <div class="search-source-toggle">
          <button class="src-btn" class:active={searchSource === 'deezer'} onclick={() => searchSource = 'deezer'}>Deezer</button>
          <button class="src-btn" class:active={searchSource === 'spotify'} onclick={() => searchSource = 'spotify'}>Spotify</button>
        </div>
        <input type="text" bind:value={searchQuery} placeholder="Artiste, titre..." autocomplete="off"
          onkeypress={e => { if (e.key === 'Enter') doSearch(); }}>
        <button class="btn-accent sm" onclick={doSearch} disabled={searchLoading}>{searchLoading ? '...' : 'Rechercher'}</button>
      </div>
      <div class="search-results">
        {#each searchResults as t, i (t.external_id || i)}
          <div class="track-row">
            {#if t.cover_url}<img class="track-cover" src={t.cover_url} alt="">{/if}
            <div class="track-info">
              <div class="track-title">{t.title}</div>
              <div class="track-artist">{t.artist}</div>
            </div>
            <span class="track-source">{t.source}</span>
            <button class="track-add-btn" class:added={_addingIdx[i] === 'done'}
              onclick={() => addFromSearch(i)} disabled={!!_addingIdx[i]}>
              {_addingIdx[i] === 'done' ? '✅ Ajouté' : _addingIdx[i] ? '...' : '+ Ajouter'}
            </button>
          </div>
        {/each}
      </div>
    </div>

    <!-- Tab: import-spotify -->
    {:else if editorTab === 'import-spotify'}
    <div class="tab-pane">
      {#if !spotifyClientId}
        <p class="import-hint" style="color:#f87171">Spotify non configuré. Ajoute <code>SPOTIFY_CLIENT_ID</code> dans ton fichier <code>.env</code>.</p>
      {:else if !spConnected}
        <p class="import-hint">Connecte ton compte Spotify pour importer tes playlists (publiques et privées).</p>
        <button class="btn-spotify" onclick={connectSpotify}>Connecter Spotify</button>
      {:else}
        <div class="spotify-connected-bar">
          <span class="spotify-connected-label">&#x2713; Spotify connecté</span>
          <button class="btn-link-sm" onclick={disconnectSpotify}>Déconnecter</button>
        </div>
        <p class="import-hint">Colle l’URL ou l’ID d’une playlist Spotify.</p>
        <div class="search-bar">
          <input type="text" bind:value={spotifyUrl} placeholder="https://open.spotify.com/playlist/... ou ID"
            onkeypress={e => { if (e.key === 'Enter') importSpotify(); }}>
          <button class="btn-accent sm" onclick={importSpotify} disabled={spLoading}>{spLoading ? '...' : 'Importer'}</button>
        </div>
        {#if spImportPreview}
          <div class="import-preview">
            <div class="import-preview-header">
              {#if spImportPreview.cover}<img class="import-preview-cover" src={spImportPreview.cover} alt="">{/if}
              <div>
                <div class="import-preview-name">{spImportPreview.name}</div>
                <div class="import-preview-count">{spImportPreview.tracks.length} titres</div>
              </div>
            </div>
            <div class="import-actions">
              <button class="btn-accent sm" onclick={confirmSpotifyImport}>Tout importer ({spImportPreview.tracks.length} titres)</button>
              <button class="btn-ghost sm" onclick={() => spImportPreview = null}>Annuler</button>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Tab: import-deezer -->
    {:else if editorTab === 'import-deezer'}
    <div class="tab-pane">
      <p class="import-hint">Colle l’URL ou l’ID d’une playlist Deezer publique.</p>
      <div class="search-bar">
        <input type="text" bind:value={deezerUrl} placeholder="https://www.deezer.com/playlist/... ou ID"
          onkeypress={e => { if (e.key === 'Enter') importDeezer(); }}>
        <button class="btn-accent sm" onclick={importDeezer} disabled={dzLoading}>{dzLoading ? '...' : 'Importer'}</button>
      </div>
      {#if dzImportPreview}
        <div class="import-preview">
          <div class="import-preview-header">
            {#if dzImportPreview.cover}<img class="import-preview-cover" src={dzImportPreview.cover} alt="">{/if}
            <div>
              <div class="import-preview-name">{dzImportPreview.name}</div>
              <div class="import-preview-count">{dzImportPreview.tracks.length} titres</div>
            </div>
          </div>
          <div class="import-actions">
            <button class="btn-accent sm" onclick={confirmDeezerImport}>Tout importer ({dzImportPreview.tracks.length} titres)</button>
            <button class="btn-ghost sm" onclick={() => dzImportPreview = null}>Annuler</button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Tab: manual -->
    {:else if editorTab === 'manual'}
    <div class="tab-pane">
      <div class="manual-form">
        <div class="pl-form-row">
          <div class="field" style="flex:1"><label for="artiste">Artiste</label><input type="text" bind:value={manArtist} placeholder="Ex: PNL" maxlength="100"></div>
          <div class="field" style="flex:1"><label for="titre">Titre</label><input type="text" bind:value={manTitle} placeholder="Ex: Au DD" maxlength="100"></div>
        </div>
        <div class="field">
          <label for="url">URL Preview (MP3, 30s) <span style="color:var(--dim);font-weight:400">&mdash; optionnel</span></label>
          <input type="url" bind:value={manPreview} placeholder="https://...mp3">
        </div>
        {#if manError}<div class="alert-err">{manError}</div>{/if}
        <button class="btn-accent" onclick={addManual}>Ajouter à la playlist</button>
      </div>
    </div>
    {/if}

    <!-- Tracks list -->
    <div class="tracks-section">
      <div class="tracks-section-head">
        <h3>Titres dans la playlist</h3>
        {#if !editorTracks.length}<span class="tracks-empty-hint">Ajoute des titres via les onglets ci-dessus.</span>{/if}
      </div>
      <div class="tracks-list">
        {#each editorTracks as t, i (t.id)}
          <div class="track-row-pl">
            <span class="track-num">{i + 1}</span>
            {#if t.cover_url}<img class="track-cover" src={t.cover_url} alt="" onerror={e => e.currentTarget.style.display='none'}>{/if}
            <div class="track-info">
              <div class="track-title">{t.title}</div>
              <div class="track-artist">{t.artist}</div>
            </div>
            <span class="track-source">{t.source}</span>
            <button class="track-answers-btn" title="Réponses custom" onclick={() => openAnswersEditor(t)}>&#x270E;</button>
            <button class="track-remove-btn" onclick={() => removeTrack(t.id)}>&#x2715;</button>
          </div>
        {/each}
      </div>
    </div>

  </div>
</div>
{/if}

<!-- Room settings modal -->
{#if rsOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) rsOpen = false; }}>
  <div class="modal modal-lg">
    <button class="close-btn" onclick={() => rsOpen = false}>&#x2715;</button>
    <div class="room-eph-header">
      <span class="room-eph-badge">&#x26A1; Room éphémère</span>
      <h2>Lancer une room</h2>
      <p class="mdesc">Playlist : {editorPl?.emoji} {editorPl?.name} &mdash; {editorTracks.length} titre{editorTracks.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="room-eph-notice">
      <span class="room-eph-icon">&#x1F4A1;</span>
      <div>Cette room est <strong>temporaire</strong> &mdash; elle disparaîtra automatiquement après 4h d&apos;inactivité.
        Pour créer une room permanente, <a href="/rooms" class="room-eph-link">rendez-vous sur la page Rooms</a>.</div>
    </div>
    <div class="room-settings">
      <div class="room-setting-row">
        <label for="nbManches">Nombre de manches</label>
        <input type="range" bind:value={rsRounds} min="3" max={editorTracks.length} step="1">
        <span class="room-setting-val">{rsRounds}</span>
      </div>
      <div class="room-setting-row">
        <label for="dureeManche">Durée d’une manche (sec)</label>
        <input type="range" bind:value={rsDuration} min="10" max="60" step="5">
        <span class="room-setting-val">{rsDuration}s</span>
      </div>
      <div class="room-setting-row">
        <label for="pause">Pause entre titres (sec)</label>
        <input type="range" bind:value={rsBreak} min="3" max="15" step="1">
        <span class="room-setting-val">{rsBreak}s</span>
      </div>
    </div>
    {#if rsError}<div class="alert-err">{rsError}</div>{/if}
    <div class="modal-footer">
      <button class="btn-ghost" onclick={() => rsOpen = false}>Annuler</button>
      <button class="btn-accent" onclick={createRoom} disabled={rsSaving}>{rsSaving ? 'Création...' : 'Créer la room'}</button>
    </div>
  </div>
</div>
{/if}

<!-- Room code modal -->
{#if rcOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) rcOpen = false; }}>
  <div class="modal modal-lg">
    <button class="close-btn" onclick={() => rcOpen = false}>&#x2715;</button>
    <h2>Room créée !</h2>
    <p class="mdesc">Partage ce code à tes amis pour qu’ils rejoignent la room.</p>
    <div class="room-code-box">
      <div class="room-code-label">Code de la room</div>
      <div class="room-code">{rcCode}</div>
      <div class="room-share-url">{typeof window !== 'undefined' ? `${window.location.origin}/game?roomId=${rcCode}` : ''}</div>
      <div class="room-code-actions">
        <button class="btn-ghost sm" onclick={copyLink}>Copier le lien</button>
        <button class="btn-accent" onclick={joinRoomNow}>Rejoindre maintenant &rarr;</button>
      </div>
    </div>
  </div>
</div>
{/if}

<!-- Modal éditeur de réponses custom -->
{#if answersModalOpen && answersTrack}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true" onclick={e => { if (e.target === e.currentTarget) answersModalOpen = false; }}>
  <div class="modal modal-lg">
    <button class="close-btn" onclick={() => answersModalOpen = false}>&#x2715;</button>
    <h2>Réponses custom</h2>
    <p class="mdesc">
      <strong>{answersTrack.artist} — {answersTrack.title}</strong><br>
      Définis les réponses que les joueurs devront trouver. Si vide, le jeu utilisera artiste + titre par défaut.
    </p>

    <div class="answers-list">
      {#each answersData as row, i}
        <div class="answer-row">
          <select bind:value={row.answer_type_id} class="answer-type-select">
            {#each answersTypes as t}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
          <input
            type="text"
            bind:value={row.value}
            placeholder="Valeur attendue…"
            class="answer-value-input"
            maxlength="100"
          >
          <button class="track-remove-btn" onclick={() => removeAnswerRow(i)}>&#x2715;</button>
        </div>
      {/each}
    </div>

    <button class="btn-ghost sm" onclick={addAnswerRow}>+ Ajouter une réponse</button>

    <div class="modal-actions">
      <button class="btn-ghost" onclick={() => answersModalOpen = false}>Annuler</button>
      <button class="btn-accent" onclick={saveAnswers} disabled={answersSaving}>
        {answersSaving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Toast -->
{#if toastMsg}
  <div class="toast {toastType}" style="display:block">{toastMsg}</div>
{/if}

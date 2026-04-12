<script>
  import { onMount, getContext } from 'svelte';
  import HeroSection from '$lib/components/HeroSection.svelte';
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

  // Éditeur de réponses par track
  let answersModalOpen = $state(false);
  let answersTrack     = $state(null);
  let customArtist     = $state('');
  let customTitle      = $state('');
  let customFeats      = $state([]);
  let extraAnswers     = $state([]); // [{ typeId, value }]
  let answersSaving    = $state(false);

  const EXTRA_ANSWER_TYPES = [
    { id: 3, name: 'Film' },
    { id: 4, name: 'Série' },
    { id: 5, name: 'Personnage' },
    { id: 6, name: 'Jeu vidéo' },
    { id: 7, name: 'Animé' },
  ];

  async function openAnswersEditor(track) {
    answersTrack = track;
    customArtist = '';
    customTitle  = '';
    customFeats  = [];
    extraAnswers = [];
    answersModalOpen = true;
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/playlists/tracks/${track.id}/answers`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    customArtist = data.custom_artist ?? data.default_artist ?? '';
    customTitle  = data.custom_title  ?? data.default_title  ?? '';
    customFeats  = data.custom_feats  ?? data.default_feats  ?? [];
    extraAnswers = (data.extra_answers || []).map(a => ({ typeId: a.answer_type_id, value: a.value }));
  }

  function addCustomFeat() {
    customFeats = [...customFeats, ''];
  }

  function removeCustomFeat(i) {
    customFeats = customFeats.filter((_, idx) => idx !== i);
  }

  async function saveAnswers() {
    answersSaving = true;
    const token = (await sb.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/playlists/tracks/${answersTrack.id}/answers`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        custom_artist: customArtist,
        custom_title:  customTitle,
        custom_feats:  customFeats.filter(f => f.trim()),
        extra_answers: extraAnswers.filter(a => a.typeId && a.value?.trim()).map(a => ({ type_id: a.typeId, value: a.value.trim() })),
      }),
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
  <title>ZIK — Playlists de Jeu Musical en Ligne</title>
  <meta name="description" content="Crée et gère tes playlists de blind test. Importe depuis Spotify ou Deezer, ajoute des titres manuellement, lance une room directement.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.zik-music.fr/playlists">
</svelte:head>

<HeroSection
  title="Tes"
  titleAccent="playlists."
  subtitle="Crée, importe, joue. Spotify, Deezer, ou manuellement."
/>

{#if user}
<div class="pl-toolbar">
  <button class="btn-accent sm" onclick={() => openPlModal()}>+ Nouvelle playlist</button>
</div>
{/if}

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
      <div class="field" style="flex:0 0 80px"><label for="emoji">Emoji</label><input type="text" bind:value={plEmoji} maxlength="4" class="input-glass emoji-input"></div>
      <div class="field" style="flex:1"><label for="nom">Nom</label><input id="pl-name-input" type="text" bind:value={plName} placeholder="Ma playlist rap" maxlength="60" class="input-glass"
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
        <input type="text" bind:value={searchQuery} placeholder="Artiste, titre..." autocomplete="off" class="input-glass"
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
          <input type="text" bind:value={spotifyUrl} placeholder="https://open.spotify.com/playlist/... ou ID" class="input-glass"
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
        <input type="text" bind:value={deezerUrl} placeholder="https://www.deezer.com/playlist/... ou ID" class="input-glass"
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
          <div class="field" style="flex:1"><label for="artiste">Artiste</label><input type="text" bind:value={manArtist} placeholder="Ex: PNL" maxlength="100" class="input-glass"></div>
          <div class="field" style="flex:1"><label for="titre">Titre</label><input type="text" bind:value={manTitle} placeholder="Ex: Au DD" maxlength="100" class="input-glass"></div>
        </div>
        <div class="field">
          <label for="url">URL Preview (MP3, 30s) <span style="color:var(--dim);font-weight:400">&mdash; optionnel</span></label>
          <input type="url" bind:value={manPreview} placeholder="https://...mp3" class="input-glass">
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
    <h2>Modifier les réponses</h2>
    <p class="mdesc">
      <strong>{answersTrack.artist} — {answersTrack.title}</strong><br>
      Corrige l'artiste, les feats ou le titre attendus pour cette track.
    </p>

    <div class="answer-field">
      <label class="answer-label">Artiste principal</label>
      <input type="text" bind:value={customArtist} class="answer-value-input" placeholder="Artiste principal…" maxlength="100">
    </div>

    <div class="answer-field">
      <label class="answer-label">Featuring</label>
      {#each customFeats as _, i}
        <div class="answer-row">
          <input type="text" bind:value={customFeats[i]} class="answer-value-input" placeholder="Nom du feat…" maxlength="100">
          <button class="track-remove-btn" onclick={() => removeCustomFeat(i)}>&#x2715;</button>
        </div>
      {/each}
      <button class="btn-ghost sm" onclick={addCustomFeat}>+ Ajouter un feat</button>
    </div>

    <div class="answer-field">
      <label class="answer-label">Titre</label>
      <input type="text" bind:value={customTitle} class="answer-value-input" placeholder="Titre…" maxlength="100">
    </div>

    <div class="answer-field">
      <label class="answer-label">Réponses supplémentaires (Film, Série…)</label>
      {#each extraAnswers as _, i}
        <div class="answer-row">
          <select bind:value={extraAnswers[i].typeId} class="answer-type-select">
            {#each EXTRA_ANSWER_TYPES as t}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
          <input type="text" bind:value={extraAnswers[i].value} class="answer-value-input" placeholder="Ex : Le Roi Lion" maxlength="150">
          <button class="track-remove-btn" onclick={() => { extraAnswers = extraAnswers.filter((_, idx) => idx !== i); }}>&#x2715;</button>
        </div>
      {/each}
      <button class="btn-ghost sm" onclick={() => { extraAnswers = [...extraAnswers, { typeId: 3, value: '' }]; }}>+ Ajouter Film / Série…</button>
    </div>

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

<style>
/* ── Toolbar ────────────────────────────────────────────────────────────────── */
.pl-toolbar {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px clamp(16px, 5vw, 80px) 0;
  display: flex;
  justify-content: flex-end;
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
.pl-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px clamp(16px, 5vw, 80px) 80px;
}
.pl-loading {
  color: var(--dim);
  font-size: 0.9rem;
  padding: 40px 0;
}

/* ── Auth wall ───────────────────────────────────────────────────────────────── */
.auth-wall {
  text-align: center;
  padding: 80px 20px;
  background: rgb(var(--c-glass) / 0.03);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 20px;
}
.auth-wall-icon {
  font-size: 3rem;
  margin-bottom: 20px;
}
.auth-wall h2 {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.4rem;
  margin-bottom: 10px;
}
.auth-wall p {
  color: var(--mid);
  font-size: 0.9rem;
}

/* ── Playlists grid ──────────────────────────────────────────────────────────── */
.playlists-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  width: 100%;
}
@media (min-width: 480px) {
  .playlists-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 800px) {
  .playlists-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1100px) {
  .playlists-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.pl-card {
  background: rgb(var(--c-glass) / 0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 22px;
  cursor: pointer;
  transition:
    transform 0.2s,
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 150px;
}
.pl-card::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgb(var(--c-glass) / 0.15), transparent);
}
.pl-card:hover {
  transform: translateY(-3px);
  border-color: rgb(var(--accent-rgb) / 0.2);
  background: rgb(var(--c-glass) / 0.07);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.pl-card-emoji {
  font-size: 2rem;
  margin-bottom: 12px;
  display: block;
}
.pl-card-name {
  font-family: "Bricolage Grotesque", sans-serif;
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 6px;
}
.pl-card-meta {
  font-size: 0.75rem;
  color: var(--dim);
  margin-bottom: 8px;
}
.pl-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 12px;
}
.pl-card-badge {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgb(var(--accent-rgb) / 0.1);
  border: 1px solid rgb(var(--accent-rgb) / 0.15);
  color: var(--accent);
}
.pl-card-badge.private {
  background: rgb(var(--c-glass) / 0.05);
  border-color: var(--border);
  color: var(--dim);
}
.pl-card-edit {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--mid);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}
.pl-card-edit:hover {
  color: var(--text);
  border-color: rgb(var(--c-glass) / 0.2);
}

.pl-card-new {
  border-style: dashed;
  border-color: rgb(var(--c-glass) / 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 160px;
  color: var(--dim);
  font-size: 0.9rem;
  font-weight: 500;
  transition:
    color 0.2s,
    border-color 0.2s;
}
.pl-card-new:hover {
  color: var(--accent);
  border-color: rgb(var(--accent-rgb) / 0.3);
}
.pl-card-new-icon {
  font-size: 2rem;
}

/* ── Modals size overrides ───────────────────────────────────────────────────── */
.modal-lg {
  max-width: 620px;
}
.modal-xl {
  max-width: 960px;
  max-height: 92vh;
  overflow-y: auto;
}

#modal-playlist {
  z-index: 700;
}

/* ── Playlist form ───────────────────────────────────────────────────────────── */
.pl-form-row {
  display: flex;
  gap: 12px;
}
.emoji-input {
  text-align: center;
  font-size: 1.5rem;
  padding: 8px !important;
}
.modal-footer {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: flex-end;
}

/* ── Editor header ───────────────────────────────────────────────────────────── */
.editor-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.editor-pl-emoji {
  font-size: 2.2rem;
  flex-shrink: 0;
}
.editor-header h2 {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.editor-header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.btn-danger {
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--danger);
  padding: 8px 14px;
  border-radius: 50px;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* ── Editor tabs ─────────────────────────────────────────────────────────────── */
.editor-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.etab {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--mid);
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}
.etab:hover {
  color: var(--text);
  border-color: rgb(var(--c-glass) / 0.2);
}
.etab.active {
  color: var(--accent);
  border-color: rgb(var(--accent-rgb) / 0.3);
  background: rgb(var(--accent-rgb) / 0.07);
}

/* ── Search bar ──────────────────────────────────────────────────────────────── */
.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  align-items: center;
  flex-wrap: wrap;
}
.search-bar input {
  flex: 1;
  min-width: 180px;
}
.search-source-toggle {
  display: flex;
  gap: 4px;
}
.src-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--mid);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}
.src-btn.active {
  color: var(--accent);
  border-color: rgb(var(--accent-rgb) / 0.3);
  background: rgb(var(--accent-rgb) / 0.07);
}

/* ── Search results ──────────────────────────────────────────────────────────── */
.search-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
}

.track-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(var(--c-glass) / 0.03);
  border: 1px solid var(--border);
  transition: border-color 0.15s;
}
.track-row:hover {
  border-color: rgb(var(--c-glass) / 0.15);
}
.track-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  background: rgb(var(--c-glass) / 0.05);
  flex-shrink: 0;
}
.track-info {
  flex: 1;
  min-width: 0;
}
.track-title {
  font-size: 0.88rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-artist {
  font-size: 0.75rem;
  color: var(--mid);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-source {
  font-size: 0.65rem;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.track-add-btn {
  background: rgb(var(--accent-rgb) / 0.1);
  border: 1px solid rgb(var(--accent-rgb) / 0.2);
  color: var(--accent);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.track-add-btn:hover {
  background: rgb(var(--accent-rgb) / 0.2);
}
.track-add-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.track-add-btn.added {
  background: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.2);
  color: var(--success);
}

/* ── Import preview ──────────────────────────────────────────────────────────── */
.import-hint {
  font-size: 0.84rem;
  color: var(--mid);
  margin-bottom: 14px;
}
.import-preview {
  margin-top: 14px;
}
.import-preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 14px;
  background: rgb(var(--c-glass) / 0.04);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.import-preview-cover {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--surface);
}
.import-preview-name {
  font-family: "Bricolage Grotesque", sans-serif;
  font-weight: 700;
}
.import-preview-count {
  font-size: 0.78rem;
  color: var(--mid);
  margin-top: 2px;
}
.import-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.import-notice {
  background: rgba(251, 191, 36, 0.06);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 10px;
  padding: 16px;
}
.import-notice p {
  font-size: 0.84rem;
  color: var(--mid);
}
.import-notice code {
  background: rgb(var(--c-glass) / 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.82rem;
  color: var(--text);
}

/* ── Tracks list (in editor) ─────────────────────────────────────────────────── */
.tracks-section {
  margin-top: 28px;
  border-top: 1px solid var(--border);
  padding-top: 20px;
}
.tracks-section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.tracks-section-head h3 {
  font-family: "Bricolage Grotesque", sans-serif;
  font-size: 1rem;
  font-weight: 700;
}
.tracks-empty-hint {
  font-size: 0.8rem;
  color: var(--dim);
}

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.track-row-pl {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgb(var(--c-glass) / 0.02);
  border: 1px solid var(--border);
}
.track-row-pl .track-num {
  font-size: 0.75rem;
  color: var(--dim);
  width: 22px;
  flex-shrink: 0;
  text-align: right;
}
.track-row-pl .track-cover {
  width: 34px;
  height: 34px;
}
.track-row-pl .track-info {
  flex: 1;
  min-width: 0;
}
.track-row-pl .track-title {
  font-size: 0.84rem;
}
.track-row-pl .track-artist {
  font-size: 0.72rem;
}
.track-remove-btn {
  background: transparent;
  border: none;
  color: var(--dim);
  width: 26px;
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s,
    background 0.15s;
  flex-shrink: 0;
}
.track-remove-btn:hover {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}
.track-answers-btn {
  background: transparent;
  border: none;
  color: var(--dim);
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s,
    background 0.15s;
  flex-shrink: 0;
}
.track-answers-btn:hover {
  color: var(--accent);
  background: rgb(var(--c-accent) / 0.12);
}
.answers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0;
}
.answer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0;
}
.answer-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--mid);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.answer-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.answer-type-select {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.answer-value-input {
  flex: 1;
  background: rgb(var(--c-glass) / 0.04);
  border: 1px solid var(--border2);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
}
.answer-value-input:focus {
  border-color: rgb(var(--accent-rgb) / 0.4);
  box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.08);
}

/* ── Modal actions ── */
.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* ── Manual form ─────────────────────────────────────────────────────────────── */
.manual-form {
  max-width: 520px;
}

/* ── Toast ───────────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 12px 22px;
  border-radius: 50px;
  font-size: 0.88rem;
  font-weight: 500;
  z-index: 999;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: toastIn 0.2s ease;
}
.toast.success {
  border-color: rgba(74, 222, 128, 0.3);
  color: var(--success);
}
.toast.error {
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--danger);
}
@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* ── Room launch modal ───────────────────────────────────────────────────────── */
.room-eph-header {
  text-align: center;
  margin-bottom: 4px;
}
.room-eph-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.35);
  color: var(--gold);
  padding: 3px 10px;
  border-radius: 20px;
  margin-bottom: 8px;
}
.room-eph-notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: rgb(var(--accent-rgb) / 0.05);
  border: 1px solid rgb(var(--accent-rgb) / 0.15);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 0.78rem;
  color: var(--mid);
  line-height: 1.5;
  margin-bottom: 16px;
}
.room-eph-icon {
  flex-shrink: 0;
  font-size: 1rem;
  margin-top: 1px;
}
.room-eph-link {
  color: var(--accent);
  text-decoration: underline;
}

.room-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0 0 16px;
}
.room-setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.room-setting-row label {
  font-size: 0.82rem;
  color: var(--mid);
  flex: 1;
  min-width: 0;
}
.room-setting-row input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  cursor: pointer;
  border-radius: 99px;
  background: rgb(var(--c-glass) / 0.12);
  outline: none;
  border: none;
}
.room-setting-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.5);
}
.room-setting-row input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  cursor: pointer;
}
.room-setting-val {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent);
  min-width: 36px;
  text-align: right;
}
.room-code-box {
  text-align: center;
  padding: 24px 0 8px;
}
.room-code-label {
  font-size: 0.75rem;
  color: var(--dim);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.room-code {
  font-family: "Bricolage Grotesque", monospace;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: 6px;
  color: var(--accent);
  background: rgb(var(--accent-rgb) / 0.07);
  border: 1px solid rgb(var(--accent-rgb) / 0.2);
  border-radius: 14px;
  padding: 14px 24px;
  display: inline-block;
  margin-bottom: 14px;
}
.room-share-url {
  font-size: 0.78rem;
  color: var(--dim);
  word-break: break-all;
  background: rgb(var(--c-glass) / 0.04);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
}
.room-code-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ── Spotify PKCE connect ────────────────────────────────────────────────────── */
.btn-spotify {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #1db954;
  color: #000;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 10px 20px;
  border-radius: 50px;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-spotify:hover {
  opacity: 0.85;
}
.spotify-connected-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(29, 185, 84, 0.1);
  border: 1px solid rgba(29, 185, 84, 0.3);
  border-radius: 10px;
  padding: 8px 14px;
  margin-bottom: 10px;
  font-size: 0.83rem;
}
.spotify-connected-label {
  color: #1db954;
  font-weight: 600;
  flex: 1;
}
.btn-link-sm {
  background: none;
  border: none;
  color: var(--dim);
  font-size: 0.78rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.btn-link-sm:hover {
  color: var(--fg);
}

/* ── Admin section ───────────────────────────────────────────────────────────── */
.admin-section {
  background: rgba(251, 191, 36, 0.06);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.admin-section-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 10px;
}
.admin-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.admin-label {
  font-size: 0.83rem;
  color: var(--mid);
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.admin-select {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--fg);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.83rem;
  flex: 1;
}

/* ── Responsive ──────────────────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .pl-form-row {
    flex-direction: column;
  }
  .editor-header {
    flex-wrap: wrap;
  }
  .editor-header-actions {
    width: 100%;
  }
  .editor-tabs {
    gap: 4px;
  }
  .etab {
    font-size: 0.72rem;
    padding: 6px 10px;
  }
  .modal-xl {
    padding: 24px 18px;
  }
}
</style>

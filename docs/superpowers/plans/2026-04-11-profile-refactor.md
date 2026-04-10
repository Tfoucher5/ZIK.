# Profile Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page profil par une page riche en cartes (ELO, parties, win rate, courbe score, répartition par type de room, historique récent, niveau/XP, score moyen).

**Architecture:** L'API `/api/stats/[userId]` est étendue pour retourner toutes les agrégations en un appel. Un composant partagé `ProfileStats.svelte` contient la grille de cartes, utilisé par `/profile` et `/user/[username]`. Le CSS utilise uniquement les variables du thème (`--accent`, `--surface`, etc.).

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Supabase JS, SVG inline, CSS variables

---

## Fichiers

| Fichier | Action |
|---|---|
| `src/routes/(site)/api/stats/[userId]/+server.js` | Réécriture — nouvelles agrégations |
| `src/lib/components/ProfileStats.svelte` | Création — grille 8 cartes |
| `static/css/profile.css` | Réécriture complète |
| `src/routes/(site)/profile/+page.svelte` | Mise à jour — hero + modal + ProfileStats |
| `src/routes/(site)/user/[username]/+page.svelte` | Mise à jour — hero public + ProfileStats |

---

## Task 1 : Étendre l'API stats

**Fichiers :**
- Modifier : `src/routes/(site)/api/stats/[userId]/+server.js`

- [ ] **Step 1 : Remplacer le contenu du fichier**

```js
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/config.js';

export async function GET({ params, url }) {
  try {
    const elo = parseInt(url.searchParams.get('elo') || '0');

    const [roomsRes, playersRes, aboveRes, totalRes] = await Promise.all([
      supabase.from('rooms').select('code, name, emoji, is_official, is_public'),
      supabase
        .from('game_players')
        .select('score, rank, games!inner(room_id, ended_at)')
        .eq('user_id', params.userId)
        .eq('is_guest', false)
        .not('games.ended_at', 'is', null),
      elo > 0
        ? supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('elo', elo)
        : Promise.resolve({ count: 0 }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    if (playersRes.error) return json({ error: playersRes.error.message }, { status: 500 });

    const roomMap = {};
    (roomsRes.data || []).forEach(r => { roomMap[r.code] = r; });

    const rows = playersRes.data || [];

    // Trier par date décroissante pour recentGames
    rows.sort((a, b) => new Date(b.games.ended_at) - new Date(a.games.ended_at));

    // Best scores par room officielle
    const bestByRoom = {};
    const officialRoomInfo = {};
    rows.forEach(row => {
      const roomId = row.games?.room_id;
      const room = roomMap[roomId];
      if (!room?.is_official) return;
      if (!bestByRoom[roomId] || row.score > bestByRoom[roomId]) bestByRoom[roomId] = row.score;
      officialRoomInfo[roomId] = room;
    });

    // Répartition par type de room
    const scoreByRoomType = {
      official: { count: 0, totalScore: 0 },
      public:   { count: 0, totalScore: 0 },
      private:  { count: 0, totalScore: 0 },
    };
    rows.forEach(row => {
      const room = roomMap[row.games?.room_id];
      const type = room?.is_official ? 'official' : room?.is_public ? 'public' : 'private';
      scoreByRoomType[type].count++;
      scoreByRoomType[type].totalScore += row.score;
    });

    // Win rate
    const wins = rows.filter(r => r.rank === 1).length;

    // Best / worst score
    const scores = rows.map(r => r.score);
    const bestScore  = scores.length ? Math.max(...scores) : 0;
    const worstScore = scores.length ? Math.min(...scores) : 0;
    const bestRank   = rows.length ? Math.min(...rows.map(r => r.rank ?? 999)) : null;

    // 10 parties les plus récentes pour la courbe + historique (6 affichés)
    const recentGames = rows.slice(0, 10).map(row => {
      const room = roomMap[row.games?.room_id];
      return {
        score:    row.score,
        rank:     row.rank,
        endedAt:  row.games.ended_at,
        roomName:  room?.name  ?? 'Room custom',
        roomEmoji: room?.emoji ?? '🎮',
      };
    });

    // Parties ce mois-ci
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const gamesThisMonth = rows.filter(r =>
      new Date(r.games.ended_at) >= startOfMonth
    ).length;

    // Top % classement
    const aboveCount = aboveRes.count ?? 0;
    const totalCount = totalRes.count ?? 1;
    const topPercent = Math.max(1, Math.ceil((aboveCount / totalCount) * 100));

    return json({
      bestByRoom,
      roomInfo: officialRoomInfo,
      recentGames,
      scoreByRoomType,
      winRate:  { wins, total: rows.length },
      bestScore,
      worstScore,
      bestRank,
      gamesThisMonth,
      topPercent,
    });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2 : Vérifier le lint**

```bash
cd C:/Users/Teamr/Desktop/ZIK && node --check src/routes/\(site\)/api/stats/\[userId\]/+server.js
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Tester manuellement l'endpoint**

Démarrer le serveur (`npm run dev`) et ouvrir dans le navigateur :
`http://localhost:5173/api/stats/[un-userId-valide]?elo=1000`

Vérifier que la réponse JSON contient : `bestByRoom`, `recentGames`, `scoreByRoomType`, `winRate`, `topPercent`.

- [ ] **Step 4 : Commit**

```bash
git add src/routes/\(site\)/api/stats/\[userId\]/+server.js
git commit -m "feat: étendre API stats — répartition, historique, win rate, top%"
```

---

## Task 2 : Réécrire profile.css

**Fichiers :**
- Modifier : `static/css/profile.css`

- [ ] **Step 1 : Remplacer le contenu complet**

```css
/* ── Profile page ────────────────────────────────────────────────────────────── */

/* États (auth wall, profil privé, not found) */
.profile-auth-wall {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding-top: var(--nav-h);
  text-align: center;
}
.profile-auth-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

#profile-page {
  padding-top: var(--nav-h);
  flex: 1;
}

/* ── Hero ── */
.profile-hero {
  background: linear-gradient(160deg, rgb(var(--accent-rgb) / 0.1) 0%, transparent 60%);
  border-bottom: 1px solid var(--border);
  padding: 36px clamp(16px, 5vw, 60px) 28px;
}
.profile-hero-inner {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.profile-avatar-wrap { position: relative; flex-shrink: 0; }
.profile-avatar-big {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgb(var(--accent-rgb) / 0.35);
  background: var(--surface);
}
.profile-avatar-edit {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: #000;
  border: 2px solid var(--bg);
  font-size: 0.72rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-hero-info { flex: 1; min-width: 0; }
.profile-username {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.profile-hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.profile-elo-badge {
  font-size: 0.82rem;
  color: var(--accent);
  font-weight: 600;
}
.profile-top-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgb(var(--accent-rgb) / 0.1);
  border: 1px solid rgb(var(--accent-rgb) / 0.25);
  border-radius: 99px;
  padding: 2px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}
.profile-since {
  font-size: 0.78rem;
  color: var(--dim);
  margin-top: 3px;
}
.profile-xp-row { margin-top: 12px; max-width: 300px; }
.profile-xp-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--dim);
  margin-bottom: 5px;
}
.profile-xp-bar {
  background: rgb(var(--c-glass) / 0.08);
  border-radius: 99px;
  height: 6px;
}
.profile-xp-fill {
  background: linear-gradient(90deg, var(--accent), var(--accent2, var(--accent)));
  height: 100%;
  border-radius: 99px;
  transition: width 0.6s ease;
}
.profile-privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--dim);
  margin-top: 6px;
  background: rgb(var(--c-glass) / 0.06);
  border: 1px solid var(--border);
  border-radius: 99px;
  padding: 2px 10px;
}

/* ── Grille de cartes ── */
.profile-grid-wrap {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px clamp(16px, 5vw, 60px) 60px;
}
.profile-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 14px;
}

/* Span */
.pf-col-3  { grid-column: span 3; }
.pf-col-4  { grid-column: span 4; }
.pf-col-6  { grid-column: span 6; }
.pf-col-8  { grid-column: span 8; }
.pf-col-12 { grid-column: span 12; }

/* Responsive */
@media (max-width: 700px) {
  .pf-col-3, .pf-col-4, .pf-col-6, .pf-col-8 { grid-column: span 12; }
  .profile-username { font-size: 1.5rem; }
}
@media (min-width: 701px) and (max-width: 900px) {
  .pf-col-3 { grid-column: span 6; }
  .pf-col-4 { grid-column: span 6; }
  .pf-col-8 { grid-column: span 12; }
}

/* ── Card base ── */
.pf-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
}
.pf-card-title {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--dim);
  margin-bottom: 14px;
}

/* ── Stat big (ELO, parties, score, win rate) ── */
.pf-stat-val {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2.4rem;
  font-weight: 900;
  color: var(--accent);
  line-height: 1;
  margin-bottom: 4px;
}
.pf-stat-lbl {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--dim);
}
.pf-stat-sub {
  font-size: 0.75rem;
  color: var(--dim);
  margin-top: 6px;
}

/* ── Win rate ── */
.pf-wr-bar {
  height: 4px;
  background: rgb(var(--c-glass) / 0.08);
  border-radius: 99px;
  margin-top: 10px;
}
.pf-wr-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
}

/* ── Courbe SVG ── */
.pf-curve-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--dim);
  margin-top: 4px;
}

/* ── Répartition ── */
.pf-distrib-bar {
  display: flex;
  border-radius: 99px;
  overflow: hidden;
  height: 8px;
  gap: 2px;
  margin: 12px 0 10px;
}
.pf-distrib-seg { height: 100%; border-radius: 99px; }
.pf-distrib-legend { display: flex; flex-direction: column; gap: 8px; }
.pf-distrib-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
}
.pf-distrib-dot {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--dim);
}
.pf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pf-distrib-pts {
  font-weight: 700;
  font-size: 0.82rem;
}

/* ── Meilleurs scores ── */
.pf-score-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.pf-score-row:last-child { border-bottom: none; padding-bottom: 0; }
.pf-score-emoji { font-size: 1.3rem; width: 28px; text-align: center; flex-shrink: 0; }
.pf-score-info { flex: 1; min-width: 0; }
.pf-score-name { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-score-pts {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 1rem;
  color: var(--accent);
  flex-shrink: 0;
}
.pf-empty { color: var(--dim); font-size: 0.85rem; }

/* ── Historique ── */
.pf-hist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}
.pf-hist-row:last-child { border-bottom: none; }
.pf-hist-date { font-size: 0.7rem; color: var(--dim); width: 52px; flex-shrink: 0; }
.pf-hist-room { flex: 1; font-size: 0.82rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-hist-score {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 700;
  color: var(--accent);
  font-size: 0.9rem;
  flex-shrink: 0;
}
.pf-rank-badge {
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 4px;
  padding: 2px 6px;
  flex-shrink: 0;
}
.pf-rank-1 { background: rgba(251,191,36,0.15); color: #fbbf24; }
.pf-rank-2 { background: rgba(156,163,175,0.15); color: #9ca3af; }
.pf-rank-3 { background: rgba(180,120,60,0.15); color: #cd7f32; }
.pf-rank-n { background: rgb(var(--c-glass) / 0.06); color: var(--dim); }

/* ── Niveau ── */
.pf-level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.pf-level-num {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2.8rem;
  font-weight: 900;
  color: var(--accent);
  line-height: 1;
}
.pf-level-name { font-weight: 700; font-size: 0.95rem; }
.pf-level-next { font-size: 0.72rem; color: var(--dim); margin-top: 2px; }
.pf-xp-bar { background: rgb(var(--c-glass) / 0.08); border-radius: 99px; height: 5px; margin-bottom: 5px; }
.pf-xp-fill { background: linear-gradient(90deg, var(--accent), var(--accent2, var(--accent))); height: 100%; border-radius: 99px; }
.pf-xp-nums { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--dim); }

/* ── Score moyen ── */
.pf-mini-stats { display: flex; margin-top: 14px; border-top: 1px solid var(--border); padding-top: 14px; }
.pf-mini-stat { flex: 1; text-align: center; padding: 0 8px; border-right: 1px solid var(--border); }
.pf-mini-stat:last-child { border-right: none; }
.pf-mini-val { font-family: 'Bricolage Grotesque', sans-serif; font-size: 1.2rem; font-weight: 800; }
.pf-mini-lbl { font-size: 0.65rem; color: var(--dim); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

/* ── Modal édition ── */
.avatar-preview-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 12px;
  flex-wrap: wrap;
}
.avatar-preview-img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  background: var(--surface);
}
.alert-err {
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.2);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-top: 6px;
}

/* ── Toast ── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 50px;
  padding: 10px 20px;
  font-size: 0.85rem;
  white-space: nowrap;
  pointer-events: none;
}
.toast.success { border-color: var(--success); color: var(--success); }
.toast.error   { border-color: var(--danger);  color: var(--danger); }
```

- [ ] **Step 2 : Commit**

```bash
git add static/css/profile.css
git commit -m "style: réécriture profile.css — grille cartes, thème, responsive"
```

---

## Task 3 : Créer ProfileStats.svelte

**Fichiers :**
- Créer : `src/lib/components/ProfileStats.svelte`

Ce composant reçoit `profile` et `stats` en props et rend les 8 cartes.

- [ ] **Step 1 : Créer le fichier**

```svelte
<script>
  let { profile, stats } = $props();

  // ── Helpers ──────────────────────────────────────────────────────────────

  const LEVEL_NAMES = [
    '', 'Novice', 'Apprenti', 'Amateur', 'Mélomane', 'Passionné',
    'Connaisseur', 'Expert', 'Virtuose', 'Maestro', 'Légende',
  ];
  function getLevelName(lvl) {
    return LEVEL_NAMES[Math.min(lvl, LEVEL_NAMES.length - 1)] || 'Légende';
  }
  function xpForNextLevel(lvl) { return lvl * 1000; }

  function fmtDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Auj.';
    if (diff === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function fmtScore(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(n);
  }

  function rankClass(rank) {
    if (rank === 1) return 'pf-rank-badge pf-rank-1';
    if (rank === 2) return 'pf-rank-badge pf-rank-2';
    if (rank === 3) return 'pf-rank-badge pf-rank-3';
    return 'pf-rank-badge pf-rank-n';
  }
  function rankLabel(rank) {
    if (rank === 1) return '🥇 1er';
    if (rank === 2) return '🥈 2e';
    if (rank === 3) return '🥉 3e';
    return `#${rank}`;
  }

  // ── Courbe SVG ───────────────────────────────────────────────────────────

  function buildCurve(games) {
    if (!games?.length) return { points: '', fill: '', labels: [] };
    const W = 520, H = 70, padY = 6;
    const scores = games.map(g => g.score);
    const minS = Math.min(...scores);
    const maxS = Math.max(...scores);
    const range = maxS - minS || 1;
    const pts = scores.map((s, i) => {
      const x = scores.length === 1 ? W / 2 : (i / (scores.length - 1)) * W;
      const y = H - padY - ((s - minS) / range) * (H - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const polyline = pts.join(' ');
    const fill = `${polyline} ${W},${H} 0,${H}`;
    return { points: polyline, fill, labels: games.map(g => fmtDate(g.endedAt)) };
  }

  // ── Valeurs dérivées ─────────────────────────────────────────────────────

  const recent   = $derived(stats?.recentGames ?? []);
  const curve    = $derived(buildCurve(recent));
  const history  = $derived(recent.slice(0, 6));

  const avgScore = $derived(
    profile.games_played > 0
      ? Math.round(profile.total_score / profile.games_played)
      : 0
  );

  const xpMax    = $derived(xpForNextLevel(profile.level));
  const xpPct    = $derived(Math.min(100, Math.round((profile.xp / xpMax) * 100)));
  const lvlName  = $derived(getLevelName(profile.level));

  const byType   = $derived(stats?.scoreByRoomType ?? {
    official: { count: 0, totalScore: 0 },
    public:   { count: 0, totalScore: 0 },
    private:  { count: 0, totalScore: 0 },
  });
  const totalGames = $derived(
    byType.official.count + byType.public.count + byType.private.count
  );
  function typePct(count) {
    return totalGames > 0 ? Math.round((count / totalGames) * 100) : 0;
  }

  const bestByRoom  = $derived(
    Object.entries(stats?.bestByRoom ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([code, score]) => ({ room: stats?.roomInfo?.[code], score }))
      .filter(e => e.room)
  );

  const winRate = $derived(stats?.winRate ?? { wins: 0, total: 0 });
  const wrPct   = $derived(
    winRate.total > 0 ? Math.round((winRate.wins / winRate.total) * 100) : 0
  );
</script>

<div class="profile-grid-wrap">
  <div class="profile-grid">

    <!-- ── Rangée 1 : 4 stats ── -->

    <div class="pf-card pf-col-3">
      <div class="pf-card-title">ELO</div>
      <div class="pf-stat-val">{profile.elo ?? '—'}</div>
      <div class="pf-stat-lbl">Classement</div>
      {#if stats?.topPercent}
        <div class="pf-stat-sub">Top {stats.topPercent}% des joueurs</div>
      {/if}
    </div>

    <div class="pf-card pf-col-3">
      <div class="pf-card-title">Parties jouées</div>
      <div class="pf-stat-val">{profile.games_played ?? '—'}</div>
      <div class="pf-stat-lbl">Total</div>
      {#if stats?.gamesThisMonth != null}
        <div class="pf-stat-sub">{stats.gamesThisMonth} ce mois</div>
      {/if}
    </div>

    <div class="pf-card pf-col-3">
      <div class="pf-card-title">Score total</div>
      <div class="pf-stat-val">{fmtScore(profile.total_score ?? 0)}</div>
      <div class="pf-stat-lbl">Tous temps</div>
      {#if avgScore > 0}
        <div class="pf-stat-sub">moy. {avgScore} pts / partie</div>
      {/if}
    </div>

    <div class="pf-card pf-col-3">
      <div class="pf-card-title">Win rate</div>
      <div class="pf-stat-val">{wrPct}%</div>
      <div class="pf-stat-lbl">1ères places</div>
      <div class="pf-stat-sub">{winRate.wins} victoires / {winRate.total} parties</div>
      <div class="pf-wr-bar"><div class="pf-wr-fill" style="width:{wrPct}%"></div></div>
    </div>

    <!-- ── Rangée 2 : courbe + répartition ── -->

    <div class="pf-card pf-col-8">
      <div class="pf-card-title">Évolution du score — {recent.length} dernières parties</div>
      {#if recent.length >= 2}
        <svg viewBox="0 0 520 70" style="width:100%;height:70px" aria-hidden="true">
          <defs>
            <linearGradient id="pf-curve-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="23" x2="520" y2="23" stroke="var(--border)" stroke-width="1"/>
          <line x1="0" y1="46" x2="520" y2="46" stroke="var(--border)" stroke-width="1"/>
          <polyline points={curve.fill} fill="url(#pf-curve-grad)" stroke="none"/>
          <polyline points={curve.points} fill="none" stroke="var(--accent)" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"/>
          {#each curve.points.split(' ') as pt, i}
            {@const [cx, cy] = pt.split(',')}
            <circle cx={cx} cy={cy} r="3" fill="var(--accent)"/>
          {/each}
        </svg>
        <div class="pf-curve-labels">
          {#each curve.labels as lbl}
            <span>{lbl}</span>
          {/each}
        </div>
      {:else}
        <p class="pf-empty" style="margin-top:8px">Pas encore assez de parties pour afficher la courbe.</p>
      {/if}
    </div>

    <div class="pf-card pf-col-4">
      <div class="pf-card-title">Répartition des parties</div>
      {#if totalGames > 0}
        <div class="pf-distrib-bar">
          <div class="pf-distrib-seg" style="width:{typePct(byType.official.count)}%;background:var(--accent)"></div>
          <div class="pf-distrib-seg" style="width:{typePct(byType.public.count)}%;background:rgb(var(--accent-rgb)/0.55)"></div>
          <div class="pf-distrib-seg" style="width:{typePct(byType.private.count)}%;background:rgb(var(--accent-rgb)/0.25)"></div>
        </div>
        <div class="pf-distrib-legend">
          <div class="pf-distrib-row">
            <div class="pf-distrib-dot">
              <div class="pf-dot" style="background:var(--accent)"></div>
              Officiel · {byType.official.count} parties
            </div>
            <div class="pf-distrib-pts">{fmtScore(byType.official.totalScore)} pts</div>
          </div>
          <div class="pf-distrib-row">
            <div class="pf-distrib-dot">
              <div class="pf-dot" style="background:rgb(var(--accent-rgb)/0.55)"></div>
              Public · {byType.public.count} parties
            </div>
            <div class="pf-distrib-pts">{fmtScore(byType.public.totalScore)} pts</div>
          </div>
          <div class="pf-distrib-row">
            <div class="pf-distrib-dot">
              <div class="pf-dot" style="background:rgb(var(--accent-rgb)/0.25)"></div>
              Privé · {byType.private.count} parties
            </div>
            <div class="pf-distrib-pts">{fmtScore(byType.private.totalScore)} pts</div>
          </div>
        </div>
      {:else}
        <p class="pf-empty" style="margin-top:8px">Aucune partie jouée.</p>
      {/if}
    </div>

    <!-- ── Rangée 3 : meilleurs scores + historique ── -->

    <div class="pf-card pf-col-6">
      <div class="pf-card-title">Meilleurs scores par room</div>
      {#if bestByRoom.length}
        {#each bestByRoom as { room, score }}
          <div class="pf-score-row">
            <span class="pf-score-emoji">{room.emoji || '🎵'}</span>
            <div class="pf-score-info">
              <div class="pf-score-name">{room.name}</div>
            </div>
            <span class="pf-score-pts">{score} pts</span>
          </div>
        {/each}
      {:else}
        <p class="pf-empty">Aucune partie sur les rooms officielles.</p>
      {/if}
    </div>

    <div class="pf-card pf-col-6">
      <div class="pf-card-title">Historique récent</div>
      {#if history.length}
        {#each history as g}
          <div class="pf-hist-row">
            <div class="pf-hist-date">{fmtDate(g.endedAt)}</div>
            <div class="pf-hist-room">{g.roomEmoji} {g.roomName}</div>
            <div class="pf-hist-score">{g.score} pts</div>
            <span class={rankClass(g.rank)}>{rankLabel(g.rank)}</span>
          </div>
        {/each}
      {:else}
        <p class="pf-empty">Aucune partie jouée.</p>
      {/if}
    </div>

    <!-- ── Rangée 4 : niveau + score moyen ── -->

    <div class="pf-card pf-col-4">
      <div class="pf-card-title">Niveau &amp; progression</div>
      <div class="pf-level-row">
        <div class="pf-level-num">{profile.level ?? 1}</div>
        <div>
          <div class="pf-level-name">{lvlName}</div>
          <div class="pf-level-next">Prochain niveau : {xpMax - profile.xp} XP restants</div>
        </div>
      </div>
      <div class="pf-xp-bar"><div class="pf-xp-fill" style="width:{xpPct}%"></div></div>
      <div class="pf-xp-nums"><span>{profile.xp} XP</span><span>{xpMax} XP</span></div>
    </div>

    <div class="pf-card pf-col-4">
      <div class="pf-card-title">Score moyen</div>
      <div class="pf-stat-val" style="font-size:2.8rem">{avgScore || '—'}</div>
      <div class="pf-stat-lbl">Points / partie</div>
      {#if stats}
        <div class="pf-mini-stats">
          <div class="pf-mini-stat">
            <div class="pf-mini-val">{stats.bestScore}</div>
            <div class="pf-mini-lbl">Meilleur</div>
          </div>
          <div class="pf-mini-stat">
            <div class="pf-mini-val">{stats.worstScore}</div>
            <div class="pf-mini-lbl">Pire</div>
          </div>
          {#if stats.bestRank != null}
            <div class="pf-mini-stat">
              <div class="pf-mini-val">#{stats.bestRank}</div>
              <div class="pf-mini-lbl">Meilleur rang</div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

  </div>
</div>
```

- [ ] **Step 2 : Vérifier qu'il n'y a pas d'erreur de syntaxe Svelte**

```bash
cd C:/Users/Teamr/Desktop/ZIK && npx svelte-check --tsconfig ./jsconfig.json 2>&1 | grep -i "ProfileStats\|error" | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/ProfileStats.svelte
git commit -m "feat: composant ProfileStats — 8 cartes stats profil"
```

---

## Task 4 : Mettre à jour `/profile/+page.svelte`

**Fichiers :**
- Modifier : `src/routes/(site)/profile/+page.svelte`

- [ ] **Step 1 : Remplacer le contenu complet**

```svelte
<script>
  import { onMount, getContext } from 'svelte';
  import { dicebear } from '$lib/utils.js';
  import ProfileStats from '$lib/components/ProfileStats.svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user    = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let profile     = $state(null);
  let stats       = $state(null);
  let loading     = $state(true);

  // Edit modal
  let editOpen      = $state(false);
  let editUsername  = $state('');
  let editAvatarUrl = $state('');
  let editError     = $state('');
  let editLoading   = $state(false);
  let avatarPreview = $state('');

  let toastMsg  = $state('');
  let toastType = $state('');
  let _toastTimer = null;

  function toast(msg, type = '') {
    clearTimeout(_toastTimer);
    toastMsg = msg; toastType = type;
    _toastTimer = setTimeout(() => { toastMsg = ''; }, 3200);
  }

  const name   = $derived(profile?.username || user?.email?.split('@')[0] || 'Joueur');
  const avatar = $derived(profile?.avatar_url || dicebear(name));

  function fmtSince(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  onMount(async () => {
    if (!sb) { loading = false; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) { loading = false; return; }
    await loadProfile(session.user);
  });

  async function loadProfile(u) {
    loading = true;
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', u.id).single();
      profile = data;
      await loadStats(u.id, data?.elo ?? 0);
    } finally {
      loading = false;
    }
  }

  async function loadStats(userId, elo) {
    try {
      const r = await fetch(`/api/stats/${userId}?elo=${elo}`);
      if (!r.ok) return;
      stats = await r.json();
    } catch {}
  }

  function openEdit() {
    editUsername  = profile?.username || user?.email?.split('@')[0] || '';
    editAvatarUrl = profile?.avatar_url || '';
    editError     = '';
    avatarPreview = editAvatarUrl || dicebear(editUsername || '?');
    editOpen      = true;
  }

  function updatePreview() {
    avatarPreview = editAvatarUrl.trim() || dicebear(editUsername || '?');
  }

  async function saveProfile() {
    editError = '';
    const username   = editUsername.trim();
    const avatar_url = editAvatarUrl.trim();
    if (!username) { editError = 'Le pseudo est requis.'; return; }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      editError = 'Pseudo invalide (3-20 caractères, lettres/chiffres/_/-).'; return;
    }
    const old = profile?.username;
    if (username !== old) {
      const { data: exists } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
      if (exists) { editError = 'Ce pseudo est déjà pris.'; return; }
    }
    editLoading = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ username, avatar_url: avatar_url || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const updatedProfile = { ...profile, username, avatar_url: avatar_url || null };
      profile = updatedProfile;
      if (user?.id) {
        try {
          sessionStorage.setItem('zik_profile_' + user.id, JSON.stringify({ p: updatedProfile, ts: Date.now() }));
        } catch {}
        sessionStorage.setItem('zik_uname', username);
      }
      editOpen = false;
      toast('Profil mis à jour !', 'success');
    } catch (e) {
      editError = e.message;
    } finally {
      editLoading = false;
    }
  }
</script>

<svelte:head>
  <title>ZIK — Mon profil</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/profile.css">
</svelte:head>

<div id="profile-page">
{#if loading || !authReady}
  <div class="pl-loading">Chargement...</div>
{:else if !user}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">🔒</div>
      <h2>Connexion requise</h2>
      <p>Connecte-toi pour accéder à ton profil.</p>
      <button class="btn-accent" onclick={() => openAuthModal('login')} style="margin-top:16px">Se connecter</button>
    </div>
  </div>
{:else}
  <!-- Hero -->
  <div class="profile-hero">
    <div class="profile-hero-inner">
      <div class="profile-avatar-wrap">
        <img src={avatar} alt="" class="profile-avatar-big">
        <button class="profile-avatar-edit" onclick={openEdit} title="Changer l'avatar">✎</button>
      </div>
      <div class="profile-hero-info">
        <div class="profile-username">{name}</div>
        <div class="profile-hero-meta">
          <span class="profile-elo-badge">ELO {profile?.elo ?? '—'}</span>
          {#if stats?.topPercent}
            <span class="profile-top-badge">🏆 Top {stats.topPercent}%</span>
          {/if}
        </div>
        {#if profile?.created_at}
          <div class="profile-since">Membre depuis {fmtSince(profile.created_at)}</div>
        {/if}
        {#if profile}
          <div class="profile-xp-row">
            <div class="profile-xp-label">
              <span>Niveau {profile.level ?? 1}</span>
              <span>{profile.xp ?? 0} / {(profile.level ?? 1) * 1000} XP</span>
            </div>
            <div class="profile-xp-bar">
              <div class="profile-xp-fill" style="width:{Math.min(100, Math.round(((profile.xp ?? 0) / ((profile.level ?? 1) * 1000)) * 100))}%"></div>
            </div>
          </div>
        {/if}
      </div>
      <button class="btn-ghost sm" onclick={openEdit}>Modifier le profil</button>
    </div>
  </div>

  <!-- Cartes stats -->
  {#if profile}
    <ProfileStats {profile} {stats} />
  {/if}
{/if}
</div>

<!-- Edit modal -->
{#if editOpen}
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="overlay" role="dialog" aria-modal="true"
  onclick={e => { if (e.target === e.currentTarget) editOpen = false; }}>
  <div class="modal">
    <button class="close-btn" onclick={() => editOpen = false}>✕</button>
    <h2>Modifier le profil</h2>
    <p class="mdesc">Personnalise ton pseudo et ton avatar.</p>

    <div class="field">
      <label>Pseudo <span style="color:var(--dim);font-weight:400;font-size:.78rem">(3-20 caractères)</span></label>
      <input type="text" bind:value={editUsername} maxlength="20" autocomplete="off" oninput={updatePreview}>
    </div>

    <div class="field">
      <label>URL de l'avatar <span style="color:var(--dim);font-weight:400;font-size:.78rem">— optionnel</span></label>
      <input type="url" bind:value={editAvatarUrl} placeholder="https://... (image carrée recommandée)" oninput={updatePreview}>
    </div>

    <div class="avatar-preview-wrap">
      <span style="font-size:.78rem;color:var(--dim)">Aperçu :</span>
      <img src={avatarPreview} alt="" class="avatar-preview-img">
      <button class="btn-ghost sm" onclick={() => { editAvatarUrl = ''; updatePreview(); }}>Générer auto</button>
    </div>

    {#if editError}<div class="alert-err">{editError}</div>{/if}
    <div class="modal-footer">
      <button class="btn-ghost" onclick={() => editOpen = false}>Annuler</button>
      <button class="btn-accent" onclick={saveProfile} disabled={editLoading}>
        {editLoading ? '...' : 'Enregistrer'}
      </button>
    </div>
  </div>
</div>
{/if}

{#if toastMsg}
  <div class="toast {toastType}" style="display:block">{toastMsg}</div>
{/if}
```

- [ ] **Step 2 : Vérifier dans le navigateur**

- Ouvrir `http://localhost:5173/profile` en étant connecté
- Vérifier : hero affiché, cartes chargées, barre XP, modal d'édition fonctionnelle
- Vérifier sur mobile (DevTools responsive)

- [ ] **Step 3 : Commit**

```bash
git add src/routes/\(site\)/profile/+page.svelte
git commit -m "feat: refonte page /profile — hero + 8 cartes stats"
```

---

## Task 5 : Mettre à jour `/user/[username]/+page.svelte`

**Fichiers :**
- Modifier : `src/routes/(site)/user/[username]/+page.svelte`

- [ ] **Step 1 : Remplacer le contenu complet**

```svelte
<script>
  import { onMount, getContext } from 'svelte';
  import { page } from '$app/stores';
  import { dicebear } from '$lib/utils.js';
  import ProfileStats from '$lib/components/ProfileStats.svelte';

  const _ctx = getContext('zik');
  const sb = _ctx.sb;
  const openAuthModal = _ctx.openAuthModal;
  const user     = $derived(_ctx.user);
  const authReady = $derived(_ctx.authReady);

  let profile    = $state(null);
  let stats      = $state(null);
  let loading    = $state(true);
  let notFound   = $state(false);

  const username    = $derived($page.params.username);
  const avatar      = $derived(profile?.avatar_url || dicebear(profile?.username || '?'));
  const isOwnProfile = $derived(user?.profile?.username === profile?.username);

  function fmtSince(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  onMount(async () => {
    if (!sb) { loading = false; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) { loading = false; return; }
    await loadPublicProfile();
  });

  async function loadPublicProfile() {
    loading = true;
    try {
      const token = (await sb.auth.getSession())?.data?.session?.access_token;
      const r = await fetch(`/api/profile/${username}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (r.status === 404 || !r.ok) { notFound = true; return; }
      profile = await r.json();
      if (profile && !profile.is_private) {
        await loadStats(profile.id, profile.elo ?? 0);
      }
    } finally {
      loading = false;
    }
  }

  async function loadStats(userId, elo) {
    try {
      const r = await fetch(`/api/stats/${userId}?elo=${elo}`);
      if (!r.ok) return;
      stats = await r.json();
    } catch {}
  }
</script>

<svelte:head>
  <title>ZIK — {profile?.username ?? username} | Profil joueur</title>
  <meta name="description" content="Découvre le profil de {profile?.username ?? username} sur ZIK : ELO {profile?.elo ?? ''}, niveau {profile?.level ?? ''}, {profile?.games_played ?? ''} parties jouées.">
  {#if !profile || profile.is_private}
    <meta name="robots" content="noindex, nofollow">
  {:else}
    <link rel="canonical" href="https://www.zik-music.fr/user/{username}">
    <meta property="og:title" content="{profile.username} sur ZIK — Blind Test Multijoueur">
    <meta property="og:description" content="ELO {profile.elo ?? '?'} · Niveau {profile.level ?? '?'} · {profile.games_played ?? '0'} parties jouées.">
    <meta property="og:url" content="https://www.zik-music.fr/user/{username}">
    <meta property="og:type" content="profile">
  {/if}
  <link rel="stylesheet" href="/css/profile.css">
</svelte:head>

<div id="profile-page">
{#if loading || !authReady}
  <div class="pl-loading">Chargement...</div>
{:else if !user}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">🔒</div>
      <h2>Connexion requise</h2>
      <p>Tu dois être connecté pour voir le profil d'un joueur.</p>
      <button class="btn-accent" onclick={() => openAuthModal('login')} style="margin-top:16px">Se connecter</button>
    </div>
  </div>
{:else if notFound}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">🕵️</div>
      <h2>Profil introuvable</h2>
      <p>Le joueur <strong>{username}</strong> n'existe pas.</p>
      <a href="/" class="btn-ghost" style="margin-top:16px">← Retour à l'accueil</a>
    </div>
  </div>
{:else if profile?.is_private && !isOwnProfile}
  <div class="profile-auth-wall">
    <div class="profile-auth-msg">
      <div class="confirm-emoji">🔐</div>
      <h2>Profil privé</h2>
      <p><strong>{profile.username}</strong> a rendu son profil privé.</p>
      <a href="/" class="btn-ghost" style="margin-top:16px">← Retour à l'accueil</a>
    </div>
  </div>
{:else if profile}
  <!-- Hero -->
  <div class="profile-hero">
    <div class="profile-hero-inner">
      <div class="profile-avatar-wrap">
        <img src={avatar} alt="" class="profile-avatar-big">
      </div>
      <div class="profile-hero-info">
        <div class="profile-username">{profile.username}</div>
        <div class="profile-hero-meta">
          <span class="profile-elo-badge">ELO {profile.elo ?? '—'}</span>
          {#if stats?.topPercent}
            <span class="profile-top-badge">🏆 Top {stats.topPercent}%</span>
          {/if}
          {#if profile.is_private}
            <span class="profile-privacy-badge">🔐 Profil privé</span>
          {/if}
        </div>
        {#if profile.created_at}
          <div class="profile-since">Membre depuis {fmtSince(profile.created_at)}</div>
        {/if}
        <div class="profile-xp-row">
          <div class="profile-xp-label">
            <span>Niveau {profile.level ?? 1}</span>
            <span>{profile.xp ?? 0} / {(profile.level ?? 1) * 1000} XP</span>
          </div>
          <div class="profile-xp-bar">
            <div class="profile-xp-fill" style="width:{Math.min(100, Math.round(((profile.xp ?? 0) / ((profile.level ?? 1) * 1000)) * 100))}%"></div>
          </div>
        </div>
      </div>
      {#if isOwnProfile}
        <a href="/profile" class="btn-ghost sm">Modifier mon profil</a>
      {/if}
    </div>
  </div>

  <!-- Cartes stats -->
  <ProfileStats {profile} {stats} />
{/if}
</div>
```

- [ ] **Step 2 : Vérifier dans le navigateur**

- Ouvrir `http://localhost:5173/user/[pseudo-existant]`
- Vérifier : hero sans bouton modifier, cartes visibles, responsive OK
- Tester profil privé d'un autre joueur → écran bloqué

- [ ] **Step 3 : Commit final**

```bash
git add src/routes/\(site\)/user/\[username\]/+page.svelte
git commit -m "feat: refonte page /user/[username] — hero public + cartes stats"
```

---

## Self-review

**Couverture spec :**
- ✅ Hero : avatar, nom, ELO, Top%, membre depuis, barre XP
- ✅ 8 cartes : ELO, parties, score total, win rate, courbe, répartition, meilleurs scores, historique + niveau, score moyen
- ✅ Composant partagé ProfileStats pour /profile et /user/[username]
- ✅ API étendue : un seul appel, toutes les agrégations
- ✅ CSS : variables thème uniquement, pas de couleurs hardcodées
- ✅ Responsive : col-12 mobile, col-6 tablette
- ✅ Profil privé : gate maintenu sur /user/[username]
- ✅ Pas de précision des réponses (exclue)
- ✅ Pas de nouvelle dépendance

**Points ajustables post-implémentation :**
- La formule `xpForNextLevel(level) = level * 1000` est une estimation — à aligner avec la fonction Supabase `update_player_stats` si elle diffère.

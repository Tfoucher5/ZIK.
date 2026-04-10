<script>
  let { profile, stats } = $props();

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

  function buildCurve(games) {
    if (!games?.length) return { points: '', fill: '', labels: [], minS: 0, midS: 0, maxS: 0, yMin: 0, yMid: 0, yMax: 0, ox: 0, tw: 0, H: 0 };
    const CW = 476, H = 72, padY = 8, ox = 48;
    const scores = games.map(g => g.score);
    const minS = Math.min(...scores);
    const maxS = Math.max(...scores);
    const midS = Math.round((minS + maxS) / 2);
    const range = maxS - minS || 1;
    const pts = scores.map((s, i) => {
      const x = ox + (scores.length === 1 ? CW / 2 : (i / (scores.length - 1)) * CW);
      const y = padY + (1 - (s - minS) / range) * (H - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const polyline = pts.join(' ');
    const tw = ox + CW;
    const fill = `${polyline} ${tw},${H} ${ox},${H}`;
    const yMax = padY;
    const yMid = padY + (H - padY * 2) / 2;
    const yMin = H - padY;
    return { points: polyline, fill, labels: games.map(g => fmtDate(g.endedAt)), minS, midS, maxS, yMin, yMid, yMax, ox, tw, H };
  }

  const recent  = $derived(stats?.recentGames ?? []);
  const curve   = $derived(buildCurve(recent));
  const history = $derived(recent.slice(0, 6));

  const avgScore = $derived(
    profile.games_played > 0 ? Math.round(profile.total_score / profile.games_played) : 0
  );

  const xpMax = $derived(xpForNextLevel(profile.level));
  const xpPct = $derived(Math.min(100, Math.round((profile.xp / xpMax) * 100)));

  const byType = $derived(stats?.scoreByRoomType ?? {
    official: { count: 0, totalScore: 0 },
    public:   { count: 0, totalScore: 0 },
    private:  { count: 0, totalScore: 0 },
  });
  const totalGames = $derived(byType.official.count + byType.public.count + byType.private.count);
  function typePct(count) {
    return totalGames > 0 ? Math.round((count / totalGames) * 100) : 0;
  }

  const bestByRoom = $derived(
    Object.entries(stats?.bestByRoom ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([code, score]) => ({ room: stats?.roomInfo?.[code], score }))
      .filter(e => e.room)
  );

  const winRate = $derived(stats?.winRate ?? { wins: 0, total: 0 });
  const wrPct   = $derived(
    winRate.total > 0 ? Math.round((winRate.wins / winRate.total) * 100) : 0
  );

  const curvePoints = $derived(
    curve.points ? curve.points.split(' ').map(pt => {
      const [cx, cy] = pt.split(',');
      return { cx, cy };
    }) : []
  );
</script>

<div class="profile-grid-wrap">
  <div class="profile-grid">

    <!-- Rangée 1 : 4 stats -->
    <div class="pf-card pf-col-3">
      <div class="pf-card-title">ELO</div>
      <div class="pf-stat-val">{profile.elo ?? '—'}</div>
      <div class="pf-stat-lbl">Classement</div>
      {#if stats?.topPercent}
        <div class="pf-stat-sub">Top {stats.topPercent}% des joueurs</div>
      {/if}
    </div>

    <div class="pf-card pf-col-3">
      <div class="pf-card-title">Parties jou&eacute;es</div>
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
        <div class="pf-stat-sub">moy. {avgScore} pts&nbsp;/&nbsp;partie</div>
      {/if}
    </div>

    <div class="pf-card pf-col-3">
      <div class="pf-card-title">Win rate</div>
      <div class="pf-stat-val">{wrPct}%</div>
      <div class="pf-stat-lbl">1&egrave;res places</div>
      <div class="pf-stat-sub">{winRate.wins} victoires&nbsp;/&nbsp;{winRate.total} parties</div>
      <div class="pf-wr-bar"><div class="pf-wr-fill" style="width:{wrPct}%"></div></div>
    </div>

    <!-- Rangée 2 : courbe + répartition -->
    <div class="pf-card pf-col-8">
      <div class="pf-card-title">&Eacute;volution du score &mdash; {recent.length} derni&egrave;res parties</div>
      {#if recent.length >= 2}
        <svg viewBox="0 0 524 72" style="width:100%;height:80px" aria-hidden="true">
          <defs>
            <linearGradient id="pf-curve-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <!-- Grid lines -->
          <line x1={curve.ox} y1={curve.yMax} x2={curve.tw} y2={curve.yMax} stroke="var(--border)" stroke-width="1"/>
          <line x1={curve.ox} y1={curve.yMid} x2={curve.tw} y2={curve.yMid} stroke="var(--border)" stroke-width="1"/>
          <line x1={curve.ox} y1={curve.yMin} x2={curve.tw} y2={curve.yMin} stroke="var(--border)" stroke-width="1"/>
          <!-- Y labels -->
          <text x={curve.ox - 4} y={curve.yMax + 3.5} text-anchor="end" font-size="9" fill="var(--dim)">{curve.maxS}</text>
          <text x={curve.ox - 4} y={curve.yMid + 3.5} text-anchor="end" font-size="9" fill="var(--dim)">{curve.midS}</text>
          <text x={curve.ox - 4} y={curve.yMin + 3.5} text-anchor="end" font-size="9" fill="var(--dim)">{curve.minS}</text>
          <!-- Fill + line -->
          <polyline points={curve.fill} fill="url(#pf-curve-grad)" stroke="none"/>
          <polyline points={curve.points} fill="none" stroke="var(--accent)" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round"/>
          {#each curvePoints as { cx, cy }}
            <circle {cx} {cy} r="3" fill="var(--accent)"/>
          {/each}
        </svg>
        <div class="pf-curve-labels" style="padding-left:{curve.ox}px">
          {#each curve.labels as lbl}
            <span>{lbl}</span>
          {/each}
        </div>
      {:else}
        <p class="pf-empty" style="margin-top:8px">Pas encore assez de parties pour afficher la courbe.</p>
      {/if}
    </div>

    <div class="pf-card pf-col-4">
      <div class="pf-card-title">R&eacute;partition des parties</div>
      {#if totalGames > 0}
        <div class="pf-distrib-bar">
          <div class="pf-distrib-seg" style="width:{typePct(byType.official.count)}%;background:var(--accent)"></div>
          <div class="pf-distrib-seg" style="width:{typePct(byType.public.count)}%;background:rgb(var(--accent-rgb)/0.5)"></div>
          <div class="pf-distrib-seg" style="width:{typePct(byType.private.count)}%;background:rgb(var(--accent-rgb)/0.2)"></div>
        </div>
        <div class="pf-distrib-legend">
          <div class="pf-distrib-row">
            <div class="pf-distrib-dot">
              <div class="pf-dot" style="background:var(--accent)"></div>
              Officiel &middot; {byType.official.count} parties
            </div>
            <div class="pf-distrib-pts">{fmtScore(byType.official.totalScore)} pts</div>
          </div>
          <div class="pf-distrib-row">
            <div class="pf-distrib-dot">
              <div class="pf-dot" style="background:rgb(var(--accent-rgb)/0.5)"></div>
              Public &middot; {byType.public.count} parties
            </div>
            <div class="pf-distrib-pts">{fmtScore(byType.public.totalScore)} pts</div>
          </div>
          <div class="pf-distrib-row">
            <div class="pf-distrib-dot">
              <div class="pf-dot" style="background:rgb(var(--accent-rgb)/0.2)"></div>
              Priv&eacute; &middot; {byType.private.count} parties
            </div>
            <div class="pf-distrib-pts">{fmtScore(byType.private.totalScore)} pts</div>
          </div>
        </div>
      {:else}
        <p class="pf-empty" style="margin-top:8px">Aucune partie jou&eacute;e.</p>
      {/if}
    </div>

    <!-- Rangée 3 : meilleurs scores + historique -->
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
      <div class="pf-card-title">Historique r&eacute;cent</div>
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
        <p class="pf-empty">Aucune partie jou&eacute;e.</p>
      {/if}
    </div>

    <!-- Rangée 4 : niveau + score moyen -->
    <div class="pf-card pf-col-4">
      <div class="pf-card-title">Niveau &amp; progression</div>
      <div class="pf-level-row">
        <div class="pf-level-num">{profile.level ?? 1}</div>
        <div>
          <div class="pf-level-next">{Math.max(0, xpMax - (profile.xp ?? 0))} XP avant le niveau {(profile.level ?? 1) + 1}</div>
        </div>
      </div>
      <div class="pf-xp-bar"><div class="pf-xp-fill" style="width:{xpPct}%"></div></div>
      <div class="pf-xp-nums"><span>{profile.xp ?? 0} XP</span><span>{xpMax} XP</span></div>
    </div>

    <div class="pf-card pf-col-4">
      <div class="pf-card-title">Score moyen</div>
      <div class="pf-stat-val" style="font-size:2.8rem">{avgScore || '—'}</div>
      <div class="pf-stat-lbl">Points&nbsp;/&nbsp;partie</div>
      {#if stats && stats.winRate?.total > 0}
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

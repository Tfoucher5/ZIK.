'use strict';

// ─── URL params ───────────────────────────────────────────────────────────────
const P        = new URLSearchParams(location.search);
const ROOM_ID  = P.get('roomId')   || 'pop';
const USERNAME = P.get('username') || 'Joueur';
const USER_ID  = P.get('userId')   || null;
const IS_GUEST = P.get('isGuest') === '1';

// ─── YouTube ──────────────────────────────────────────────────────────────────
const socket = io();
let ytPlayer, ytReady = false, pendingLoad = null;

window.onYouTubeIframeAPIReady = () => {
  ytPlayer = new YT.Player('yt-player', {
    height: '1', width: '1',
    playerVars: { autoplay: 1, controls: 0, enablejsapi: 1 },
    events: {
      onReady(e) {
        ytReady = true;
        const v = savedVol();
        e.target.setVolume(v);
        ui.volSlider.style.setProperty('--vol', v + '%');
        if (pendingLoad) { loadVideo(pendingLoad.id, pendingLoad.start); pendingLoad = null; }
      },
      onStateChange(e) {
        if (e.data === YT.PlayerState.PLAYING) { ytPlayer.setVolume(savedVol()); ytPlayer.unMute(); }
      }
    }
  });
};

function loadVideo(videoId, startSeconds) {
  if (!ytReady || !ytPlayer) { pendingLoad = { id: videoId, start: startSeconds }; return; }
  ytPlayer.mute();
  ytPlayer.loadVideoById({ videoId, startSeconds });
}
function stopVideo() { if (ytReady && ytPlayer) ytPlayer.stopVideo(); }
function savedVol()  { return parseInt(localStorage.getItem('zik_vol') ?? '50'); }

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ui = {
  roomLabel:   $('room-label'),
  roundInfo:   $('round-info'),
  timerBar:    $('timer-bar'),
  playerList:  $('player-list'),
  placeholder: $('cover-placeholder'),
  coverImg:    $('cover-img'),
  slotArtist:  $('slot-artist'),
  slotTitle:   $('slot-title'),
  feedback:    $('feedback'),
  summary:     $('round-summary'),
  reason:      $('summary-reason'),
  finder:      $('summary-finder'),
  errorMsg:    $('error-msg'),
  startBtn:    $('startBtn'),
  guessInput:  $('guessInput'),
  histList:    $('history-list'),
  gameover:    $('gameover'),
  goScores:    $('go-scores'),
  replayBtn:   $('replayBtn'),
  volSlider:   $('volSlider'),
};

let personalFound = { artist: false, title: false };
let feedTimer;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Volume
  const setVol = v => {
    ui.volSlider.value = v;
    ui.volSlider.style.setProperty('--vol', v + '%');
    if (ytPlayer?.setVolume) ytPlayer.setVolume(v);
    localStorage.setItem('zik_vol', v);
  };
  setVol(savedVol());
  ui.volSlider.oninput = e => setVol(parseInt(e.target.value));

  // Guess input
  ui.guessInput.onkeydown = e => {
    if (e.key === 'Enter') {
      const val = ui.guessInput.value.trim();
      if (val) socket.emit('submit_guess', val);
      ui.guessInput.value = '';
    }
  };

  // Buttons
  ui.startBtn.onclick  = requestGame;
  ui.replayBtn.onclick = requestGame;

  // Join room
  socket.emit('join_room', { roomId: ROOM_ID, username: USERNAME, userId: USER_ID, isGuest: IS_GUEST });
});

function requestGame() {
  socket.emit('request_new_game');
  ui.startBtn.disabled = true;
  ui.startBtn.textContent = 'Chargement…';
  if (ui.replayBtn) ui.replayBtn.disabled = true;
}

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('room_joined', ({ roomConfig }) => {
  if (roomConfig) {
    const trackInfo = roomConfig.trackCount ? ` — ${roomConfig.trackCount} titres` : '';
    ui.roomLabel.textContent = `${roomConfig.emoji || ''} ${roomConfig.name || ''}${trackInfo}`.trim();
    ui.roomLabel.dataset.base = `${roomConfig.emoji || ''} ${roomConfig.name || ''}`.trim();
  }
});

// Reçu quand la playlist finit de charger côté serveur (si pas encore en cache au join)
socket.on('track_count_update', count => {
  const base = ui.roomLabel.dataset.base || ui.roomLabel.textContent.replace(/ — \d+ titres$/, '');
  ui.roomLabel.textContent = `${base} — ${count} titres`;
  ui.roomLabel.dataset.base = base;
});

socket.on('update_players', players => {
  ui.playerList.innerHTML = players
    .sort((a, b) => b.score - a.score)
    .map((p, i) => {
      const medals = ['🥇','🥈','🥉'];
      const rank   = medals[i] || `#${i+1}`;
      return `<div class="p-card rank-${i+1}">
        <span class="p-name">${rank} ${esc(p.name)}</span>
        <div class="p-right">
          <div class="p-badge ${p.foundArtist ? 'f' : ''}">A</div>
          <div class="p-badge ${p.foundTitle  ? 'f' : ''}">T</div>
          <span class="p-score">${p.score}pt</span>
        </div>
      </div>`;
    }).join('');
});

socket.on('init_history', history => {
  ui.histList.innerHTML = '';
  if (Array.isArray(history) && history.length) {
    // Afficher du plus récent au plus ancien (prepend inverse l'ordre)
    [...history].reverse().forEach(item => ui.histList.appendChild(buildHistoryItem(item)));
  }
});
socket.on('game_starting', () => {
  ui.gameover.style.display = 'none';
  ui.startBtn.style.display = 'none';
});

socket.on('start_round', data => {
  personalFound = { artist: false, title: false };

  ui.roundInfo.textContent = `Manche ${data.round} / ${data.total}`;

  // Reset cover
  ui.coverImg.style.display = 'none';
  ui.coverImg.src = '';
  ui.placeholder.style.display = 'flex';

  // Reset slots
  setSlot(ui.slotArtist, '???', null);
  setSlot(ui.slotTitle,  '???', null);

  // Reset UI
  ui.summary.style.display = 'none';
  ui.gameover.style.display = 'none';
  clearFeedback();

  // Timer
  ui.timerBar.style.transition = 'none';
  ui.timerBar.style.width = '100%';
  ui.timerBar.style.background = 'var(--accent)';
  requestAnimationFrame(() => {
    ui.timerBar.style.transition = 'width 1s linear, background .4s';
  });

  // Input
  ui.guessInput.disabled = false;
  ui.guessInput.value = '';
  ui.guessInput.focus();
  ui.startBtn.style.display  = 'none';
  ui.startBtn.disabled       = false;
  ui.startBtn.textContent    = '🎮 Lancer la partie';

  loadVideo(data.videoId, data.startSeconds);
});

socket.on('timer_update', ({ current, max }) => {
  const pct = (current / max) * 100;
  ui.timerBar.style.width = `${pct}%`;
  ui.timerBar.style.background =
    pct < 30 ? 'var(--danger)' :
    pct < 60 ? '#f59e0b' : 'var(--accent)';
});

socket.on('feedback', data => {
  if (data.type === 'success_artist') {
    setSlot(ui.slotArtist, data.val, 'found');
    personalFound.artist = true;
  }
  if (data.type === 'success_title') {
    setSlot(ui.slotTitle, data.val, 'found');
    personalFound.title = true;
  }

  const cls = data.type === 'miss'  ? 'cold' :
              data.type === 'close' ? 'hot'  : 'good';
  showFeedback(data.msg, cls);
});

socket.on('reveal_cover', ({ cover }) => {
  if (cover && ui.coverImg.src !== cover) {
    ui.coverImg.src = cover;
    ui.coverImg.style.display = 'block';
    ui.placeholder.style.display = 'none';
  }
});

socket.on('round_end', data => {
  const [artist, ...rest] = data.answer.split(' - ');
  const title = rest.join(' - ');

  setSlot(ui.slotArtist, artist || data.answer, data.foundArtist ? 'found' : 'missed');
  setSlot(ui.slotTitle,  title  || '—',          data.foundTitle  ? 'found' : 'missed');

  if (data.cover) {
    ui.coverImg.src = data.cover;
    ui.coverImg.style.display = 'block';
    ui.placeholder.style.display = 'none';
  }

  ui.summary.style.display = 'block';
  ui.reason.textContent  = data.reason;
  ui.finder.textContent  = data.totalFound > 0
    ? `🏆 1er : ${data.firstFinder} — ${data.totalFound} joueur(s) ont tout trouvé`
    : "❌ Personne n'a trouvé";

  ui.guessInput.disabled = true;
  ui.timerBar.style.transition = 'none';
  ui.timerBar.style.width = '0%';
  stopVideo();

  // Add to history
  const el = buildHistoryItem(data, data.foundArtist, data.foundTitle);
  ui.histList.prepend(el);
  // No max-height limit — sidebar scrolls naturally
});

socket.on('game_over', scores => {
  stopVideo();
  ui.guessInput.disabled = true;
  ui.timerBar.style.width = '0%';
  ui.summary.style.display = 'none';

  const medals = ['🥇','🥈','🥉'];
  ui.goScores.innerHTML = scores.map((p, i) => `
    <div class="go-row rank-${i+1}">
      <span class="go-medal">${medals[i] || `#${i+1}`}</span>
      <span class="go-name">${esc(p.name)}${p.isGuest ? ' <span style="font-size:.7rem;opacity:.5">(invité)</span>' : ''}</span>
      <span class="go-score">${p.score} pts</span>
    </div>`).join('');

  ui.gameover.style.display = 'flex';
  if (ui.replayBtn) { ui.replayBtn.disabled = false; ui.replayBtn.textContent = '🔄 Rejouer'; }
});

socket.on('server_error', msg => {
  ui.errorMsg.textContent = msg;
  ui.errorMsg.style.display = 'block';
  setTimeout(() => ui.errorMsg.style.display = 'none', 4000);
  ui.startBtn.disabled = false;
  ui.startBtn.textContent = '🎮 Lancer la partie';
  if (ui.replayBtn) ui.replayBtn.disabled = false;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setSlot(el, text, state) {
  el.className = 'slot' + (state ? ' ' + state : '');
  el.querySelector('.slot-val').textContent = text;
}

function showFeedback(msg, cls) {
  clearTimeout(feedTimer);
  ui.feedback.textContent = msg;
  ui.feedback.className = `show ${cls}`;
  feedTimer = setTimeout(() => { ui.feedback.className = ''; }, 2600);
}
function clearFeedback() {
  clearTimeout(feedTimer);
  ui.feedback.className = '';
  ui.feedback.textContent = '';
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildHistoryItem(data, foundArtist, foundTitle) {
  const el = document.createElement('div');
  el.className = 'h-item';
  const coverHtml = data.cover
    ? `<img src="${esc(data.cover)}" alt="">`
    : `<div class="h-no-img">♪</div>`;
  const tagsHtml = (foundArtist !== undefined)
    ? `<div class="h-tags">
        <span class="h-tag ${foundArtist ? 'f' : ''}">A</span>
        <span class="h-tag ${foundTitle  ? 'f' : ''}">T</span>
       </div>`
    : '';
  el.innerHTML = `${coverHtml}<div class="h-info"><div class="h-name">${esc(data.answer)}</div>${tagsHtml}</div>`;
  return el;
}

const socket = io();
let player;
let ytReady = false;
let pendingVideo = null;
let personalProgress = { artist: false, title: false };

// ─── YouTube API ──────────────────────────────────────────────────────────────
function onYouTubeIframeAPIReady() {
    ytReady = false;
    player = new YT.Player('youtube-player', {
        height: '0', width: '0',
        playerVars: { autoplay: 1, controls: 0, enablejsapi: 1 },
        events: {
            onReady: (e) => {
                ytReady = true;
                const vol = parseInt(localStorage.getItem('bt_volume') ?? '50');
                e.target.setVolume(vol);
                if (pendingVideo) {
                    loadVideo(pendingVideo.videoId, pendingVideo.startSeconds);
                    pendingVideo = null;
                }
            },
            onStateChange: (e) => {
                if (e.data === YT.PlayerState.PLAYING) {
                    const vol = parseInt(localStorage.getItem('bt_volume') ?? '50');
                    player.setVolume(vol);
                    player.unMute();
                }
            }
        }
    });
}

function loadVideo(videoId, startSeconds) {
    if (!ytReady || !player) {
        pendingVideo = { videoId, startSeconds };
        return;
    }
    player.mute();
    player.loadVideoById({ videoId, startSeconds });
}

// ─── DOM Ready ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const ui = {
        login:       document.getElementById('login-screen'),
        game:        document.getElementById('game-screen'),
        placeholder: document.getElementById('album-placeholder'),
        cover:       document.getElementById('reveal-cover'),
        summary:     document.getElementById('round-summary'),
        social:      document.getElementById('first-finder-msg'),
        reason:      document.getElementById('round-reason'),
        timer:       document.getElementById('timer-bar'),
        round:       document.getElementById('round-info'),
        players:     document.getElementById('player-list'),
        guess:       document.getElementById('guessInput'),
        start:       document.getElementById('startBtn'),
        join:        document.getElementById('joinBtn'),
        nameInput:   document.getElementById('usernameInput'),
        vol:         document.getElementById('volumeSlider'),
        hist:        document.getElementById('history-list'),
        feed:        document.getElementById('game-feedback'),
        artistVal:   document.querySelector('#slot-artist .val'),
        titleVal:    document.querySelector('#slot-title .val'),
        artistSlot:  document.getElementById('slot-artist'),
        titleSlot:   document.getElementById('slot-title'),
        gameOver:    document.getElementById('game-over-screen'),
        finalList:   document.getElementById('final-scores'),
        errorMsg:    document.getElementById('error-msg'),
    };

    // Volume init
    const savedVol = localStorage.getItem('bt_volume') ?? '50';
    ui.vol.value = savedVol;

    // ─── Login ────────────────────────────────────────────────────────────────
    const joinGame = (name) => {
        if (!name || name.trim() === '') return;
        name = name.trim();
        localStorage.setItem('bt_username', name);
        socket.emit('join_game', name);
        ui.login.style.display = 'none';
        ui.game.style.display = 'grid';
    };

    const cached = localStorage.getItem('bt_username');
    if (cached) {
        ui.nameInput.value = cached;
        joinGame(cached);
    }

    ui.join.onclick = () => joinGame(ui.nameInput.value.trim());
    ui.nameInput.onkeypress = (e) => { if (e.key === 'Enter') joinGame(ui.nameInput.value.trim()); };

    // ─── Volume ───────────────────────────────────────────────────────────────
    ui.vol.oninput = (e) => {
        const v = parseInt(e.target.value);
        if (player && player.setVolume) player.setVolume(v);
        localStorage.setItem('bt_volume', v);
    };

    // ─── Boutons ─────────────────────────────────────────────────────────────
    ui.start.onclick = () => {
        socket.emit('request_new_game');
        ui.start.disabled = true;
        ui.start.textContent = 'Chargement...';
    };

    ui.guess.onkeypress = (e) => {
        if (e.key === 'Enter') {
            const val = ui.guess.value.trim();
            if (val) socket.emit('submit_guess', val);
            ui.guess.value = '';
        }
    };

    // ─── Socket Events ────────────────────────────────────────────────────────

    socket.on('update_players', (players) => {
        ui.players.innerHTML = players
            .sort((a, b) => b.score - a.score)
            .map((p, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                const foundBadge = `${p.foundArtist ? '<span class="badge found">A</span>' : '<span class="badge">A</span>'}${p.foundTitle ? '<span class="badge found">T</span>' : '<span class="badge">T</span>'}`;
                return `<div class="p-card rank-${i + 1}">
                    <span>${medal} ${p.name}</span>
                    <div style="display:flex;gap:8px;align-items:center">
                        <div style="display:flex;gap:3px">${foundBadge}</div>
                        <span class="score">${p.score} pt${p.score > 1 ? 's' : ''}</span>
                    </div>
                </div>`;
            }).join('');
    });

    socket.on('init_history', () => {
        ui.hist.innerHTML = '';
    });

    socket.on('game_starting', () => {
        ui.gameOver.style.display = 'none';
        ui.start.style.display = 'none';
    });

    socket.on('start_round', (data) => {
        personalProgress = { artist: false, title: false };

        ui.round.innerText = `Manche ${data.round} / ${data.total}`;
        ui.placeholder.style.display = 'flex';
        ui.cover.style.display = 'none';
        ui.cover.src = '';
        ui.summary.style.display = 'none';
        ui.gameOver.style.display = 'none';

        ui.artistVal.innerText = '???';
        ui.titleVal.innerText = '???';
        ui.artistSlot.className = 'slot';
        ui.titleSlot.className = 'slot';

        ui.timer.style.width = '100%';
        ui.timer.style.background = 'var(--accent)';

        ui.guess.disabled = false;
        ui.guess.value = '';
        ui.guess.focus();

        ui.start.style.display = 'none';
        ui.start.disabled = false;
        ui.start.textContent = 'LANCER UNE PARTIE';

        ui.feed.innerText = '';
        ui.feed.className = '';

        loadVideo(data.videoId, data.startSeconds);
    });

    socket.on('timer_update', (data) => {
        const pct = (data.current / data.max) * 100;
        ui.timer.style.width = `${pct}%`;
        if (pct < 30) ui.timer.style.background = '#ff4757';
        else if (pct < 60) ui.timer.style.background = '#ffa502';
    });

    let feedTimeout = null;
    socket.on('feedback', (data) => {
        ui.feed.innerText = data.msg;
        ui.feed.className = '';
        void ui.feed.offsetWidth; // reflow pour relancer l'animation
        ui.feed.className = `active ${data.type === 'miss' ? 'cold' : 'hot'}`;

        if (data.type === 'success_artist') {
            ui.artistVal.innerText = data.val;
            ui.artistSlot.className = 'slot found';
            personalProgress.artist = true;
        }
        if (data.type === 'success_title') {
            ui.titleVal.innerText = data.val;
            ui.titleSlot.className = 'slot found';
            personalProgress.title = true;
        }

        // Révéler la pochette si tout trouvé
        if (personalProgress.artist && personalProgress.title) {
            // On attend le round_end pour la pochette (elle sera dans les données)
        }

        clearTimeout(feedTimeout);
        feedTimeout = setTimeout(() => {
            ui.feed.classList.remove('active');
        }, 2500);
    });

    socket.on('round_end', (data) => {
        // Révéler l'answer dans les slots
        const parts = data.answer.split(' - ');
        ui.artistVal.innerText = parts[0] || data.answer;
        ui.titleVal.innerText = parts.slice(1).join(' - ') || '';
        ui.artistSlot.className = `slot ${data.foundArtist ? 'found' : 'missed'}`;
        ui.titleSlot.className = `slot ${data.foundTitle ? 'found' : 'missed'}`;

        // Pochette album
        if (data.cover) {
            ui.cover.src = data.cover;
            ui.cover.style.display = 'block';
            ui.placeholder.style.display = 'none';
        }

        // Résumé de manche
        ui.summary.style.display = 'block';
        if (ui.reason) ui.reason.innerText = data.reason;
        ui.social.innerText = data.totalFound > 0
            ? `🏆 1er complet : ${data.firstFinder} — ${data.totalFound} joueur(s) ont tout trouvé`
            : "❌ Personne n'a trouvé cette manche";

        ui.guess.disabled = true;
        ui.timer.style.width = '0%';

        if (player && ytReady) player.stopVideo();

        // Ajouter à l'historique
        const item = document.createElement('div');
        item.className = 'h-item';
        item.innerHTML = `
            ${data.cover ? `<img src="${data.cover}" alt="cover">` : '<div class="h-img-placeholder">♪</div>'}
            <div class="h-info">
                <div class="h-title">${data.answer}</div>
                <div class="h-tags">
                    <span class="${data.foundArtist ? 'f' : ''}">A</span>
                    <span class="${data.foundTitle ? 'f' : ''}">T</span>
                </div>
            </div>`;
        ui.hist.prepend(item);
    });

    socket.on('game_over', (finalScores) => {
        if (player && ytReady) player.stopVideo();
        ui.guess.disabled = true;
        ui.timer.style.width = '0%';
        ui.summary.style.display = 'none';

        ui.gameOver.style.display = 'flex';
        ui.finalList.innerHTML = finalScores.map((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            return `<div class="final-card rank-${i + 1}">
                <span class="final-rank">${medal}</span>
                <span class="final-name">${p.name}</span>
                <span class="final-score">${p.score} pts</span>
            </div>`;
        }).join('');

        ui.start.style.display = 'block';
        ui.start.disabled = false;
        ui.start.textContent = '🔄 REJOUER';
    });

    socket.on('server_error', (msg) => {
        if (ui.errorMsg) {
            ui.errorMsg.innerText = msg;
            ui.errorMsg.style.display = 'block';
            setTimeout(() => ui.errorMsg.style.display = 'none', 4000);
        }
        ui.start.disabled = false;
        ui.start.textContent = 'LANCER UNE PARTIE';
    });

    socket.on('connect_error', () => {
        console.error('Connexion au serveur perdue.');
    });
});

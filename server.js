const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');
const stringSimilarity = require('string-similarity');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const CONFIG = { maxRounds: 10, roundDuration: 30, breakDuration: 7 };

// players[username] = { name, score, foundArtist, foundTitle }
let players = {};
// double mapping pour cibler les sockets
let socketToName = {};  // socketId -> username
let nameToSocket = {};  // username -> socketId

let game = {
    isActive: false,
    currentRound: 0,
    timer: 0,
    interval: null,
    currentTrack: null,
    startTime: 0,
    sessionPlaylist: [],
    history: [],
    firstFullFinder: null,
    totalFullFound: 0,
    lastRoundData: null
};

let masterPlaylist = [];

function cleanString(str) {
    if (!str) return "";
    return str
        .replace(/ *\([^)]*\) */g, "")
        .replace(/ *\[[^\]]*\] */g, "")
        .trim()
        .toLowerCase();
}

async function refreshPlaylistFromDeezer() {
    try {
        const response = await fetch('https://api.deezer.com/playlist/3155776842');
        const data = await response.json();
        masterPlaylist = data.tracks.data.map(t => ({
            artist: t.artist.name,
            title: t.title,
            cleanTitle: cleanString(t.title),
            cleanArtist: cleanString(t.artist.name),
            album: t.album.title,
            cover: t.album.cover_xl
        }));
        console.log(`✅ Deezer : ${masterPlaylist.length} titres chargés.`);
    } catch (err) {
        console.error("❌ Deezer inaccessible :", err.message);
    }
}
refreshPlaylistFromDeezer();

io.on('connection', (socket) => {
    console.log(`🔌 Connexion : ${socket.id}`);

    socket.on('join_game', (username) => {
        if (!username || username.trim() === '') return;
        username = username.trim();

        // Reconnecter un joueur existant
        if (players[username]) {
            // Mettre à jour le socket si reconnexion
            const oldSocketId = nameToSocket[username];
            if (oldSocketId && oldSocketId !== socket.id) {
                delete socketToName[oldSocketId];
            }
        } else {
            players[username] = { name: username, score: 0, foundArtist: false, foundTitle: false };
        }

        socketToName[socket.id] = username;
        nameToSocket[username] = socket.id;

        console.log(`👤 ${username} a rejoint (socket: ${socket.id})`);

        io.emit('update_players', Object.values(players));
        socket.emit('init_history', game.history);

        if (game.isActive && game.lastRoundData) {
            socket.emit('start_round', game.lastRoundData);
        }
    });

    socket.on('request_new_game', () => {
        if (game.isActive) return;
        if (masterPlaylist.length === 0) {
            socket.emit('server_error', "La playlist Deezer n'est pas encore chargée, réessaie dans quelques secondes.");
            return;
        }

        game.history = [];
        game.currentRound = 0;
        game.sessionPlaylist = [...masterPlaylist]
            .sort(() => Math.random() - 0.5)
            .slice(0, CONFIG.maxRounds);

        resetScores();
        io.emit('init_history', []);
        io.emit('game_starting');
        startNextRound();
    });

    socket.on('submit_guess', (guess) => {
        const name = socketToName[socket.id];
        if (!game.isActive || !game.currentTrack || !players[name]) return;
        if (!guess || guess.trim() === '') return;

        let user = players[name];
        let input = cleanString(guess);
        let timeTaken = (Date.now() - game.startTime) / 1000;
        let speedBonus = timeTaken < 10 ? 2 : timeTaken < 20 ? 1 : 0;

        const simArtist = stringSimilarity.compareTwoStrings(input, game.currentTrack.cleanArtist);
        const simTitle = stringSimilarity.compareTwoStrings(input, game.currentTrack.cleanTitle);

        let hit = false;

        // Vérification Artiste
        if (!user.foundArtist) {
            const artistMatch = simArtist > 0.72 || game.currentTrack.cleanArtist.includes(input) || input.includes(game.currentTrack.cleanArtist);
            const artistClose = simArtist > 0.45;

            if (artistMatch && input.length > 1) {
                user.foundArtist = true;
                user.score += 1 + speedBonus;
                socket.emit('feedback', {
                    type: 'success_artist',
                    msg: `✅ Artiste trouvé ! (+${1 + speedBonus} pts)`,
                    val: game.currentTrack.artist
                });
                hit = true;
            } else if (artistClose) {
                socket.emit('feedback', { type: 'close', msg: "🔥 Tu chauffes sur l'artiste !" });
                hit = true;
            }
        }

        // Vérification Titre
        if (!user.foundTitle) {
            const titleMatch = simTitle > 0.72 || game.currentTrack.cleanTitle.includes(input) || input.includes(game.currentTrack.cleanTitle);
            const titleClose = simTitle > 0.45;

            if (titleMatch && input.length > 1) {
                user.foundTitle = true;
                user.score += 1 + speedBonus;
                socket.emit('feedback', {
                    type: 'success_title',
                    msg: `✅ Titre trouvé ! (+${1 + speedBonus} pts)`,
                    val: game.currentTrack.title
                });
                hit = true;
            } else if (titleClose && !hit) {
                socket.emit('feedback', { type: 'close', msg: "🔥 Tu chauffes sur le titre !" });
                hit = true;
            }
        }

        if (!hit) {
            socket.emit('feedback', { type: 'miss', msg: "❄️ Pas du tout..." });
        }

        // Mise à jour du classement pour tout le monde
        io.emit('update_players', Object.values(players));

        // Si ce joueur a tout trouvé
        if (user.foundArtist && user.foundTitle) {
            game.totalFullFound++;
            if (!game.firstFullFinder) game.firstFullFinder = user.name;
        }

        checkEveryoneFound();
    });

    socket.on('disconnect', () => {
        const name = socketToName[socket.id];
        if (name) {
            delete nameToSocket[name];
            delete socketToName[socket.id];
            // On garde le joueur dans players pour conserver son score
            // mais on pourrait vouloir le retirer si on préfère
            console.log(`🔴 ${name} déconnecté`);
        }
    });
});

async function startNextRound() {
    if (game.currentRound >= CONFIG.maxRounds || game.sessionPlaylist.length === 0) {
        game.isActive = false;
        const finalScores = Object.values(players).sort((a, b) => b.score - a.score);
        io.emit('game_over', finalScores);
        return;
    }

    game.currentRound++;
    game.firstFullFinder = null;
    game.totalFullFound = 0;
    resetRoundFlags();
    game.currentTrack = game.sessionPlaylist.pop();

    console.log(`🎵 Manche ${game.currentRound}: ${game.currentTrack.artist} - ${game.currentTrack.title}`);

    try {
        const r = await yts(`${game.currentTrack.artist} ${game.currentTrack.title} topic`);
        if (!r.videos || r.videos.length === 0) throw new Error("Aucune vidéo trouvée");

        const video = r.videos[0];
        const safeStart = Math.max(0, Math.floor(Math.random() * Math.max(1, video.seconds - CONFIG.roundDuration - 10)));

        game.isActive = true;
        game.startTime = Date.now();
        game.timer = CONFIG.roundDuration;

        game.lastRoundData = {
            videoId: video.videoId,
            startSeconds: safeStart,
            round: game.currentRound,
            total: CONFIG.maxRounds
        };

        io.emit('start_round', game.lastRoundData);
        startTimer();

    } catch (err) {
        console.error(`⚠️ Erreur vidéo pour "${game.currentTrack.title}":`, err.message);
        // Skip ce titre et passer au suivant
        startNextRound();
    }
}

function startTimer() {
    clearInterval(game.interval);
    game.interval = setInterval(() => {
        game.timer--;
        io.emit('timer_update', { current: game.timer, max: CONFIG.roundDuration });
        if (game.timer <= 0) endRound("⏱️ Temps écoulé !");
    }, 1000);
}

function checkEveryoneFound() {
    const activePlayers = Object.values(players);
    if (activePlayers.length === 0) return;
    if (activePlayers.every(u => u.foundArtist && u.foundTitle) && game.isActive) {
        endRound("🎉 Tout le monde a trouvé !");
    }
}

function endRound(reason) {
    clearInterval(game.interval);
    game.isActive = false;

    const summary = {
        answer: `${game.currentTrack.artist} - ${game.currentTrack.title}`,
        cover: game.currentTrack.cover,
        reason,
        firstFinder: game.firstFullFinder,
        totalFound: game.totalFullFound
    };

    game.history.push(summary);

    // Envoyer à chaque joueur avec ses propres résultats
    Object.keys(players).forEach(username => {
        const p = players[username];
        const socketId = nameToSocket[username];
        if (socketId) {
            io.to(socketId).emit('round_end', {
                ...summary,
                foundArtist: p.foundArtist,
                foundTitle: p.foundTitle
            });
        }
    });

    setTimeout(startNextRound, CONFIG.breakDuration * 1000);
}

function resetRoundFlags() {
    Object.keys(players).forEach(n => {
        players[n].foundArtist = false;
        players[n].foundTitle = false;
    });
}

function resetScores() {
    Object.keys(players).forEach(n => players[n].score = 0);
    io.emit('update_players', Object.values(players));
}

server.listen(3000, () => console.log('🚀 BT Project lancé sur http://localhost:3000'));

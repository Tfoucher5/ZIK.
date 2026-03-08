import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const stringSimilarity = require('string-similarity');
const yts              = require('yt-search');

import { supabase }  from '../config.js';
import ROOMS         from '../rooms.js';
import { playlistCache, customRooms, dbRooms, roomGames } from '../state.js';
import { loadPlaylist, cleanString, displayString, buildTrack, calcSpeedBonus } from '../services/playlist.js';

const DEFAULT_ROUND_DURATION = 30;
const DEFAULT_BREAK_DURATION = 7;

// ─── Room state management ────────────────────────────────────────────────────

function getOrCreateRoom(roomId) {
  if (roomGames[roomId]) {
    if (roomGames[roomId]._emptyTimer) {
      clearTimeout(roomGames[roomId]._emptyTimer);
      roomGames[roomId]._emptyTimer = null;
    }
    return roomGames[roomId];
  }
  const cust = customRooms[roomId] || dbRooms[roomId];
  roomGames[roomId] = {
    roomId,
    players:      {},
    socketToName: {},
    nameToSocket: {},
    game: {
      isActive:         false,
      currentRound:     0,
      maxRounds:        cust?.max_rounds || cust?.maxRounds || ROOMS[roomId]?.maxRounds || 10,
      roundDuration:    cust?.round_duration || cust?.roundDuration || DEFAULT_ROUND_DURATION,
      breakDuration:    cust?.break_duration || cust?.breakDuration || DEFAULT_BREAK_DURATION,
      timer:            0,
      interval:         null,
      breakTimer:       null,
      currentTrack:     null,
      startTime:        0,
      sessionPlaylist:  [],
      history:          [],
      firstFullFinder:  null,
      totalFullFound:   0,
      lastRoundData:    null,
      dbGameId:         null,
    },
  };
  return roomGames[roomId];
}

function cleanupRoom(roomId) {
  const room = roomGames[roomId];
  if (!room) return;
  clearInterval(room.game.interval);
  clearTimeout(room.game.breakTimer);
  room.game.interval   = null;
  room.game.breakTimer = null;
  delete roomGames[roomId];
  console.log(`Room "${roomId}" liberee de la memoire`);
}

function resetRoundFlags(room) {
  Object.keys(room.players).forEach(n => {
    room.players[n].foundArtist       = false;
    room.players[n].foundTitle        = false;
    room.players[n].foundFeats        = [];
    room.players[n]._fullFoundCounted = false;
  });
}

function resetScores(room, io) {
  Object.keys(room.players).forEach(n => { room.players[n].score = 0; });
  io.to(`room:${room.roomId}`).emit('update_players', Object.values(room.players));
}

function checkEveryoneFound(roomId, io) {
  const room          = getOrCreateRoom(roomId);
  const track         = room.game.currentTrack;
  const activePlayers = Object.values(room.players);
  const allDone       = p => {
    const allFeats = (track?.cleanFeatArtists || []).every((_, i) => p.foundFeats[i]);
    return p.foundArtist && p.foundTitle && allFeats;
  };
  if (activePlayers.length > 0 && activePlayers.every(allDone) && room.game.isActive) {
    endRound(roomId, 'Tout le monde a trouve !', io);
  }
}

function endRound(roomId, reason, io) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;
  clearInterval(game.interval);
  game.isActive = false;

  const summary = {
    answer:      `${displayString(game.currentTrack.artist)} - ${displayString(game.currentTrack.title)}`,
    cover:       game.currentTrack.cover,
    reason,
    firstFinder: game.firstFullFinder,
    totalFound:  game.totalFullFound,
    featArtists: (game.currentTrack.featArtists || []).map(displayString),
  };
  game.history.push(summary);

  Object.keys(room.players).forEach(username => {
    const p        = room.players[username];
    const socketId = room.nameToSocket[username];
    if (socketId) {
      io.to(socketId).emit('round_end', {
        ...summary,
        foundArtist: p.foundArtist,
        foundTitle:  p.foundTitle,
        foundFeats:  p.foundFeats || [],
      });
    }
  });

  game.breakTimer = setTimeout(() => {
    game.breakTimer = null;
    startNextRound(roomId, io);
  }, game.breakDuration * 1000);
}

function startTimer(roomId, io) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;
  clearInterval(game.interval);
  game.interval = setInterval(() => {
    game.timer--;
    io.to(`room:${roomId}`).emit('timer_update', { current: game.timer, max: game.roundDuration });
    if (game.timer <= 0) endRound(roomId, 'Temps ecoule !', io);
  }, 1000);
}

async function startNextRound(roomId, io) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;

  if (game.currentRound >= game.maxRounds || game.sessionPlaylist.length === 0) {
    game.isActive = false;
    const finalScores = Object.values(room.players).sort((a, b) => b.score - a.score);
    io.to(`room:${roomId}`).emit('game_over', finalScores);
    await saveGameResults(roomId, finalScores);
    return;
  }

  game.currentRound++;
  game.firstFullFinder = null;
  game.totalFullFound  = 0;
  resetRoundFlags(room);
  game.currentTrack = game.sessionPlaylist.pop();

  try {
    const r         = await yts(`${game.currentTrack.artist} ${game.currentTrack.title} topic`);
    if (!r.videos?.length) throw new Error('No video');

    const video     = r.videos[0];
    const safeStart = Math.max(0, Math.floor(Math.random() * Math.max(1, video.seconds - game.roundDuration - 10)));

    game.isActive       = true;
    game.startTime      = Date.now();
    game.timer          = game.roundDuration;
    game.lastRoundData  = {
      videoId:      video.videoId,
      startSeconds: safeStart,
      round:        game.currentRound,
      total:        game.maxRounds,
      featCount:    game.currentTrack.featArtists.length,
    };

    io.to(`room:${roomId}`).emit('start_round', game.lastRoundData);
    startTimer(roomId, io);
  } catch (err) {
    console.error(`Skip "${game.currentTrack.title}":`, err.message);
    startNextRound(roomId, io);
  }
}

async function saveGameResults(roomId, finalScores) {
  const room     = getOrCreateRoom(roomId);
  const dbGameId = room.game.dbGameId;
  if (!dbGameId) return;

  try {
    await supabase.from('games').update({ ended_at: new Date().toISOString() }).eq('id', dbGameId);

    const players = finalScores.map((p, i) => ({
      game_id:  dbGameId,
      user_id:  p.userId || null,
      username: p.name,
      score:    p.score,
      rank:     i + 1,
      is_guest: p.isGuest || !p.userId,
    }));
    await supabase.from('game_players').insert(players);

    for (let i = 0; i < finalScores.length; i++) {
      const p = finalScores[i];
      if (p.userId && !p.isGuest) {
        await supabase.rpc('update_player_stats', {
          p_user_id:       p.userId,
          p_score:         p.score,
          p_rank:          i + 1,
          p_total_players: finalScores.length,
        });
      }
    }
    console.log(`Game ${dbGameId} sauvegardee.`);
  } catch (err) {
    console.error('Erreur sauvegarde:', err.message);
  }
}

function wordMatch(input, target) {
  if (input.length < 2) return false;
  const totalLen = target.replace(/\s+/g, '').length || 1;
  const words    = target.split(/\s+/).filter(w => w.length >= 2);
  return words.some(w =>
    stringSimilarity.compareTwoStrings(input, w) > 0.88 &&
    w.length / totalLen >= 0.50
  );
}

function leaveRoom(socket, roomId, io) {
  const room = roomGames[roomId];
  if (!room) return;
  const name = room.socketToName[socket.id];
  if (name) {
    delete room.nameToSocket[name];
    delete room.socketToName[socket.id];
    if (room.players[name]) {
      clearTimeout(room.players[name]._dcTimer);
      room.players[name]._dcTimer = setTimeout(() => {
        if (!roomGames[roomId]) return;
        delete room.players[name];
        const active = Object.values(room.players).filter(p => !p._dcTimer);
        io.to(`room:${roomId}`).emit('update_players', active);

        if (active.length === 0) {
          if (room.game.isActive) {
            clearInterval(room.game.interval);
            clearTimeout(room.game.breakTimer);
            room.game.interval   = null;
            room.game.breakTimer = null;
            room.game.isActive   = false;
            console.log(`Room "${roomId}" vide — partie stoppee`);
          }
          if (customRooms[roomId]) {
            room._emptyTimer = setTimeout(() => cleanupRoom(roomId), 15 * 60 * 1000);
          } else {
            cleanupRoom(roomId);
          }
        }
      }, 30_000);
    }
  }
  socket.leave(`room:${roomId}`);
}

// ─── Socket.IO registration ───────────────────────────────────────────────────

export function register(io) {
  io.on('connection', (socket) => {

    socket.on('join_room', async ({ roomId, username, userId, isGuest }) => {
      if (!username?.trim()) return socket.emit('error', 'Pseudo requis');

      if (!ROOMS[roomId] && !customRooms[roomId] && !dbRooms[roomId]) {
        const { data: dbRoom } = await supabase
          .from('rooms')
          .select('code, name, emoji, max_rounds, round_duration, break_duration, playlist_id')
          .eq('code', roomId)
          .single();
        if (dbRoom) {
          dbRooms[roomId] = dbRoom;
        } else {
          return socket.emit('error', 'Room inconnue ou expiree');
        }
      }

      username = username.trim();
      const room = getOrCreateRoom(roomId);

      if (socket.currentRoom) leaveRoom(socket, socket.currentRoom, io);

      socket.join(`room:${roomId}`);
      socket.currentRoom = roomId;
      socket.currentUser = { username, userId, isGuest };

      if (!room.players[username]) {
        room.players[username] = {
          name:              username,
          userId:            userId || null,
          isGuest:           isGuest !== false,
          score:             0,
          foundArtist:       false,
          foundTitle:        false,
          foundFeats:        [],
          _fullFoundCounted: false,
        };
      } else {
        clearTimeout(room.players[username]._dcTimer);
        delete room.players[username]._dcTimer;
        const oldSocketId = room.nameToSocket[username];
        if (oldSocketId) delete room.socketToName[oldSocketId];
      }

      room.socketToName[socket.id] = username;
      room.nameToSocket[username]  = socket.id;

      io.to(`room:${roomId}`).emit('update_players', Object.values(room.players));

      if (!playlistCache[roomId] && (ROOMS[roomId] || dbRooms[roomId])) {
        loadPlaylist(roomId)
          .then(tracks => { if (tracks.length > 0) socket.emit('track_count_update', tracks.length); })
          .catch(() => {});
      }

      const cust         = customRooms[roomId] || dbRooms[roomId];
      const officialRoom = ROOMS[roomId];
      socket.emit('room_joined', {
        roomId,
        roomConfig: officialRoom
          ? { ...officialRoom, trackCount: playlistCache[roomId]?.length || null }
          : {
              id:         roomId,
              name:       cust?.name,
              emoji:      cust?.emoji,
              trackCount: customRooms[roomId]?.tracks?.length || playlistCache[roomId]?.length || null,
              maxRounds:  cust?.max_rounds || cust?.maxRounds,
            },
      });
      socket.emit('init_history', room.game.history);

      if (room.game.isActive && room.game.lastRoundData) {
        socket.emit('start_round', room.game.lastRoundData);
      }

      console.log(`${username} -> room "${roomId}"`);
    });

    socket.on('request_new_game', async () => {
      const roomId = socket.currentRoom;
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      if (room.game.isActive) return;

      const playlist = await loadPlaylist(roomId);
      if (playlist.length === 0) return socket.emit('server_error', 'Playlist indisponible, reessaie.');

      room.game.history         = [];
      room.game.currentRound    = 0;
      room.game.sessionPlaylist = [...playlist]
        .sort(() => Math.random() - 0.5)
        .slice(0, room.game.maxRounds);

      resetScores(room, io);
      io.to(`room:${roomId}`).emit('init_history', []);
      io.to(`room:${roomId}`).emit('game_starting');

      try {
        const { data } = await supabase.from('games').insert({
          room_id: roomId,
          rounds:  room.game.maxRounds,
        }).select().single();
        if (data) room.game.dbGameId = data.id;
      } catch { /* non-blocking */ }

      startNextRound(roomId, io);
    });

    socket.on('submit_guess', async (guess) => {
      const roomId = socket.currentRoom;
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      const name = room.socketToName[socket.id];

      if (!room.game.isActive || !room.game.currentTrack || !room.players[name]) return;
      if (!guess?.trim()) return;

      const user       = room.players[name];
      const input      = cleanString(guess);
      const timeTaken  = (Date.now() - room.game.startTime) / 1000;
      const speedBonus = calcSpeedBonus(timeTaken);
      const track      = room.game.currentTrack;
      const cover      = track.cover || '';

      const simArtist = stringSimilarity.compareTwoStrings(input, track.cleanArtist);
      const simTitle  = stringSimilarity.compareTwoStrings(input, track.cleanTitle);

      let hit = false;

      if (!user.foundArtist) {
        const match = input.length >= 1 && (
          simArtist > 0.75 ||
          (input.length >= 3 && simArtist > 0.65 && wordMatch(input, track.cleanArtist))
        );
        if (match) {
          user.foundArtist = true;
          user.score += 1 + speedBonus;
          socket.emit('feedback', { type: 'success_artist', msg: `Artiste ! (+${1 + speedBonus} pts)`, val: displayString(track.mainArtist || track.artist), cover });
          hit = true;
        } else if (simArtist > 0.50) {
          socket.emit('feedback', { type: 'close', msg: "Tu chauffes sur l'artiste !" });
          hit = true;
        }
      }

      for (let fi = 0; fi < track.cleanFeatArtists.length; fi++) {
        if (user.foundFeats[fi]) continue;
        const cleanFeat = track.cleanFeatArtists[fi];
        const simFeat   = stringSimilarity.compareTwoStrings(input, cleanFeat);
        const matchFeat = input.length >= 1 && (
          simFeat > 0.75 ||
          (input.length >= 3 && simFeat > 0.65 && wordMatch(input, cleanFeat))
        );
        if (matchFeat) {
          user.foundFeats[fi] = true;
          user.score += 1 + speedBonus;
          socket.emit('feedback', { type: 'success_feat', featIndex: fi, msg: `Feat ! (+${1 + speedBonus} pts)`, val: displayString(track.featArtists[fi]), cover });
          hit = true;
          break;
        } else if (simFeat > 0.50 && !hit) {
          socket.emit('feedback', { type: 'close', msg: 'Tu chauffes sur le feat !' });
          hit = true;
        }
      }

      if (!user.foundTitle) {
        const match = input.length >= 1 && (
          simTitle > 0.75 ||
          (input.length >= 3 && simTitle > 0.65 && wordMatch(input, track.cleanTitle))
        );
        if (match) {
          user.foundTitle = true;
          user.score += 1 + speedBonus;
          socket.emit('feedback', { type: 'success_title', msg: `Titre ! (+${1 + speedBonus} pts)`, val: displayString(track.title), cover });
          hit = true;
        } else if (simTitle > 0.50 && !hit) {
          socket.emit('feedback', { type: 'close', msg: 'Tu chauffes sur le titre !' });
          hit = true;
        }
      }

      if (!hit) socket.emit('feedback', { type: 'miss', msg: 'Pas du tout...' });

      io.to(`room:${roomId}`).emit('update_players', Object.values(room.players));

      const allFeatsFound = track.cleanFeatArtists.every((_, i) => user.foundFeats[i]);
      const allMainFound  = user.foundArtist && user.foundTitle && allFeatsFound;
      if (allMainFound && !user._fullFoundCounted) {
        user._fullFoundCounted = true;
        if (!room.game.firstFullFinder) room.game.firstFullFinder = user.name;
        room.game.totalFullFound++;
        socket.emit('reveal_cover', { cover: room.game.currentTrack.cover });
      }

      checkEveryoneFound(roomId, io);
    });

    socket.on('disconnect', () => {
      if (socket.currentRoom) leaveRoom(socket, socket.currentRoom, io);
    });
  });
}

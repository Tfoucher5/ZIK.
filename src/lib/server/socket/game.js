import { createRequire } from "module";
const require = createRequire(import.meta.url);
const stringSimilarity = require("string-similarity");
const yts = require("yt-search");

import { supabase } from "../config.js";
import { playlistCache, customRooms, dbRooms, roomGames } from "../state.js";
import {
  loadPlaylist,
  cleanString,
  displayString,
  buildTrack,
  calcSpeedBonus,
} from "../services/playlist.js";

const DEFAULT_ROUND_DURATION = 30;
const DEFAULT_BREAK_DURATION = 7;
const AUTO_START_DELAY = 5; // seconds

// ─── Auto-start countdowns ────────────────────────────────────────────────────
// Map: roomId -> { timer, startAt, seconds }
const autoStartCountdowns = {};

// ─── Chat ─────────────────────────────────────────────────────────────────────
// Map: roomId -> { messages: [], clearTimer: null }
const chatHistories = {};
const CHAT_MAX_MESSAGES = 50;
const CHAT_CLEAR_DELAY = 30 * 60 * 1000; // 30 min après room vide

function getChatHistory(roomId) {
  if (!chatHistories[roomId])
    chatHistories[roomId] = { messages: [], clearTimer: null };
  return chatHistories[roomId];
}
function scheduleChatClear(roomId) {
  const h = chatHistories[roomId];
  if (!h) return;
  clearTimeout(h.clearTimer);
  h.clearTimer = setTimeout(() => {
    delete chatHistories[roomId];
  }, CHAT_CLEAR_DELAY);
}
function cancelChatClear(roomId) {
  const h = chatHistories[roomId];
  if (h) clearTimeout(h.clearTimer);
}

// ─── Emit helpers ────────────────────────────────────────────────────────────

function sanitizePlayer(p) {
  return {
    name: p.name,
    userId: p.userId,
    isGuest: p.isGuest,
    score: p.score,
    foundArtist: p.foundArtist,
    foundTitle: p.foundTitle,
    foundFeats: p.foundFeats || [],
  };
}

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
    players: {},
    socketToName: {},
    nameToSocket: {},
    game: {
      isActive: false,
      currentRound: 0,
      maxRounds: cust?.max_rounds || cust?.maxRounds || 10,
      roundDuration:
        cust?.round_duration || cust?.roundDuration || DEFAULT_ROUND_DURATION,
      breakDuration:
        cust?.break_duration || cust?.breakDuration || DEFAULT_BREAK_DURATION,
      timer: 0,
      interval: null,
      breakTimer: null,
      currentTrack: null,
      startTime: 0,
      sessionPlaylist: [],
      history: [],
      firstFullFinder: null,
      totalFullFound: 0,
      lastRoundData: null,
      dbGameId: null,
      isSyncWaiting: false,
      readyPlayers: new Set(),
      readyTimer: null,
      readyRound: 0,
    },
  };
  return roomGames[roomId];
}

function cleanupRoom(roomId) {
  const room = roomGames[roomId];
  if (!room) return;
  clearInterval(room.game.interval);
  clearTimeout(room.game.breakTimer);
  clearTimeout(room.game.readyTimer);
  room.game.interval = null;
  room.game.breakTimer = null;
  room.game.readyTimer = null;
  delete roomGames[roomId];
  console.log(`Room "${roomId}" liberee de la memoire`);
}

function resetRoundFlags(room) {
  Object.keys(room.players).forEach((n) => {
    room.players[n].foundArtist = false;
    room.players[n].foundTitle = false;
    room.players[n].foundFeats = [];
    room.players[n].foundExtras = [];
    room.players[n]._fullFoundCounted = false;
  });
}

function resetScores(room, io) {
  Object.keys(room.players).forEach((n) => {
    room.players[n].score = 0;
  });
  io.to(`room:${room.roomId}`).emit(
    "update_players",
    Object.values(room.players).map(sanitizePlayer),
  );
}

function checkEveryoneFound(roomId, io) {
  const room = getOrCreateRoom(roomId);
  const track = room.game.currentTrack;
  const activePlayers = Object.values(room.players);
  const allDone = (p) => {
    const allFeats = (track?.cleanFeatArtists || []).every(
      (_, i) => p.foundFeats[i],
    );
    const allExtras = (track?.extraAnswers || []).every(
      (_, i) => p.foundExtras[i],
    );
    return p.foundArtist && p.foundTitle && allFeats && allExtras;
  };
  if (
    activePlayers.length > 0 &&
    activePlayers.every(allDone) &&
    room.game.isActive
  ) {
    endRound(roomId, "Tout le monde a trouve !", io);
  }
}

function endRound(roomId, reason, io) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;
  clearInterval(game.interval);
  game.isActive = false;

  const track = game.currentTrack;

  const summary = {
    answer: `${displayString(track.mainArtist || track.artist)} - ${displayString(track.title)}`,
    cover: track.cover,
    reason,
    firstFinder: game.firstFullFinder,
    totalFound: game.totalFullFound,
    featArtists: (track.featArtists || []).map(displayString),
    extraAnswers: (track.extraAnswers || []).map((e) => ({
      label: e.label,
      value: e.value,
    })),
  };
  game.history.push(summary);

  Object.keys(room.players).forEach((username) => {
    const p = room.players[username];
    const socketId = room.nameToSocket[username];
    if (socketId) {
      io.to(socketId).emit("round_end", {
        ...summary,
        foundArtist: p.foundArtist,
        foundTitle: p.foundTitle,
        foundFeats: p.foundFeats || [],
        foundExtras: p.foundExtras || [],
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
    io.to(`room:${roomId}`).emit("timer_update", {
      current: game.timer,
      max: game.roundDuration,
    });
    if (game.timer <= 0) endRound(roomId, "Temps ecoule !", io);
  }, 1000);
}

function triggerRoundStart(roomId, io) {
  const room = roomGames[roomId];
  if (!room || room.game.isActive || room.game.isPaused) return;
  clearTimeout(room.game.readyTimer);
  room.game.readyTimer = null;
  room.game.isSyncWaiting = false;
  room.game.isActive = true;
  room.game.startTime = Date.now();
  room.game.timer = room.game.roundDuration;
  io.to(`room:${roomId}`).emit("round_start_sync");
  startTimer(roomId, io);
}

async function startNextRound(roomId, io) {
  const room = getOrCreateRoom(roomId);
  const game = room.game;

  if (
    game.currentRound >= game.maxRounds ||
    game.sessionPlaylist.length === 0
  ) {
    game.isActive = false;
    const finalScores = Object.values(room.players)
      .sort((a, b) => b.score - a.score)
      .map(sanitizePlayer);
    io.to(`room:${roomId}`).emit("game_over", finalScores);
    await saveGameResults(roomId, finalScores);
    return;
  }

  game.currentRound++;
  game.firstFullFinder = null;
  game.totalFullFound = 0;
  resetRoundFlags(room);
  game.currentTrack = game.sessionPlaylist.pop();

  try {
    const r = await yts(
      `${game.currentTrack.mainArtist || game.currentTrack.artist} ${game.currentTrack.title} topic`,
    );
    if (!r.videos?.length) throw new Error("No video");

    const video = r.videos[0];
    const safeStart = Math.max(
      0,
      Math.floor(
        Math.random() * Math.max(1, video.seconds - game.roundDuration - 10),
      ),
    );

    game.lastRoundData = {
      videoId: video.videoId,
      startSeconds: safeStart,
      round: game.currentRound,
      total: game.maxRounds,
      featCount: game.currentTrack.featArtists.length,
      extraLabels: (game.currentTrack.extraAnswers || []).map((e) => e.label),
      previewUrl: null,
    };

    // Si l'admin a mis en pause pendant le fetch YTS, on abandonne
    if (game.isPaused) return;

    game.isSyncWaiting = true;
    game.readyPlayers = new Set();
    game.readyRound = game.currentRound;

    io.to(`room:${roomId}`).emit("start_round", game.lastRoundData);

    // Démarre le round dès que 75% des joueurs sont prêts, ou après 6s max
    const activePlayers = Object.values(room.players).filter(
      (p) => !p._dcTimer,
    ).length;
    game.readyThreshold = Math.max(1, Math.round(activePlayers * 0.75));
    game.readyTimer = setTimeout(() => triggerRoundStart(roomId, io), 6000);
  } catch (err) {
    console.error(`Skip "${game.currentTrack.title}":`, err.message);
    startNextRound(roomId, io);
  }
}

async function saveGameResults(roomId, finalScores) {
  const room = getOrCreateRoom(roomId);
  const dbGameId = room.game.dbGameId;
  if (!dbGameId) return;

  try {
    await supabase
      .from("games")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", dbGameId);

    const players = finalScores.map((p, i) => ({
      game_id: dbGameId,
      user_id: p.userId || null,
      username: p.name,
      score: p.score,
      rank: i + 1,
      is_guest: p.isGuest || !p.userId,
    }));
    await supabase.from("game_players").insert(players);

    const eloEligible = !!dbRooms[roomId]?.is_public && finalScores.length >= 3;
    const rankedPlayers = finalScores.map((p, i) => ({ ...p, rank: i + 1 }));
    const eloChanges = {};

    if (eloEligible) {
      const registeredIds = rankedPlayers
        .filter((p) => p.userId && !p.isGuest)
        .map((p) => p.userId);

      const { data: profiles } =
        registeredIds.length >= 2
          ? await supabase
              .from("profiles")
              .select("id, elo, games_played")
              .in("id", registeredIds)
          : { data: [] };

      const profileMap = {};
      profiles?.forEach((p) => {
        profileMap[p.id] = p;
      });

      for (const player of rankedPlayers) {
        if (!player.userId || player.isGuest) continue;
        const profile = profileMap[player.userId];
        if (!profile) continue;

        const k =
          profile.games_played < 30 ? 32 : profile.games_played < 100 ? 20 : 10;
        let change = 0;

        for (const opp of rankedPlayers) {
          if (opp.userId === player.userId) continue;
          const oppProfile =
            opp.userId && !opp.isGuest ? profileMap[opp.userId] : null;
          const oppElo = oppProfile?.elo ?? 1000;
          const expected = 1 / (1 + Math.pow(10, (oppElo - profile.elo) / 400));
          const actual = player.rank < opp.rank ? 1 : 0;
          change += k * (actual - expected);
        }

        eloChanges[player.userId] = Math.round(change);
      }
    }

    for (let i = 0; i < finalScores.length; i++) {
      const p = finalScores[i];
      if (p.userId && !p.isGuest) {
        await supabase.rpc("update_player_stats", {
          p_user_id: p.userId,
          p_score: p.score,
          p_rank: i + 1,
          p_total_players: finalScores.length,
          p_elo_change: eloChanges[p.userId] ?? 0,
        });
      }
    }
    console.log(`Game ${dbGameId} sauvegardee.`);
  } catch (err) {
    console.error("Erreur sauvegarde:", err.message, err.stack);
  }
}

/**
 * Returns true if the player's input should count as a match for the target.
 * Uses GLOBAL similarity only — no word decomposition (prevents single-word cheating).
 */
function checkMatch(input, target) {
  if (!input || !target) return false;
  const len = input.length;
  const tLen = target.length;

  // Exact match
  if (input === target) return true;

  // Substring containment: input is fully contained in target (or near-complete)
  // Only accept if input is at least 40% of target length to avoid false positives
  if (len >= 3 && target.includes(input) && len / tLen >= 0.4) return true;

  // Target contained in input (player typed extra words around the answer)
  if (tLen >= 3 && input.includes(target) && tLen / len >= 0.6) return true;

  // Global string similarity — no word decomposition
  const sim = stringSimilarity.compareTwoStrings(input, target);
  if (len <= 2) return sim >= 0.95; // Short inputs: very strict
  if (sim >= 0.72) return true; // Standard threshold
  if (len >= 6 && sim >= 0.65) return true; // Longer inputs: slightly looser (typos)

  return false;
}

function checkClose(input, target) {
  if (!input || !target || input.length < 2) return false;
  const sim = stringSimilarity.compareTwoStrings(input, target);
  if (sim >= 0.42) return true;
  // Also close if input is nearly a substring
  if (input.length >= 3 && target.length >= 3) {
    for (let i = 0; i <= target.length - input.length + 1; i++) {
      const chunk = target.slice(i, i + input.length);
      if (stringSimilarity.compareTwoStrings(input, chunk) >= 0.8) return true;
    }
  }
  return false;
}

// Legacy – kept for API compat
function wordMatch(input, target) {
  return false;
}

// ─── Auto-start helpers ───────────────────────────────────────────────────────

function cancelAutoCountdown(roomId, io) {
  if (autoStartCountdowns[roomId]) {
    clearTimeout(autoStartCountdowns[roomId].timer);
    delete autoStartCountdowns[roomId];
    if (io) io.to(`room:${roomId}`).emit("game_countdown_cancelled");
  }
}

async function startAutoCountdown(roomId, io) {
  if (autoStartCountdowns[roomId]) return; // already running
  const room = roomGames[roomId];
  if (room?.game?.adminBlocked) return;
  const startAt = Date.now();
  io.to(`room:${roomId}`).emit("game_countdown", { seconds: AUTO_START_DELAY });
  autoStartCountdowns[roomId] = {
    startAt,
    seconds: AUTO_START_DELAY,
    timer: setTimeout(async () => {
      delete autoStartCountdowns[roomId];
      const room = roomGames[roomId];
      if (!room || room.game.isActive || room.game.isSyncWaiting) return;

      const playlist = await loadPlaylist(roomId);
      if (playlist.length === 0) {
        io.to(`room:${roomId}`).emit(
          "server_error",
          "Playlist indisponible, reessaie.",
        );
        return;
      }
      room.game.history = [];
      room.game.currentRound = 0;
      room.game.sessionPlaylist = [...playlist]
        .sort(() => Math.random() - 0.5)
        .slice(0, room.game.maxRounds);
      resetScores(room, io);
      io.to(`room:${roomId}`).emit("init_history", []);
      io.to(`room:${roomId}`).emit("game_starting");
      try {
        const { data } = await supabase
          .from("games")
          .insert({
            room_id: roomId,
            rounds: room.game.maxRounds,
          })
          .select()
          .single();
        if (data) room.game.dbGameId = data.id;
      } catch {
        /* non-blocking */
      }
      startNextRound(roomId, io);
    }, AUTO_START_DELAY * 1000),
  };
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
        const active = Object.values(room.players)
          .filter((p) => !p._dcTimer)
          .map(sanitizePlayer);
        io.to(`room:${roomId}`).emit("update_players", active);

        if (active.length === 0) {
          cancelAutoCountdown(roomId, null); // cancel silently — no players to notify
          scheduleChatClear(roomId);
          if (room.game.isActive) {
            clearInterval(room.game.interval);
            clearTimeout(room.game.breakTimer);
            room.game.interval = null;
            room.game.breakTimer = null;
            room.game.isActive = false;
            console.log(`Room "${roomId}" vide — partie stoppee`);
          }
          if (customRooms[roomId]) {
            room._emptyTimer = setTimeout(
              () => cleanupRoom(roomId),
              15 * 60 * 1000,
            );
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
  globalThis.__zik_io = io;
  io.on("connection", (socket) => {
    socket.on("join_room", async ({ roomId, username, userId, isGuest }) => {
      if (!username?.trim()) return socket.emit("error", "Pseudo requis");

      // Fetch from DB if not cached, or if cache is stale (missing auto_start/owner_id fields added later)
      if (
        !customRooms[roomId] &&
        (!dbRooms[roomId] ||
          dbRooms[roomId].owner_id === undefined ||
          dbRooms[roomId].id === undefined)
      ) {
        const { data: freshRoom } = await supabase
          .from("rooms")
          .select(
            "id, code, name, emoji, max_rounds, round_duration, break_duration, playlist_id, auto_start, owner_id, is_public",
          )
          .eq("code", roomId)
          .single();
        if (freshRoom) {
          dbRooms[roomId] = { ...dbRooms[roomId], ...freshRoom };
        } else if (!dbRooms[roomId]) {
          return socket.emit("error", "Room inconnue ou expiree");
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
          name: username,
          userId: userId || null,
          isGuest: isGuest !== false,
          score: 0,
          foundArtist: false,
          foundTitle: false,
          foundFeats: [],
          foundExtras: [],
          _fullFoundCounted: false,
        };
      } else {
        clearTimeout(room.players[username]._dcTimer);
        delete room.players[username]._dcTimer;
        const oldSocketId = room.nameToSocket[username];
        if (oldSocketId) delete room.socketToName[oldSocketId];
      }

      room.socketToName[socket.id] = username;
      room.nameToSocket[username] = socket.id;

      io.to(`room:${roomId}`).emit(
        "update_players",
        Object.values(room.players).map(sanitizePlayer),
      );

      if (!playlistCache[roomId] && dbRooms[roomId]) {
        loadPlaylist(roomId)
          .then((tracks) => {
            if (tracks.length > 0)
              socket.emit("track_count_update", tracks.length);
          })
          .catch(() => {});
      }

      const cust = customRooms[roomId] || dbRooms[roomId];
      const dbRoom = dbRooms[roomId];
      const autoStart = dbRoom?.auto_start || false;
      const ownerId = dbRoom?.owner_id || null;
      const isAdmin = !!(
        userId &&
        ownerId &&
        String(userId).trim().toLowerCase() ===
          String(ownerId).trim().toLowerCase()
      );

      socket.emit("room_joined", {
        roomId,
        roomConfig: {
          id: roomId,
          name: cust?.name,
          emoji: cust?.emoji,
          trackCount:
            customRooms[roomId]?.tracks?.length ||
            playlistCache[roomId]?.length ||
            null,
          maxRounds: cust?.max_rounds || cust?.maxRounds,
          autoStart,
          isAdmin,
          hasOwner: !!ownerId,
          adminBlocked: room.game.adminBlocked ?? false,
        },
      });
      socket.emit("init_history", room.game.history);

      cancelChatClear(roomId);
      const existingChat = chatHistories[roomId];
      if (existingChat?.messages.length)
        socket.emit("chat_history", existingChat.messages);

      if (
        room.game.lastRoundData &&
        (room.game.isActive || room.game.isSyncWaiting)
      ) {
        socket.emit("start_round", room.game.lastRoundData);
        if (room.game.isActive && !room.game.isPaused) {
          // Round déjà synchro — le nouveau joueur peut jouer immédiatement
          socket.emit("round_start_sync");
        }
        // Si isSyncWaiting, le client émettra player_ready quand YouTube sera prêt
      } else if (autoStart && !room.game.isActive && !room.game.isSyncWaiting) {
        if (autoStartCountdowns[roomId]) {
          // Countdown already running — tell this player the remaining time
          const elapsed =
            (Date.now() - autoStartCountdowns[roomId].startAt) / 1000;
          const remaining = Math.max(
            1,
            Math.ceil(autoStartCountdowns[roomId].seconds - elapsed),
          );
          socket.emit("game_countdown", { seconds: remaining });
        } else {
          startAutoCountdown(roomId, io);
        }
      }

      console.log(`${username} -> room "${roomId}"`);
    });

    socket.on("request_new_game", async () => {
      const roomId = socket.currentRoom;
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      if (room.game.isActive || room.game.isSyncWaiting) return;
      if (room.game.adminBlocked) {
        socket.emit("server_error", "Partie bloquée par un administrateur.");
        return;
      }

      // Manual-mode DB rooms: only the owner can start
      const dbRoom = dbRooms[roomId];
      if (dbRoom && !dbRoom.auto_start) {
        const name = room.socketToName[socket.id];
        const player = room.players[name];
        const pId = String(player?.userId || "")
          .trim()
          .toLowerCase();
        const oId = String(dbRoom.owner_id || "")
          .trim()
          .toLowerCase();
        if (!pId || !oId || pId !== oId) {
          return socket.emit(
            "server_error",
            "Seul l\u2019administrateur peut lancer la partie.",
          );
        }
      }

      // Cancel any running auto-start countdown
      cancelAutoCountdown(roomId, io);

      const playlist = await loadPlaylist(roomId);
      if (playlist.length === 0)
        return socket.emit("server_error", "Playlist indisponible, reessaie.");

      room.game.history = [];
      room.game.currentRound = 0;
      room.game.sessionPlaylist = [...playlist]
        .sort(() => Math.random() - 0.5)
        .slice(0, room.game.maxRounds);

      resetScores(room, io);
      io.to(`room:${roomId}`).emit("init_history", []);
      io.to(`room:${roomId}`).emit("game_starting");

      try {
        const { data } = await supabase
          .from("games")
          .insert({
            room_id: roomId,
            rounds: room.game.maxRounds,
          })
          .select()
          .single();
        if (data) room.game.dbGameId = data.id;
      } catch {
        /* non-blocking */
      }

      startNextRound(roomId, io);
    });

    socket.on("submit_guess", async (guess) => {
      const roomId = socket.currentRoom;
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      const name = room.socketToName[socket.id];

      if (!room.game.isActive || !room.game.currentTrack || !room.players[name])
        return;
      if (!guess?.trim()) return;

      const user = room.players[name];
      const input = cleanString(guess);
      const timeTaken = (Date.now() - room.game.startTime) / 1000;
      const speedBonus = calcSpeedBonus(timeTaken);
      const track = room.game.currentTrack;
      const cover = track.cover || "";

      let hit = false;

      if (!user.foundArtist) {
        if (checkMatch(input, track.cleanArtist)) {
          user.foundArtist = true;
          user.score += 1 + speedBonus;
          socket.emit("feedback", {
            type: "success_artist",
            msg: `Artiste ! (+${1 + speedBonus} pts)`,
            val: displayString(track.mainArtist || track.artist),
            cover,
          });
          hit = true;
        } else if (!hit && checkClose(input, track.cleanArtist)) {
          socket.emit("feedback", {
            type: "close",
            msg: "Tu chauffes sur l'artiste !",
          });
          hit = true;
        }
      }

      for (let fi = 0; fi < track.cleanFeatArtists.length; fi++) {
        if (user.foundFeats[fi]) continue;
        const cleanFeat = track.cleanFeatArtists[fi];
        if (checkMatch(input, cleanFeat)) {
          user.foundFeats[fi] = true;
          user.score += 1 + speedBonus;
          socket.emit("feedback", {
            type: "success_feat",
            featIndex: fi,
            msg: `Feat ! (+${1 + speedBonus} pts)`,
            val: displayString(track.featArtists[fi]),
            cover,
          });
          hit = true;
          break;
        } else if (!hit && checkClose(input, cleanFeat)) {
          socket.emit("feedback", {
            type: "close",
            msg: "Tu chauffes sur le feat !",
          });
          hit = true;
        }
      }

      if (!user.foundTitle) {
        if (checkMatch(input, track.cleanTitle)) {
          user.foundTitle = true;
          user.score += 1 + speedBonus;
          socket.emit("feedback", {
            type: "success_title",
            msg: `Titre ! (+${1 + speedBonus} pts)`,
            val: displayString(track.title),
            cover,
          });
          hit = true;
        } else if (!hit && checkClose(input, track.cleanTitle)) {
          socket.emit("feedback", {
            type: "close",
            msg: "Tu chauffes sur le titre !",
          });
          hit = true;
        }
      }

      if (!hit) {
        for (let ei = 0; ei < (track.extraAnswers || []).length; ei++) {
          if (user.foundExtras[ei]) continue;
          const extra = track.extraAnswers[ei];
          if (checkMatch(input, extra.clean)) {
            user.foundExtras[ei] = true;
            user.score += 1 + speedBonus;
            socket.emit("feedback", {
              type: "success_extra",
              extraIndex: ei,
              msg: `${extra.label} ! (+${1 + speedBonus} pts)`,
              val: extra.value,
              cover,
            });
            hit = true;
            break;
          } else if (checkClose(input, extra.clean)) {
            socket.emit("feedback", {
              type: "close",
              msg: `Tu chauffes sur ${extra.label} !`,
            });
            hit = true;
            break;
          }
        }
      }

      if (!hit)
        socket.emit("feedback", { type: "miss", msg: "Pas du tout..." });

      io.to(`room:${roomId}`).emit(
        "update_players",
        Object.values(room.players).map(sanitizePlayer),
      );

      const allMainFound =
        user.foundArtist &&
        user.foundTitle &&
        track.cleanFeatArtists.every((_, i) => user.foundFeats[i]) &&
        (track.extraAnswers || []).every((_, i) => user.foundExtras[i]);
      if (allMainFound && !user._fullFoundCounted) {
        user._fullFoundCounted = true;
        if (!room.game.firstFullFinder) room.game.firstFullFinder = user.name;
        room.game.totalFullFound++;
        socket.emit("reveal_cover", { cover: room.game.currentTrack.cover });
      }

      checkEveryoneFound(roomId, io);
    });

    socket.on("send_chat", (msg) => {
      const roomId = socket.currentRoom;
      if (!roomId) return;
      const room = roomGames[roomId];
      if (!room) return;
      const name = room.socketToName[socket.id];
      if (!name) return;

      const text = String(msg || "")
        .trim()
        .slice(0, 120);
      if (!text) return;

      // Rate limit : 1 message / 1.5s par joueur
      const now = Date.now();
      if (
        room.players[name]?._lastChat &&
        now - room.players[name]._lastChat < 1500
      )
        return;
      if (room.players[name]) room.players[name]._lastChat = now;

      const message = { name, text, ts: now };
      const history = getChatHistory(roomId);
      history.messages.push(message);
      if (history.messages.length > CHAT_MAX_MESSAGES) history.messages.shift();

      io.to(`room:${roomId}`).emit("chat_message", message);
    });

    socket.on("player_ready", () => {
      const roomId = socket.currentRoom;
      if (!roomId) return;
      const room = roomGames[roomId];
      if (!room || !room.game.isSyncWaiting) return;

      const name = room.socketToName[socket.id];
      if (!name) return;

      room.game.readyPlayers.add(name);

      const activePlayers = Object.values(room.players).filter(
        (p) => !p._dcTimer,
      ).length;
      const threshold = Math.max(1, Math.round(activePlayers * 0.75));

      io.to(`room:${roomId}`).emit("ready_update", {
        ready: room.game.readyPlayers.size,
        total: activePlayers,
      });

      if (room.game.readyPlayers.size >= threshold) {
        triggerRoundStart(roomId, io);
      }
    });

    socket.on("disconnect", () => {
      if (socket.currentRoom) leaveRoom(socket, socket.currentRoom, io);
    });
  });
}

// ─── Admin control ────────────────────────────────────────────────────────────

export function adminGetRoomsSnapshot() {
  return Object.values(roomGames).map((room) => ({
    roomId: room.roomId,
    playerCount: Object.keys(room.players).length,
    players: Object.values(room.players).map((p) => ({
      name: p.name,
      score: p.score,
      foundArtist: p.foundArtist,
      foundTitle: p.foundTitle,
    })),
    isActive: room.game.isActive,
    isPaused: room.game.isPaused ?? false,
    adminBlocked: room.game.adminBlocked ?? false,
    currentRound: room.game.currentRound,
    maxRounds: room.game.maxRounds,
    timer: room.game.timer,
    roundDuration: room.game.roundDuration,
    isSyncWaiting: room.game.isSyncWaiting,
    readyCount: room.game.readyPlayers?.size ?? 0,
    currentTrack: room.game.currentTrack
      ? {
          artist:
            room.game.currentTrack.mainArtist || room.game.currentTrack.artist,
          title: room.game.currentTrack.title,
        }
      : null,
  }));
}

export function adminPauseRoom(roomId) {
  const room = roomGames[roomId];
  if (!room || room.game.isPaused) return false;
  const io = globalThis.__zik_io;
  // Sauvegarder l'état avant pause
  if (room.game.interval) {
    room.game._pausedState = "round";
    clearInterval(room.game.interval);
    room.game.interval = null;
  } else if (room.game.breakTimer) {
    room.game._pausedState = "break";
    clearTimeout(room.game.breakTimer);
    room.game.breakTimer = null;
  } else {
    room.game._pausedState = "none";
  }
  // Annuler readyTimer + auto-countdown
  if (room.game.readyTimer) {
    clearTimeout(room.game.readyTimer);
    room.game.readyTimer = null;
    room.game.isSyncWaiting = false;
  }
  cancelAutoCountdown(roomId, io);
  room.game.isPaused = true;
  io?.to(`room:${roomId}`).emit("admin_pause");
  return true;
}

export function adminResumeRoom(roomId) {
  const room = roomGames[roomId];
  if (!room || !room.game.isPaused) return false;
  const io = globalThis.__zik_io;
  room.game.isPaused = false;
  const state = room.game._pausedState ?? "none";
  room.game._pausedState = null;

  if (state === "round") {
    room.game.interval = setInterval(() => {
      room.game.timer--;
      io?.to(`room:${roomId}`).emit("timer_update", {
        current: room.game.timer,
        max: room.game.roundDuration,
      });
      if (room.game.timer <= 0) endRound(roomId, "Temps écoulé !", io);
    }, 1000);
  } else if (state === "break") {
    room.game.breakTimer = setTimeout(() => {
      room.game.breakTimer = null;
      startNextRound(roomId, io);
    }, 1000);
  }
  io?.to(`room:${roomId}`).emit("admin_resume");
  return true;
}

export function adminSkipRound(roomId) {
  const room = roomGames[roomId];
  if (!room || !room.game.isActive) return false;
  const io = globalThis.__zik_io;
  endRound(roomId, "Round sauté par l'admin", io);
  return true;
}

export function adminEndGame(roomId) {
  const room = roomGames[roomId];
  if (!room) return false;
  const io = globalThis.__zik_io;
  clearInterval(room.game.interval);
  clearTimeout(room.game.breakTimer);
  room.game.interval = null;
  room.game.breakTimer = null;
  room.game.isActive = false;
  const finalScores = Object.values(room.players)
    .sort((a, b) => b.score - a.score)
    .map(sanitizePlayer);
  io?.to(`room:${roomId}`).emit("game_over", finalScores);
  return true;
}

export function adminBlockRoom(roomId) {
  const room = roomGames[roomId];
  if (!room) return false;
  const io = globalThis.__zik_io;
  room.game.adminBlocked = true;
  cancelAutoCountdown(roomId, io);
  io?.to(`room:${roomId}`).emit("admin_blocked");
  return true;
}

export function adminUnblockRoom(roomId) {
  const room = roomGames[roomId];
  if (!room) return false;
  room.game.adminBlocked = false;
  globalThis.__zik_io?.to(`room:${roomId}`).emit("admin_unblocked");
  return true;
}

export function adminKickPlayer(roomId, username) {
  const room = roomGames[roomId];
  if (!room || !room.players[username]) return false;
  const io = globalThis.__zik_io;
  const socketId = room.nameToSocket[username];
  if (socketId)
    io
      ?.to(socketId)
      .emit("admin_kicked", { reason: "Expulsé par un administrateur" });
  delete room.players[username];
  delete room.nameToSocket[username];
  for (const sid of Object.keys(room.socketToName)) {
    if (room.socketToName[sid] === username) delete room.socketToName[sid];
  }
  io
    ?.to(`room:${roomId}`)
    .emit("update_players", Object.values(room.players).map(sanitizePlayer));
  return true;
}

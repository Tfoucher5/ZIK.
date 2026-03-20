import { createRequire } from "module";
const require = createRequire(import.meta.url);
const stringSimilarity = require("string-similarity");
const yts = require("yt-search");

import { supabase } from "../config.js";
import { salonRooms } from "../state.js";
import {
  buildTrack,
  calcSpeedBonus,
  cleanString,
  displayString,
} from "../services/playlist.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const SALON_CLEANUP_DELAY = 30 * 60 * 1000; // 30 min
const HOST_RECONNECT_GRACE = 60 * 1000; // 60 s

// ─── Code generation ──────────────────────────────────────────────────────────

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  } while (salonRooms[code]);
  return code;
}

// ─── Playlist loading ─────────────────────────────────────────────────────────

async function loadSalonTracks(playlistId) {
  try {
    const { data: rows } = await supabase
      .from("custom_playlist_tracks")
      .select("artist, title, cover_url, preview_url")
      .eq("playlist_id", playlistId)
      .order("position");
    if (rows?.length >= 3) {
      return rows.map((t) =>
        buildTrack({
          artist: t.artist,
          title: t.title,
          cover: t.cover_url,
          preview_url: t.preview_url,
        }),
      );
    }
  } catch {}
  // Fallback: try official room playlist
  try {
    const { data: roomRows } = await supabase
      .from("rooms")
      .select("code")
      .eq("playlist_id", playlistId)
      .single();
    if (roomRows?.code) {
      const { data: trackRows } = await supabase
        .from("custom_playlist_tracks")
        .select("artist, title, cover_url, preview_url")
        .eq("playlist_id", playlistId)
        .order("position");
      if (trackRows?.length >= 3) {
        return trackRows.map((t) =>
          buildTrack({
            artist: t.artist,
            title: t.title,
            cover: t.cover_url,
            preview_url: t.preview_url,
          }),
        );
      }
    }
  } catch {}
  return [];
}

// ─── Multiple choice helpers ──────────────────────────────────────────────────

function makeChoices(correct, allTracks) {
  const label = (t) =>
    `${displayString(t.mainArtist || t.artist)} — ${displayString(t.title)}`;
  const correctLabel = label(correct);
  const pool = allTracks.filter((t) => label(t) !== correctLabel);
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [correctLabel, ...shuffled.map(label)].sort(
    () => Math.random() - 0.5,
  );
  return {
    choices,
    correctChoiceIndex: choices.indexOf(correctLabel),
  };
}

// ─── Answer checking (free text) ─────────────────────────────────────────────

function checkMatch(input, target) {
  if (!input || !target) return false;
  const len = input.length;
  const tLen = target.length;
  if (input === target) return true;
  if (len >= 3 && target.includes(input) && len / tLen >= 0.4) return true;
  if (tLen >= 3 && input.includes(target) && tLen / len >= 0.6) return true;
  const sim = stringSimilarity.compareTwoStrings(input, target);
  if (len <= 2) return sim >= 0.95;
  if (sim >= 0.72) return true;
  if (len >= 6 && sim >= 0.65) return true;
  return false;
}

// ─── Room cleanup ─────────────────────────────────────────────────────────────

function scheduleCleanup(code) {
  const salon = salonRooms[code];
  if (!salon) return;
  clearTimeout(salon._cleanupTimer);
  salon._cleanupTimer = setTimeout(() => {
    const s = salonRooms[code];
    if (s) {
      clearInterval(s.game.interval);
      clearTimeout(s.game.breakTimer);
    }
    delete salonRooms[code];
    console.log(`Salon "${code}" libere de la memoire`);
  }, SALON_CLEANUP_DELAY);
}

function cleanupNow(code, io) {
  const salon = salonRooms[code];
  if (!salon) return;
  clearTimeout(salon._cleanupTimer);
  clearInterval(salon.game.interval);
  clearTimeout(salon.game.breakTimer);
  if (io) {
    io.to(`salon:${code}`).emit("salon_error", {
      message: "L'hôte a quitté le salon.",
    });
  }
  delete salonRooms[code];
  console.log(`Salon "${code}" ferme (hote deconnecte)`);
}

// ─── Player helpers ───────────────────────────────────────────────────────────

function getPlayerList(salon) {
  return Object.values(salon.players).map((p) => ({
    username: p.username,
    score: p.score,
    foundThisRound: p.foundThisRound,
    answeredThisRound: p.answeredThisRound,
  }));
}

function resetRoundFlags(salon) {
  for (const p of Object.values(salon.players)) {
    p.foundThisRound = false;
    p.answeredThisRound = false;
  }
}

// ─── Game loop ────────────────────────────────────────────────────────────────

function endRound(code, reason, io) {
  const salon = salonRooms[code];
  if (!salon) return;
  const game = salon.game;

  clearInterval(game.interval);
  game.interval = null;
  game.phase = "summary";

  const track = game.currentTrack;
  const answer = `${displayString(track.mainArtist || track.artist)} — ${displayString(track.title)}`;
  const scores = Object.values(salon.players)
    .map((p) => ({ username: p.username, score: p.score }))
    .sort((a, b) => b.score - a.score);

  const roundSummary = {
    answer,
    cover: track.cover,
    reason,
    firstFinder: game.firstFinder,
    scores,
  };

  game.history.push({ answer, cover: track.cover });
  io.to(`salon:${code}`).emit("salon_round_end", roundSummary);
  scheduleCleanup(code);

  if (!salon.settings.manualNext) {
    game.breakTimer = setTimeout(() => {
      game.breakTimer = null;
      startNextRound(code, io);
    }, salon.settings.showAnswerDuration * 1000);
  }
  // If manualNext, host must emit salon_next_round
}

async function startNextRound(code, io) {
  const salon = salonRooms[code];
  if (!salon) return;
  const game = salon.game;

  if (
    game.currentRound >= salon.settings.maxRounds ||
    game.sessionPlaylist.length === 0
  ) {
    game.phase = "gameover";
    const finalScores = Object.values(salon.players)
      .map((p) => ({ username: p.username, score: p.score }))
      .sort((a, b) => b.score - a.score);
    io.to(`salon:${code}`).emit("salon_game_over", { scores: finalScores });
    scheduleCleanup(code);
    return;
  }

  game.currentRound++;
  game.firstFinder = null;
  resetRoundFlags(salon);
  game.currentTrack = game.sessionPlaylist.pop();
  game.choices = null;
  game.correctChoiceIndex = null;

  const track = game.currentTrack;

  try {
    const r = await yts(
      `${track.mainArtist || track.artist} ${track.title} topic`,
    );
    if (!r.videos?.length) throw new Error("No video");

    const video = r.videos[0];
    const duration = salon.settings.roundDuration;
    const safeStart = Math.max(
      0,
      Math.floor(Math.random() * Math.max(1, video.seconds - duration - 10)),
    );

    game.phase = "round";
    game.timerValue = duration;
    game.startTime = Date.now();

    let choices = undefined;
    if (salon.settings.answerMode === "multiple") {
      const { choices: c, correctChoiceIndex: idx } = makeChoices(
        track,
        game.fullPlaylist,
      );
      game.choices = c;
      game.correctChoiceIndex = idx;
      choices = c; // send to all (correct index NOT included)
    }

    const roundData = {
      videoId: video.videoId,
      startSeconds: safeStart,
      round: game.currentRound,
      total: salon.settings.maxRounds,
      choices,
    };

    // Send to host (includes answer info for prompter display)
    if (salon.hostSocketId) {
      io.to(salon.hostSocketId).emit("salon_round_start", {
        ...roundData,
        hostInfo: {
          artist: displayString(track.mainArtist || track.artist),
          title: displayString(track.title),
          cover: track.cover,
          correctChoiceIndex: game.correctChoiceIndex,
        },
      });
    }
    // Send to players (no answer info)
    io.to(`salon:players:${code}`).emit("salon_round_start", roundData);

    // Timer
    game.interval = setInterval(() => {
      game.timerValue--;
      io.to(`salon:${code}`).emit("salon_timer_update", {
        current: game.timerValue,
        max: duration,
      });
      if (game.timerValue <= 0) {
        endRound(code, "Temps écoulé !", io);
      }
    }, 1000);
  } catch (err) {
    console.error(`Salon skip "${track.title}":`, err.message);
    startNextRound(code, io);
  }
}

// ─── Public API for HTTP-based salon creation ─────────────────────────────────

export async function createSalonRoom({ playlistId, settings }) {
  const tracks = await loadSalonTracks(playlistId);
  if (tracks.length < 3) {
    throw new Error(
      "Playlist introuvable ou trop courte (min. 3 titres).",
    );
  }

  const code = generateCode();
  const s = {
    maxRounds: Math.min(Math.max(settings.maxRounds || 10, 5), 20),
    roundDuration: Math.min(Math.max(settings.roundDuration || 30, 15), 60),
    manualNext: settings.manualNext === true,
    answerMode: settings.answerMode === "multiple" ? "multiple" : "free",
    showAnswerDuration: Math.min(
      Math.max(settings.showAnswerDuration || 7, 3),
      15,
    ),
  };

  salonRooms[code] = {
    code,
    hostSocketId: null,
    _hostDcTimer: null,
    _cleanupTimer: null,
    settings: { ...s, playlistId },
    players: {},
    game: {
      phase: "lobby",
      currentRound: 0,
      sessionPlaylist: [],
      fullPlaylist: tracks,
      currentTrack: null,
      choices: null,
      correctChoiceIndex: null,
      interval: null,
      breakTimer: null,
      timerValue: 0,
      startTime: 0,
      firstFinder: null,
      history: [],
    },
  };

  scheduleCleanup(code);
  console.log(`Salon "${code}" cree`);
  return code;
}

// ─── Socket registration ──────────────────────────────────────────────────────

export function registerSalon(io) {
  io.on("connection", (socket) => {
    // ── Host connects to their salon ──────────────────────────────────────────
    socket.on("salon_join_host", ({ code }) => {
      const salon = salonRooms[code];
      if (!salon) return socket.emit("salon_error", { message: "Salon introuvable." });

      // Clear host disconnect grace timer
      clearTimeout(salon._hostDcTimer);
      salon._hostDcTimer = null;
      salon.hostSocketId = socket.id;

      socket.join(`salon:${code}`);
      socket.join(`salon:host:${code}`);
      socket.salonCode = code;
      socket.salonRole = "host";

      socket.emit("salon_host_joined", {
        settings: salon.settings,
        players: getPlayerList(salon),
        phase: salon.game.phase,
        currentRound: salon.game.currentRound,
      });
      scheduleCleanup(code);
    });

    // ── Player joins ──────────────────────────────────────────────────────────
    socket.on("salon_join_player", ({ code, username }) => {
      username = username?.trim();
      if (!username) return socket.emit("salon_error", { message: "Pseudo requis." });

      const salon = salonRooms[code];
      if (!salon) return socket.emit("salon_error", { message: "Salon introuvable ou expiré." });
      if (salon.game.phase !== "lobby") {
        return socket.emit("salon_error", { message: "La partie a déjà commencé." });
      }
      if (salon.players[username]) {
        return socket.emit("salon_error", { message: "Ce pseudo est déjà pris." });
      }

      salon.players[username] = {
        username,
        socketId: socket.id,
        score: 0,
        foundThisRound: false,
        answeredThisRound: false,
      };

      socket.join(`salon:${code}`);
      socket.join(`salon:players:${code}`);
      socket.salonCode = code;
      socket.salonRole = "player";
      socket.salonUsername = username;

      const players = getPlayerList(salon);
      socket.emit("salon_joined", {
        username,
        settings: {
          answerMode: salon.settings.answerMode,
          maxRounds: salon.settings.maxRounds,
        },
      });
      // Notify host
      if (salon.hostSocketId) {
        io.to(salon.hostSocketId).emit("salon_player_joined", { players });
      }
      scheduleCleanup(code);
    });

    // ── Host starts the game ──────────────────────────────────────────────────
    socket.on("salon_start", () => {
      const code = socket.salonCode;
      const salon = salonRooms[code];
      if (!salon) return;
      if (socket.id !== salon.hostSocketId) return;
      if (salon.game.phase !== "lobby") return;

      const tracks = [...salon.game.fullPlaylist]
        .sort(() => Math.random() - 0.5)
        .slice(0, salon.settings.maxRounds);
      salon.game.sessionPlaylist = tracks;
      salon.game.currentRound = 0;

      // Reset scores
      for (const p of Object.values(salon.players)) p.score = 0;

      io.to(`salon:${code}`).emit("salon_game_starting");
      startNextRound(code, io);
    });

    // ── Host triggers next round (manual mode) ────────────────────────────────
    socket.on("salon_next_round", () => {
      const code = socket.salonCode;
      const salon = salonRooms[code];
      if (!salon) return;
      if (socket.id !== salon.hostSocketId) return;
      if (salon.game.phase !== "summary") return;

      clearTimeout(salon.game.breakTimer);
      salon.game.breakTimer = null;
      startNextRound(code, io);
    });

    // ── Player submits free text answer ──────────────────────────────────────
    socket.on("salon_submit_guess", ({ guess }) => {
      const code = socket.salonCode;
      const username = socket.salonUsername;
      const salon = salonRooms[code];
      if (!salon || salon.game.phase !== "round") return;

      const player = salon.players[username];
      if (!player || player.foundThisRound) return;

      const track = salon.game.currentTrack;
      const input = cleanString(guess?.slice(0, 100) || "");
      if (!input) return;

      const timeTaken = (Date.now() - salon.game.startTime) / 1000;
      const bonus = calcSpeedBonus(timeTaken);

      const matchTitle = checkMatch(input, track.cleanTitle);
      const matchArtist = checkMatch(input, track.cleanArtist);

      if (matchTitle || matchArtist) {
        const points = 1 + bonus;
        player.score += points;
        player.foundThisRound = true;

        if (!salon.game.firstFinder) salon.game.firstFinder = username;

        socket.emit("salon_feedback", { correct: true, points });
        if (salon.hostSocketId) {
          io.to(salon.hostSocketId).emit("salon_player_answered", {
            username,
            correct: true,
          });
        }

        // Update scores on all devices
        const scores = Object.values(salon.players)
          .map((p) => ({ username: p.username, score: p.score }))
          .sort((a, b) => b.score - a.score);
        io.to(`salon:${code}`).emit("salon_scores_update", { scores });

        // Check if everyone found
        const allFound = Object.values(salon.players).every(
          (p) => p.foundThisRound,
        );
        if (allFound && salon.game.phase === "round") {
          endRound(code, "Tout le monde a trouvé !", io);
        }
      } else {
        socket.emit("salon_feedback", { correct: false, points: 0 });
      }
    });

    // ── Player submits multiple choice ────────────────────────────────────────
    socket.on("salon_submit_choice", ({ choiceIndex }) => {
      const code = socket.salonCode;
      const username = socket.salonUsername;
      const salon = salonRooms[code];
      if (!salon || salon.game.phase !== "round") return;

      const player = salon.players[username];
      if (!player || player.answeredThisRound) return;

      const game = salon.game;
      player.answeredThisRound = true;

      const timeTaken = (Date.now() - game.startTime) / 1000;
      const bonus = calcSpeedBonus(timeTaken);
      const correct = choiceIndex === game.correctChoiceIndex;

      if (correct) {
        const points = 1 + bonus;
        player.score += points;
        player.foundThisRound = true;
        if (!game.firstFinder) game.firstFinder = username;

        socket.emit("salon_feedback", { correct: true, points });
      } else {
        socket.emit("salon_feedback", { correct: false, points: 0 });
      }

      if (salon.hostSocketId) {
        io.to(salon.hostSocketId).emit("salon_player_answered", {
          username,
          correct,
        });
      }

      const scores = Object.values(salon.players)
        .map((p) => ({ username: p.username, score: p.score }))
        .sort((a, b) => b.score - a.score);
      io.to(`salon:${code}`).emit("salon_scores_update", { scores });

      // Check if everyone answered
      const allAnswered = Object.values(salon.players).every(
        (p) => p.answeredThisRound,
      );
      if (allAnswered && game.phase === "round") {
        endRound(code, "Tout le monde a répondu !", io);
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const code = socket.salonCode;
      if (!code) return;
      const salon = salonRooms[code];
      if (!salon) return;

      if (socket.salonRole === "host") {
        // Grace period before cleanup
        salon._hostDcTimer = setTimeout(() => {
          cleanupNow(code, io);
        }, HOST_RECONNECT_GRACE);
      } else if (socket.salonRole === "player") {
        const username = socket.salonUsername;
        if (username && salon.players[username]) {
          delete salon.players[username];
          const players = getPlayerList(salon);
          if (salon.hostSocketId) {
            io.to(salon.hostSocketId).emit("salon_player_left", {
              username,
              players,
            });
          }
        }
      }
    });
  });
}

'use strict';

// Shared mutable state — single source of truth for runtime data.
// All modules that need to read/write game or room state import from here.

const playlistCache = {};  // roomId -> tracks[]
const customRooms   = {};  // code -> { id, name, emoji, tracks, maxRounds, roundDuration, breakDuration }
const dbRooms       = {};  // code -> { name, emoji, max_rounds, round_duration, break_duration, playlist_id }
const roomGames     = {};  // roomId -> { roomId, players, socketToName, nameToSocket, game }

module.exports = { playlistCache, customRooms, dbRooms, roomGames };

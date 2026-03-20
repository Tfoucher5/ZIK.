// Single source of truth for all shared runtime state.
// Modules import from here; no circular deps since this file imports nothing.

export const playlistCache = {}; // roomId -> Track[]
export const customRooms = {}; // code   -> { id, name, emoji, tracks, ... }
export const dbRooms = {}; // code   -> { name, emoji, max_rounds, ... }
export const roomGames = {}; // roomId -> { roomId, players, socketToName, ... }
export const salonRooms = {}; // code   -> { code, hostSocketId, settings, players, game }

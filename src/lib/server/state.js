// Single source of truth for all shared runtime state.
// All objects are anchored on globalThis so they survive Vite HMR module reloads in dev.

globalThis.__zik_playlistCache  = globalThis.__zik_playlistCache  ?? {};
globalThis.__zik_customRooms    = globalThis.__zik_customRooms    ?? {};
globalThis.__zik_dbRooms        = globalThis.__zik_dbRooms        ?? {};
globalThis.__zik_roomGames      = globalThis.__zik_roomGames      ?? {};
globalThis.__zik_salonRooms     = globalThis.__zik_salonRooms     ?? {};
globalThis.__zik_chatHistories  = globalThis.__zik_chatHistories  ?? {};

export const playlistCache   = globalThis.__zik_playlistCache;  // roomId -> Track[]
export const customRooms     = globalThis.__zik_customRooms;    // code   -> { id, name, emoji, tracks, ... }
export const dbRooms         = globalThis.__zik_dbRooms;        // code   -> { name, emoji, max_rounds, ... }
export const roomGames       = globalThis.__zik_roomGames;      // roomId -> { roomId, players, socketToName, ... }
export const salonRooms      = globalThis.__zik_salonRooms;     // code   -> { code, hostSocketId, settings, players, game }
export const chatHistories   = globalThis.__zik_chatHistories;  // roomId -> { messages: [], clearTimer: null }

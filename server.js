'use strict';

require('dotenv').config();

const express     = require('express');
const http        = require('http');
const compression = require('compression');
const { Server }  = require('socket.io');

const registerStatic  = require('./src/routes/static');
const apiRouter       = require('./src/routes/api');
const roomsRouter     = require('./src/routes/rooms');
const registerSocket  = require('./src/socket/game');
const { preloadAllPlaylists } = require('./src/services/playlist');

// ─── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  transports:        ['websocket', 'polling'],
  perMessageDeflate: { threshold: 1024 },
  httpCompression:   { threshold: 1024 },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(compression());

// Static assets and HTML routes (before JSON body parser — serves files early)
registerStatic(app);

app.use(express.json({ limit: '2mb' }));

// Handle malformed JSON gracefully
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload trop volumineux (max 2 Mo)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  next(err);
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api', apiRouter);
app.use('/api', roomsRouter);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
registerSocket(io);

// ─── Startup ──────────────────────────────────────────────────────────────────
preloadAllPlaylists();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ZIK en ligne -> http://localhost:${PORT}`));

'use strict';

const path    = require('path');
const express = require('express');

const VIEWS  = path.join(__dirname, '../../views');
const PUBLIC = path.join(__dirname, '../../public');

function register(app) {
  // ─── Config JS (env vars exposed to the browser) ─────────────────────────
  app.get('/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(
      `window.ZIK_SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL || '')};` +
      `window.ZIK_SUPABASE_ANON_KEY=${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};` +
      `window.ZIK_SPOTIFY_CLIENT_ID=${JSON.stringify(process.env.SPOTIFY_CLIENT_ID || '')};` +
      `window.ZIK_ADMIN_USER_ID=${JSON.stringify(process.env.ADMIN_USER_ID || '')};`
    );
  });

  // ─── Favicon (prevents Spotify from hijacking it during OAuth) ───────────
  app.get('/favicon.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#070b10"/>
  <text x="32" y="46" font-size="38" text-anchor="middle" font-family="sans-serif">&#127925;</text>
</svg>`);
  });

  // ─── Static assets (CSS, JS, images) ─────────────────────────────────────
  app.use(express.static(PUBLIC, { maxAge: '5m', etag: true, lastModified: true }));

  // ─── HTML routes (clean URLs without .html) ───────────────────────────────
  app.get('/',              (req, res) => res.sendFile(path.join(VIEWS, 'index.html')));
  app.get('/game',          (req, res) => res.sendFile(path.join(VIEWS, 'game.html')));
  app.get('/playlists',     (req, res) => res.sendFile(path.join(VIEWS, 'playlists.html')));
  app.get('/rooms',         (req, res) => res.sendFile(path.join(VIEWS, 'rooms.html')));
  app.get('/profile',       (req, res) => res.sendFile(path.join(VIEWS, 'profile.html')));
  app.get('/settings',      (req, res) => res.sendFile(path.join(VIEWS, 'settings.html')));
  app.get('/cgu',           (req, res) => res.sendFile(path.join(VIEWS, 'cgu.html')));
  app.get('/confidentialite', (req, res) => res.sendFile(path.join(VIEWS, 'confidentialite.html')));

  // ─── Legacy .html redirects ───────────────────────────────────────────────
  app.get('/game.html',      (req, res) => res.redirect(301, '/game' + (Object.keys(req.query).length ? '?' + new URLSearchParams(req.query) : '')));
  app.get('/playlists.html', (req, res) => res.redirect(301, '/playlists'));
  app.get('/profile.html',   (req, res) => res.redirect(301, '/profile'));
  app.get('/index.html',     (req, res) => res.redirect(301, '/'));
}

module.exports = register;

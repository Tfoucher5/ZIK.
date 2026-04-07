ALTER TABLE custom_playlist_tracks
  ADD COLUMN IF NOT EXISTS custom_artist TEXT,
  ADD COLUMN IF NOT EXISTS custom_title  TEXT,
  ADD COLUMN IF NOT EXISTS custom_feats  TEXT[];

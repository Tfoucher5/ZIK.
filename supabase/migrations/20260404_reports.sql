-- ── Table reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text        NOT NULL CHECK (type IN ('bug', 'user', 'contact')),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'resolved', 'dismissed')),
  reporter_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name   text,                          -- pour les invités
  reporter_email  text,                          -- pour le formulaire contact
  reported_user_id uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_username text,
  room_id         text,                          -- code de la room pour les bugs in-game
  subject         text,                          -- objet du message (formulaire contact)
  message         text        NOT NULL,
  metadata        jsonb       DEFAULT '{}',      -- contexte : navigateur, manche, etc.
  created_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_note      text
);

-- Index pour les requêtes admin
CREATE INDEX IF NOT EXISTS reports_status_idx     ON reports(status);
CREATE INDEX IF NOT EXISTS reports_type_idx       ON reports(type);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut créer un report (invités inclus)
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (true);

-- Seuls les super_admin peuvent lire
CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Seuls les super_admin peuvent mettre à jour (statut, note)
CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- ============================================================
--  BT PROJECT — Schéma Supabase
--  À coller dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. PROFILES (lié à auth.users automatiquement)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  xp          INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  elo         INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  total_score  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. GAMES (une partie complète)
CREATE TABLE public.games (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT NOT NULL,          -- ex: 'hiphop', 'electro', 'annees90'
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  rounds      INTEGER NOT NULL DEFAULT 10
);

-- 3. GAME_PLAYERS (joueurs + score final par partie)
CREATE TABLE public.game_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username    TEXT NOT NULL,           -- snapshot du pseudo au moment de la partie
  score       INTEGER NOT NULL DEFAULT 0,
  rank        INTEGER,                 -- position finale (1er, 2ème...)
  is_guest    BOOLEAN NOT NULL DEFAULT FALSE
);

-- 4. ROUND_RESULTS (détail manche par manche)
CREATE TABLE public.round_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username      TEXT NOT NULL,
  round_number  INTEGER NOT NULL,
  found_artist  BOOLEAN NOT NULL DEFAULT FALSE,
  found_title   BOOLEAN NOT NULL DEFAULT FALSE,
  time_taken    FLOAT,                 -- secondes pour trouver
  points_earned INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
--  INDEXES pour les requêtes fréquentes
-- ============================================================
CREATE INDEX idx_game_players_user ON public.game_players(user_id);
CREATE INDEX idx_game_players_game ON public.game_players(game_id);
CREATE INDEX idx_round_results_user ON public.round_results(user_id);
CREATE INDEX idx_round_results_game ON public.round_results(game_id);
CREATE INDEX idx_games_room ON public.games(room_id);
CREATE INDEX idx_profiles_elo ON public.profiles(elo DESC);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture publique, écriture seulement sur son propre profil
CREATE POLICY "Profiles lisibles par tous"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Profil modifiable par son propriétaire"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Games : lecture publique
CREATE POLICY "Games lisibles par tous"
  ON public.games FOR SELECT USING (true);

CREATE POLICY "Games créables par tous"
  ON public.games FOR INSERT WITH CHECK (true);

CREATE POLICY "Games modifiables par tous"
  ON public.games FOR UPDATE USING (true);

-- Game players : lecture publique, insertion libre (guests inclus)
CREATE POLICY "Game players lisibles par tous"
  ON public.game_players FOR SELECT USING (true);

CREATE POLICY "Game players insérables par tous"
  ON public.game_players FOR INSERT WITH CHECK (true);

CREATE POLICY "Game players modifiables par tous"
  ON public.game_players FOR UPDATE USING (true);

-- Round results : lecture publique, insertion libre
CREATE POLICY "Round results lisibles par tous"
  ON public.round_results FOR SELECT USING (true);

CREATE POLICY "Round results insérables par tous"
  ON public.round_results FOR INSERT WITH CHECK (true);

-- ============================================================
--  TRIGGER : créer un profil automatiquement à l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Dériver un username depuis les métadonnées (email/username/name)
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    REGEXP_REPLACE(
      LOWER(COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))),
      '[^a-z0-9_-]', '', 'g'
    )
  );
  -- S'assurer que le username fait entre 3 et 20 caractères
  base_username := SUBSTRING(base_username FROM 1 FOR 20);
  IF LENGTH(base_username) < 3 THEN base_username := 'user'; END IF;
  final_username := base_username;

  -- Unicité du username (ajouter suffix si déjà pris)
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := SUBSTRING(base_username FROM 1 FOR 17) || counter::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
--  FONCTION : classement hebdomadaire
-- ============================================================
CREATE OR REPLACE FUNCTION public.weekly_leaderboard()
RETURNS TABLE (
  username TEXT,
  avatar_url TEXT,
  weekly_score BIGINT,
  games_count BIGINT
) AS $$
  SELECT
    p.username,
    p.avatar_url,
    SUM(gp.score) AS weekly_score,
    COUNT(DISTINCT gp.game_id) AS games_count
  FROM public.game_players gp
  JOIN public.games g ON g.id = gp.game_id
  JOIN public.profiles p ON p.id = gp.user_id
  WHERE g.ended_at >= NOW() - INTERVAL '7 days'
    AND gp.is_guest = FALSE
  GROUP BY p.username, p.avatar_url
  ORDER BY weekly_score DESC
  LIMIT 20;
$$ LANGUAGE SQL STABLE;

-- ============================================================
--  FONCTION : mettre à jour XP + niveau + ELO après une partie
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_player_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_rank INTEGER,
  p_total_players INTEGER
)
RETURNS VOID AS $$
DECLARE
  xp_gain INTEGER;
  elo_change INTEGER;
  new_xp INTEGER;
  new_level INTEGER;
BEGIN
  -- XP gagné (score + bonus de rang)
  xp_gain := p_score * 10 + CASE
    WHEN p_rank = 1 THEN 100
    WHEN p_rank = 2 THEN 60
    WHEN p_rank = 3 THEN 30
    ELSE 10
  END;

  -- ELO simplifié
  elo_change := CASE
    WHEN p_rank = 1 THEN 25
    WHEN p_rank <= CEIL(p_total_players / 2.0) THEN 10
    ELSE -10
  END;

  -- Update profil
  UPDATE public.profiles
  SET
    xp           = xp + xp_gain,
    elo          = GREATEST(0, elo + elo_change),
    games_played = games_played + 1,
    total_score  = total_score + p_score,
    level        = FLOOR(1 + SQRT((xp + xp_gain) / 100.0))
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
--  CUSTOM_PLAYLISTS (playlists personnalisées par les utilisateurs)
-- ============================================================
CREATE TABLE public.custom_playlists (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  emoji          TEXT NOT NULL DEFAULT '🎵',
  is_public      BOOLEAN NOT NULL DEFAULT FALSE,
  is_official    BOOLEAN NOT NULL DEFAULT FALSE,  -- playlist officielle (room de base)
  linked_room_id TEXT,                            -- room_id si officielle (ex: 'hiphop')
  track_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_playlists_linked_room
  ON public.custom_playlists(linked_room_id) WHERE is_official = TRUE;

ALTER TABLE public.custom_playlists ENABLE ROW LEVEL SECURITY;

-- SELECT : propriétaire + playlists publiques + playlists officielles visibles par tous
CREATE POLICY "custom_playlists_select"
  ON public.custom_playlists
  FOR SELECT
  USING (auth.uid() = owner_id OR is_public = true OR is_official = true);

-- INSERT : owner_id doit être l'utilisateur connecté (WITH CHECK explicite)
CREATE POLICY "custom_playlists_insert"
  ON public.custom_playlists
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE : seul le propriétaire
CREATE POLICY "custom_playlists_update"
  ON public.custom_playlists
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE : seul le propriétaire
CREATE POLICY "custom_playlists_delete"
  ON public.custom_playlists
  FOR DELETE
  USING (auth.uid() = owner_id);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// On force le chargement du .env si process.env est vide (cas de Vite au démarrage)
dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
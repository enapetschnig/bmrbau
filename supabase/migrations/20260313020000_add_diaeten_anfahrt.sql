-- Add diaeten_anfahrt column to time_entries
-- Baustellenanfahrt is now tracked separately (independently combinable with klein/gross)
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS diaeten_anfahrt BOOLEAN DEFAULT FALSE;

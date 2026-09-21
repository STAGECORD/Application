-- =====================================================================
-- STAGECORD — Sheet Music: generalized tuplet sizes (triplet, quintuplet,
-- sextuplet, septuplet), replacing the old triplet-only boolean.
-- Run in Supabase SQL editor, after api/sheet-music-slurs-tuplets.sql.
-- =====================================================================

ALTER TABLE public.sheet_music_notes
    ADD COLUMN IF NOT EXISTS tuplet_size smallint NOT NULL DEFAULT 0;

-- Carry forward any existing triplets (stored as tuplet_start = true)
-- into the new column before dropping the old one.
UPDATE public.sheet_music_notes
SET tuplet_size = 3
WHERE tuplet_start = true AND tuplet_size = 0;

ALTER TABLE public.sheet_music_notes
    DROP COLUMN IF EXISTS tuplet_start;

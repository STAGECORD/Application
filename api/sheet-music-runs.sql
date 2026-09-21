-- =====================================================================
-- STAGECORD — Sheet Music: "runs" (2/3/4 fast notes packed under one
-- word/beat, independent of lyric word count).
-- Run in Supabase SQL editor, after api/sheet-music-tuplet-sizes.sql.
-- =====================================================================

ALTER TABLE public.sheet_music_notes
    ADD COLUMN IF NOT EXISTS run text;

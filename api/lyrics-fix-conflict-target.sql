-- =====================================================================
-- STAGECORD — Fix rhyme-tag upserts failing with 400 Bad Request
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz).
--
-- The partial unique index from lyrics-rhyme-occurrence.sql
-- (UNIQUE ... WHERE section_id IS NOT NULL) isn't reliably usable as
-- an ON CONFLICT target by PostgREST/Supabase's upsert — every color
-- application and the legacy-tag recovery migration have been failing
-- silently against it. A plain (non-partial) UNIQUE CONSTRAINT behaves
-- identically for our purposes (Postgres never treats two NULLs as
-- equal for uniqueness anyway, so legacy all-NULL rows still coexist
-- fine) and is the standard, fully-supported upsert target.
-- =====================================================================

DROP INDEX IF EXISTS public.lyrics_rhyme_tags_occurrence_key;

ALTER TABLE public.lyrics_rhyme_tags
    ADD CONSTRAINT lyrics_rhyme_tags_occurrence_key
    UNIQUE (project_id, user_id, section_id, line_index, word_index);

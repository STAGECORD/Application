-- =====================================================================
-- STAGECORD — Rescope lyrics_rhyme_tags from "this word, everywhere" to
-- "this word, at this exact position"
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz), after
-- api/lyrics.sql has already been run.
--
-- The original design keyed a rhyme tag by (project, user, word text)
-- alone, so coloring "fest" once colored EVERY future occurrence of
-- "fest" anywhere in that person's notebook — wrong, since the same
-- word can appear in unrelated lines that don't rhyme with each other.
-- Rekeying by (section, line, word position) instead: a tag now means
-- "this specific word, in this specific line, is part of this rhyme
-- group" rather than "this word text, always."
--
-- Existing rows (tagged under the old word-only scheme) simply become
-- unaddressable under the new scheme (their section_id/line_index/
-- word_index are NULL) — left in place rather than deleted, harmless.
-- =====================================================================

ALTER TABLE public.lyrics_rhyme_tags
    ADD COLUMN IF NOT EXISTS section_id uuid,
    ADD COLUMN IF NOT EXISTS line_index integer,
    ADD COLUMN IF NOT EXISTS word_index integer;

ALTER TABLE public.lyrics_rhyme_tags
    DROP CONSTRAINT IF EXISTS lyrics_rhyme_tags_project_id_user_id_word_key;

CREATE UNIQUE INDEX IF NOT EXISTS lyrics_rhyme_tags_occurrence_key
    ON public.lyrics_rhyme_tags (project_id, user_id, section_id, line_index, word_index)
    WHERE section_id IS NOT NULL;

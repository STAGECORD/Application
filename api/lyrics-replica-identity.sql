-- =====================================================================
-- STAGECORD — Full row data on realtime DELETE/UPDATE for Lyrics Studio
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz).
--
-- By default Postgres only includes the primary key in the "old" half
-- of an UPDATE/DELETE realtime payload. The client needs old.user_id
-- too, to tell "this change is mine, I already have it locally, skip
-- the reload" from "this is a teammate's change, actually refetch."
-- =====================================================================

ALTER TABLE public.lyrics_sections REPLICA IDENTITY FULL;
ALTER TABLE public.lyrics_rhyme_tags REPLICA IDENTITY FULL;

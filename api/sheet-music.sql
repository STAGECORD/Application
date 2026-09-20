-- =====================================================================
-- STAGECORD — Sheet Music: notes placed on lyrics, per project
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz), after
-- api/lyrics.sql (reuses its project-membership helper and addresses
-- notes by the same section_id/line_index/word_index scheme as
-- lyrics_rhyme_tags).
--
-- Notes are shared across the whole project (like Main Lyrics), not
-- per-person — a melody is one collaborative artifact, not each
-- person's private annotation. Any project member can place or move
-- a note on any visible section (their own notebook or Main).
-- =====================================================================

-- ---------- sheet_music_settings ----------
CREATE TABLE IF NOT EXISTS public.sheet_music_settings (
    project_id uuid PRIMARY KEY,
    tempo integer NOT NULL DEFAULT 120,
    time_signature text NOT NULL DEFAULT '4/4',
    key text NOT NULL DEFAULT 'C',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sheet_music_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sheet_music_settings_select_members ON public.sheet_music_settings;
CREATE POLICY sheet_music_settings_select_members ON public.sheet_music_settings
    FOR SELECT USING (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_settings_insert_members ON public.sheet_music_settings;
CREATE POLICY sheet_music_settings_insert_members ON public.sheet_music_settings
    FOR INSERT WITH CHECK (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_settings_update_members ON public.sheet_music_settings;
CREATE POLICY sheet_music_settings_update_members ON public.sheet_music_settings
    FOR UPDATE USING (public._is_lyrics_project_member(project_id, auth.uid()));

-- ---------- sheet_music_notes ----------
-- One row per (word position, clef) — a word can carry a treble note
-- AND a bass note at the same time (e.g. melody + bass line), rendered
-- as a real grand staff: one treble staff and one bass staff per line,
-- sharing the same row of lyric words underneath.
CREATE TABLE IF NOT EXISTS public.sheet_music_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    section_id uuid NOT NULL,
    line_index integer NOT NULL,
    word_index integer NOT NULL,
    clef text NOT NULL DEFAULT 'treble' CHECK (clef IN ('treble', 'bass')),
    pitch text NOT NULL,   -- e.g. "C4", "F#3", or "rest"
    duration text NOT NULL DEFAULT 'quarter'
        CHECK (duration IN ('whole','half','quarter','eighth','sixteenth')),
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, section_id, line_index, word_index, clef)
);

CREATE INDEX IF NOT EXISTS sheet_music_notes_lookup
    ON public.sheet_music_notes (project_id, section_id);

ALTER TABLE public.sheet_music_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sheet_music_notes_select_members ON public.sheet_music_notes;
CREATE POLICY sheet_music_notes_select_members ON public.sheet_music_notes
    FOR SELECT USING (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_notes_insert_members ON public.sheet_music_notes;
CREATE POLICY sheet_music_notes_insert_members ON public.sheet_music_notes
    FOR INSERT WITH CHECK (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_notes_update_members ON public.sheet_music_notes;
CREATE POLICY sheet_music_notes_update_members ON public.sheet_music_notes
    FOR UPDATE USING (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_notes_delete_members ON public.sheet_music_notes;
CREATE POLICY sheet_music_notes_delete_members ON public.sheet_music_notes
    FOR DELETE USING (public._is_lyrics_project_member(project_id, auth.uid()));

ALTER TABLE public.sheet_music_notes REPLICA IDENTITY FULL;

-- ---------- Bundled fetch RPC ----------
CREATE OR REPLACE FUNCTION public.get_sheet_music(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    IF NOT public._is_lyrics_project_member(p_project_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not a member of this project';
    END IF;

    SELECT jsonb_build_object(
        'settings', (
            SELECT to_jsonb(s) FROM (
                SELECT tempo, time_signature, key
                FROM public.sheet_music_settings WHERE project_id = p_project_id
            ) s
        ),
        'notes', COALESCE((
            SELECT jsonb_agg(to_jsonb(n))
            FROM public.sheet_music_notes n
            WHERE n.project_id = p_project_id
        ), '[]'::jsonb)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sheet_music(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_sheet_music_settings(p_project_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.sheet_music_settings (project_id)
    VALUES (p_project_id)
    ON CONFLICT (project_id) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_sheet_music_settings(uuid) TO authenticated;

-- ---------- Realtime ----------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'sheet_music_notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sheet_music_notes;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'sheet_music_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sheet_music_settings;
    END IF;
END $$;

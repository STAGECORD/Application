-- =====================================================================
-- STAGECORD — Sheet Music: independent word-to-beat ordering per line
-- Run in Supabase SQL editor, after api/sheet-music.sql.
--
-- Lets a word be dragged onto a different beat/note slot than its
-- default (reading-order) position, without changing the actual lyric
-- text order — e.g. in "I found a love for me", "a" and "love" can
-- swap which note each is sung on, while the printed lyrics still
-- read in the original order. One row per line holds the whole
-- slot -> word permutation as a JSON array (slot_order[i] = which
-- word index sits in staff slot i).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.sheet_music_word_order (
    project_id uuid NOT NULL,
    section_id uuid NOT NULL,
    line_index integer NOT NULL,
    slot_order jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, section_id, line_index)
);

ALTER TABLE public.sheet_music_word_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sheet_music_word_order_select_members ON public.sheet_music_word_order;
CREATE POLICY sheet_music_word_order_select_members ON public.sheet_music_word_order
    FOR SELECT USING (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_word_order_insert_members ON public.sheet_music_word_order;
CREATE POLICY sheet_music_word_order_insert_members ON public.sheet_music_word_order
    FOR INSERT WITH CHECK (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS sheet_music_word_order_update_members ON public.sheet_music_word_order;
CREATE POLICY sheet_music_word_order_update_members ON public.sheet_music_word_order
    FOR UPDATE USING (public._is_lyrics_project_member(project_id, auth.uid()));

ALTER TABLE public.sheet_music_word_order REPLICA IDENTITY FULL;

-- Re-bundle get_sheet_music to also return word_order rows.
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
        ), '[]'::jsonb),
        'word_order', COALESCE((
            SELECT jsonb_agg(to_jsonb(wo))
            FROM public.sheet_music_word_order wo
            WHERE wo.project_id = p_project_id
        ), '[]'::jsonb)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sheet_music(uuid) TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'sheet_music_word_order'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sheet_music_word_order;
    END IF;
END $$;

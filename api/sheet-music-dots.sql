-- =====================================================================
-- STAGECORD — Sheet Music: dotted notes
-- Run in Supabase SQL editor, after api/sheet-music-ties.sql.
-- =====================================================================

ALTER TABLE public.sheet_music_notes
    ADD COLUMN IF NOT EXISTS dots boolean NOT NULL DEFAULT false;

-- Re-bundle get_sheet_music so notes include the dots flag.
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

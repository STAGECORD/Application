-- =====================================================================
-- Project view-tracking: red-dot "unseen" notifications on pill buttons.
-- Per-user state — each user gets their own last_seen_at per
-- (project, category, file_type).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_views (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL,
    category text NOT NULL,
    file_type text NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, project_id, category, file_type)
);

ALTER TABLE public.project_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_views_select_own ON public.project_views;
CREATE POLICY project_views_select_own ON public.project_views
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS project_views_insert_own ON public.project_views;
CREATE POLICY project_views_insert_own ON public.project_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS project_views_update_own ON public.project_views;
CREATE POLICY project_views_update_own ON public.project_views
    FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS project_views_lookup
    ON public.project_views (user_id, project_id);

-- Returns (category, file_type, unseen_count) per pill for the caller.
-- "Unseen" = any file in that category/type created after the user's
-- last_seen_at (or never seen at all). Own uploads should not appear
-- here because the client calls mark_project_seen right after uploading.
CREATE OR REPLACE FUNCTION public.get_project_unseen(p_project_id uuid)
RETURNS TABLE (category text, file_type text, unseen_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        pf.category,
        pf.file_type,
        COUNT(*)::int AS unseen_count
    FROM public.project_files pf
    LEFT JOIN public.project_views pv
        ON pv.user_id = auth.uid()
        AND pv.project_id = pf.project_id
        AND pv.category = pf.category
        AND pv.file_type = pf.file_type
    WHERE pf.project_id = p_project_id
        AND (pv.last_seen_at IS NULL OR pf.created_at > pv.last_seen_at)
    GROUP BY pf.category, pf.file_type;
$$;

-- Mark a pill as seen for the caller. Upsert; bumps last_seen_at to now().
CREATE OR REPLACE FUNCTION public.mark_project_seen(
    p_project_id uuid,
    p_category text,
    p_file_type text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.project_views (user_id, project_id, category, file_type, last_seen_at)
    VALUES (auth.uid(), p_project_id, p_category, p_file_type, now())
    ON CONFLICT (user_id, project_id, category, file_type)
    DO UPDATE SET last_seen_at = now();
$$;

GRANT EXECUTE ON FUNCTION public.get_project_unseen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_project_seen(uuid, text, text) TO authenticated;

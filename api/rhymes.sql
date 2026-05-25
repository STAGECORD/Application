-- =====================================================================
-- Book of Rhymes: private lyric/rhyme notebook per user, organised
-- by song-section category, optionally tagged to a project.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rhymes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text,
    content text NOT NULL,
    category text NOT NULL,
    custom_category text,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Category check constraint (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rhymes_category_check'
    ) THEN
        ALTER TABLE public.rhymes
            ADD CONSTRAINT rhymes_category_check
            CHECK (category IN (
                'verse', 'pre_chorus', 'chorus', 'middle_8', 'bridge',
                'hook', 'intro', 'outro', 'refrain', 'tag', 'vamp', 'ad_lib', 'other'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS rhymes_user_lookup
    ON public.rhymes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rhymes_project_lookup
    ON public.rhymes (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.rhymes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rhymes_select_own ON public.rhymes;
CREATE POLICY rhymes_select_own ON public.rhymes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS rhymes_insert_own ON public.rhymes;
CREATE POLICY rhymes_insert_own ON public.rhymes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS rhymes_update_own ON public.rhymes;
CREATE POLICY rhymes_update_own ON public.rhymes
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS rhymes_delete_own ON public.rhymes;
CREATE POLICY rhymes_delete_own ON public.rhymes
    FOR DELETE USING (auth.uid() = user_id);

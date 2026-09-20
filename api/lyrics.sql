-- =====================================================================
-- STAGECORD — Collaborative lyrics writing (project cards)
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
--
-- Replaces the localStorage-only lyrics prototype with real, shared
-- data scoped to a project's real members (public.project_members).
-- Three tables:
--   lyrics_books      — one row per project: shared color palette +
--                        Main Lyrics finalized state
--   lyrics_sections   — every section, both per-member notebook
--                        sections (is_main = false, user_id = author)
--                        and Main Lyrics sections (is_main = true,
--                        user_id = whoever copied it in, plus a
--                        source_user_id/source_section_id back-ref for
--                        attribution)
--   lyrics_rhyme_tags — word → color-group tags, per member. This is
--                        also the structured dataset intended for a
--                        future "suggest the next line" feature: every
--                        row records a word, which rhyme group it was
--                        placed in, and who/where — including
--                        non-obvious/slant rhymes the writer confirmed
--                        on purpose.
--
-- No hard foreign key to public.projects/public.project_members is
-- declared (their exact column shape isn't visible from this session),
-- matching the existing precedent in project-view-tracking.sql. The
-- membership check below only relies on project_members(project_id,
-- user_id), which is confirmed via the frontend's use of
-- get_project_members().
--
-- NOT YET BUILT — future moderation layer (flagged 2026-09-20):
-- someone could deliberately tag nonsense rhymes (e.g. "orange"/"blue")
-- to pollute the dataset. Eventual plan: other users review/flag a tag,
-- and a writer whose flagged tags don't hold up loses rhyme-tagging
-- privileges (scope of what else that should restrict on their artist
-- page is still undecided). lyrics_rhyme_tags.is_slant already gives a
-- starting signal (self-reported non-obvious rhyme) to build review UI
-- around later; a peer-flagging table (flagger_id, rhyme_tag_id,
-- reason) and a per-user "banned from tagging" flag can both be added
-- additively without touching what's here.
-- =====================================================================

-- ---------- Membership helper ----------
CREATE OR REPLACE FUNCTION public._is_lyrics_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = p_project_id AND user_id = p_user_id
    );
$$;

-- ---------- lyrics_books ----------
CREATE TABLE IF NOT EXISTS public.lyrics_books (
    project_id uuid PRIMARY KEY,
    palette jsonb NOT NULL DEFAULT '["#FF6A55","#FFB547","#FFE066","#43C47A","#4A90E2","#A370F0","#FF8AC8","#7DD3C0"]',
    main_finalized boolean NOT NULL DEFAULT false,
    main_finalized_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lyrics_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lyrics_books_select_members ON public.lyrics_books;
CREATE POLICY lyrics_books_select_members ON public.lyrics_books
    FOR SELECT USING (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS lyrics_books_insert_members ON public.lyrics_books;
CREATE POLICY lyrics_books_insert_members ON public.lyrics_books
    FOR INSERT WITH CHECK (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS lyrics_books_update_members ON public.lyrics_books;
CREATE POLICY lyrics_books_update_members ON public.lyrics_books
    FOR UPDATE USING (public._is_lyrics_project_member(project_id, auth.uid()));

-- ---------- lyrics_sections ----------
CREATE TABLE IF NOT EXISTS public.lyrics_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_main boolean NOT NULL DEFAULT false,
    type text NOT NULL,
    custom_name text,
    content text NOT NULL DEFAULT '',
    position integer NOT NULL DEFAULT 0,
    source_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    source_section_id uuid REFERENCES public.lyrics_sections(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lyrics_sections_lookup
    ON public.lyrics_sections (project_id, is_main, user_id, position);

ALTER TABLE public.lyrics_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lyrics_sections_select_members ON public.lyrics_sections;
CREATE POLICY lyrics_sections_select_members ON public.lyrics_sections
    FOR SELECT USING (public._is_lyrics_project_member(project_id, auth.uid()));

-- Members can insert their own notebook sections, OR Main Lyrics
-- sections (Main is a shared team document — any member can add to it,
-- normally via "copy to Main").
DROP POLICY IF EXISTS lyrics_sections_insert_members ON public.lyrics_sections;
CREATE POLICY lyrics_sections_insert_members ON public.lyrics_sections
    FOR INSERT WITH CHECK (
        public._is_lyrics_project_member(project_id, auth.uid())
        AND (is_main OR user_id = auth.uid())
    );

-- Own notebook sections: only the author can edit/delete. Main
-- sections: any project member can edit/reorder/delete (shared doc).
DROP POLICY IF EXISTS lyrics_sections_update_members ON public.lyrics_sections;
CREATE POLICY lyrics_sections_update_members ON public.lyrics_sections
    FOR UPDATE USING (
        public._is_lyrics_project_member(project_id, auth.uid())
        AND (is_main OR user_id = auth.uid())
    );

DROP POLICY IF EXISTS lyrics_sections_delete_members ON public.lyrics_sections;
CREATE POLICY lyrics_sections_delete_members ON public.lyrics_sections
    FOR DELETE USING (
        public._is_lyrics_project_member(project_id, auth.uid())
        AND (is_main OR user_id = auth.uid())
    );

-- ---------- lyrics_rhyme_tags ----------
-- One row per (project, member, word) — a word can only belong to one
-- color group at a time per member, matching the existing UI's
-- toggle-off-same-color behavior.
CREATE TABLE IF NOT EXISTS public.lyrics_rhyme_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word text NOT NULL,
    color text NOT NULL,
    -- true when this word did NOT heuristically match the rest of its
    -- color group and the writer confirmed it anyway (a deliberate
    -- slant/non-obvious rhyme) — the most valuable signal for a future
    -- suggestion model, so it's captured explicitly rather than
    -- inferred later.
    is_slant boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id, word)
);

CREATE INDEX IF NOT EXISTS lyrics_rhyme_tags_lookup
    ON public.lyrics_rhyme_tags (project_id, user_id);

ALTER TABLE public.lyrics_rhyme_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lyrics_rhyme_tags_select_members ON public.lyrics_rhyme_tags;
CREATE POLICY lyrics_rhyme_tags_select_members ON public.lyrics_rhyme_tags
    FOR SELECT USING (public._is_lyrics_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS lyrics_rhyme_tags_insert_own ON public.lyrics_rhyme_tags;
CREATE POLICY lyrics_rhyme_tags_insert_own ON public.lyrics_rhyme_tags
    FOR INSERT WITH CHECK (
        public._is_lyrics_project_member(project_id, auth.uid())
        AND user_id = auth.uid()
    );

DROP POLICY IF EXISTS lyrics_rhyme_tags_update_own ON public.lyrics_rhyme_tags;
CREATE POLICY lyrics_rhyme_tags_update_own ON public.lyrics_rhyme_tags
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS lyrics_rhyme_tags_delete_own ON public.lyrics_rhyme_tags;
CREATE POLICY lyrics_rhyme_tags_delete_own ON public.lyrics_rhyme_tags
    FOR DELETE USING (user_id = auth.uid());

-- ---------- Bundled fetch RPC ----------
-- One call loads everything the modal needs: palette/finalized state,
-- every section (own notebook across all members you're allowed to
-- see, plus Main), and every rhyme tag. Members-only.
CREATE OR REPLACE FUNCTION public.get_lyrics_book(p_project_id uuid)
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
        'book', (
            SELECT to_jsonb(b) FROM (
                SELECT palette, main_finalized, main_finalized_at
                FROM public.lyrics_books WHERE project_id = p_project_id
            ) b
        ),
        'sections', COALESCE((
            SELECT jsonb_agg(to_jsonb(s) ORDER BY s.is_main, s.user_id, s.position)
            FROM public.lyrics_sections s
            WHERE s.project_id = p_project_id
        ), '[]'::jsonb),
        'rhymes', COALESCE((
            SELECT jsonb_agg(to_jsonb(r))
            FROM public.lyrics_rhyme_tags r
            WHERE r.project_id = p_project_id
        ), '[]'::jsonb)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lyrics_book(uuid) TO authenticated;

-- Ensures a lyrics_books row exists before first write (upsert-on-read).
CREATE OR REPLACE FUNCTION public.ensure_lyrics_book(p_project_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.lyrics_books (project_id)
    VALUES (p_project_id)
    ON CONFLICT (project_id) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_lyrics_book(uuid) TO authenticated;

-- ---------- Realtime ----------
-- Broadcasts row changes to other project members so edits show up
-- live without a refresh (same pattern as the inbox: SELECT-policies
-- above already allow this; just add the tables to the publication).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'lyrics_sections'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lyrics_sections;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'lyrics_rhyme_tags'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lyrics_rhyme_tags;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'lyrics_books'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lyrics_books;
    END IF;
END $$;

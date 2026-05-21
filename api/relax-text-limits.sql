-- =====================================================================
-- STAGECORD — Relax text-length limits on posts and comments
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
--
-- Drops any existing CHECK constraint on posts.content / post_comments.content
-- (their names depend on how the table was originally created), then adds a
-- permissive 50.000-character cap that still guards the DB from runaway text.
-- =====================================================================

-- posts.content -------------------------------------------------------
do $$
declare
    r record;
begin
    for r in
        select conname
        from pg_constraint
        where conrelid = 'public.posts'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%content%'
    loop
        execute 'alter table public.posts drop constraint ' || quote_ident(r.conname);
    end loop;
end $$;

alter table public.posts
    add constraint posts_content_length_check
    check (char_length(content) <= 50000);

-- post_comments.content -----------------------------------------------
do $$
declare
    r record;
begin
    for r in
        select conname
        from pg_constraint
        where conrelid = 'public.post_comments'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%content%'
    loop
        execute 'alter table public.post_comments drop constraint ' || quote_ident(r.conname);
    end loop;
end $$;

alter table public.post_comments
    add constraint post_comments_content_length_check
    check (char_length(content) <= 50000);

-- messages.content (DM/inbox) -----------------------------------------
do $$
declare
    r record;
begin
    for r in
        select conname
        from pg_constraint
        where conrelid = 'public.messages'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%content%'
    loop
        execute 'alter table public.messages drop constraint ' || quote_ident(r.conname);
    end loop;
end $$;

alter table public.messages
    add constraint messages_content_length_check
    check (char_length(content) <= 50000);

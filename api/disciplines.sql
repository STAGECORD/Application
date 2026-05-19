-- =====================================================================
-- STAGECORD — Artist disciplines (multi-select tags on profile)
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
-- =====================================================================

-- 1) Column ------------------------------------------------------------
alter table public.profiles
    add column if not exists disciplines text[] not null default '{}';

-- 2) Update get_public_profile to include disciplines ------------------
drop function if exists public.get_public_profile(text);

create or replace function public.get_public_profile(p_username text)
returns table (
    id uuid,
    forename text,
    surname text,
    username text,
    role text,
    bio text,
    avatar_url text,
    cover_url text,
    disciplines text[]
)
language sql
security definer
set search_path = public
as $$
    select
        p.id,
        p.forename,
        p.surname,
        p.username,
        p.role,
        p.bio,
        p.avatar_url,
        p.cover_url,
        coalesce(p.disciplines, '{}'::text[]) as disciplines
    from public.profiles p
    where p.username = p_username
    limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;

-- 3) Update list_public_profiles to include disciplines ----------------
drop function if exists public.list_public_profiles();

create or replace function public.list_public_profiles()
returns table (
    id uuid,
    forename text,
    surname text,
    username text,
    role text,
    bio text,
    avatar_url text,
    disciplines text[],
    post_count bigint
)
language sql
security definer
set search_path = public
as $$
    select
        p.id,
        p.forename,
        p.surname,
        p.username,
        p.role,
        p.bio,
        p.avatar_url,
        coalesce(p.disciplines, '{}'::text[]) as disciplines,
        (select count(*) from public.posts po where po.user_id = p.id) as post_count
    from public.profiles p
    where p.username is not null
    order by p.username asc;
$$;

grant execute on function public.list_public_profiles() to authenticated;

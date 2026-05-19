-- =====================================================================
-- STAGECORD — Admin function: list every profile (with email + status)
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
--
-- The function joins public.profiles with auth.users to expose the
-- login email and email-confirmed status. It's security definer and
-- explicitly NOT granted to anon/authenticated — only callable from
-- the service-role context (i.e. the /api/list-profiles serverless
-- endpoint, which is itself gated behind ADMIN_SECRET).
-- =====================================================================

drop function if exists public.admin_list_profiles();

create or replace function public.admin_list_profiles()
returns table (
    id uuid,
    email text,
    forename text,
    surname text,
    username text,
    role text,
    disciplines text[],
    bio text,
    avatar_url text,
    created_at timestamptz,
    email_confirmed boolean
)
language sql
security definer
set search_path = public
as $$
    select
        p.id,
        u.email::text as email,
        p.forename,
        p.surname,
        p.username,
        p.role,
        coalesce(p.disciplines, '{}'::text[]) as disciplines,
        p.bio,
        p.avatar_url,
        coalesce(p.created_at, u.created_at) as created_at,
        (u.email_confirmed_at is not null) as email_confirmed
    from public.profiles p
    join auth.users u on u.id = p.id
    order by coalesce(p.created_at, u.created_at) desc;
$$;

-- Lock it down — only the service-role context (used by /api/list-profiles) may call it.
revoke execute on function public.admin_list_profiles() from public, anon, authenticated;

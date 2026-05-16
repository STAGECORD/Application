-- =====================================================================
-- STAGECORD — Global search RPC
-- Searches across profiles, tracks, posts, projects, playlists in one call.
-- Run in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz). Safe to re-run.
-- =====================================================================

drop function if exists public.global_search(text, integer);

create function public.global_search(
    p_query text,
    p_per_type_limit integer default 10
)
returns table (
    result_type   text,    -- 'person' | 'track' | 'post' | 'project' | 'playlist'
    result_id     uuid,
    title         text,    -- main display string
    subtitle      text,    -- @handle / owner name / date / etc.
    image_url     text,    -- avatar_url, cover_url, image_url — whichever fits
    href          text,    -- where to navigate when clicked
    rank          real     -- higher = better match (cheap heuristic for now)
)
language plpgsql
security definer
set search_path = public
as $$
declare
    q text := trim(coalesce(p_query, ''));
    pat text;
    lim integer := greatest(1, least(coalesce(p_per_type_limit, 10), 50));
begin
    if length(q) < 1 then
        return;
    end if;

    pat := '%' || q || '%';

    -- ---------- PEOPLE ----------
    return query
    select
        'person'::text,
        p.id,
        trim(coalesce(p.forename, '') || ' ' || coalesce(p.surname, '')),
        case when p.username is not null then '@' || p.username else null end,
        p.avatar_url,
        case when p.username is not null then '/u/' || p.username else null end,
        case
            when lower(p.username) = lower(q) then 100.0
            when lower(p.username) like lower(q) || '%' then 80.0
            when lower(coalesce(p.forename,'')) like lower(q) || '%' then 70.0
            when lower(coalesce(p.surname,'')) like lower(q) || '%' then 60.0
            when (p.forename || ' ' || p.surname) ilike pat then 50.0
            when p.username ilike pat then 40.0
            else 20.0
        end::real
    from public.profiles p
    where p.username is not null
      and (
            p.username ilike pat
         or coalesce(p.forename, '') ilike pat
         or coalesce(p.surname,  '') ilike pat
         or coalesce(p.bio,      '') ilike pat
      )
    order by 7 desc nulls last
    limit lim;

    -- ---------- TRACKS ----------
    return query
    select
        'track'::text,
        t.id,
        t.title,
        trim(coalesce(p.forename, '') || ' ' || coalesce(p.surname, ''))
            || case when p.username is not null then ' · @' || p.username else '' end,
        null::text,                                              -- no cover column on tracks today
        case when p.username is not null then '/u/' || p.username || '#track-' || t.id::text else null end,
        case
            when lower(t.title) = lower(q) then 100.0
            when lower(t.title) like lower(q) || '%' then 80.0
            when t.title ilike pat then 50.0
            else 20.0
        end::real
    from public.tracks t
    join public.profiles p on p.id = t.user_id
    where t.title ilike pat
       or coalesce(t.description, '') ilike pat
    order by 7 desc nulls last
    limit lim;

    -- ---------- POSTS ----------
    return query
    select
        'post'::text,
        po.id,
        case
            when length(po.content) > 80 then substring(po.content from 1 for 80) || '…'
            else po.content
        end,
        trim(coalesce(p.forename, '') || ' ' || coalesce(p.surname, ''))
            || case when p.username is not null then ' · @' || p.username else '' end,
        po.image_url,
        case when p.username is not null then '/u/' || p.username || '#post-' || po.id::text else null end,
        case
            when po.content ilike (q || '%') then 60.0
            when po.content ilike pat then 40.0
            else 20.0
        end::real
    from public.posts po
    join public.profiles p on p.id = po.user_id
    where po.content ilike pat
    order by po.created_at desc
    limit lim;

    -- ---------- PROJECTS ----------
    return query
    select
        'project'::text,
        pj.id,
        pj.title,
        coalesce(
            case
                when length(coalesce(pj.description,'')) > 80
                    then substring(pj.description from 1 for 80) || '…'
                else pj.description
            end,
            'Project'
        ),
        null::text,                                              -- projects don't have a cover yet
        '/projects/?id=' || pj.id::text,
        case
            when lower(pj.title) = lower(q) then 100.0
            when lower(pj.title) like lower(q) || '%' then 80.0
            when pj.title ilike pat then 50.0
            else 20.0
        end::real
    from public.projects pj
    where pj.title ilike pat
       or coalesce(pj.description, '') ilike pat
    order by 7 desc nulls last
    limit lim;

    -- ---------- PLAYLISTS ----------
    return query
    select
        'playlist'::text,
        pl.id,
        pl.name,
        coalesce(
            case
                when length(coalesce(pl.description,'')) > 80
                    then substring(pl.description from 1 for 80) || '…'
                else pl.description
            end,
            'Playlist'
        ),
        pl.cover_url,
        '/playlists/?id=' || pl.id::text,
        case
            when lower(pl.name) = lower(q) then 100.0
            when lower(pl.name) like lower(q) || '%' then 80.0
            when pl.name ilike pat then 50.0
            else 20.0
        end::real
    from public.playlists pl
    where pl.name ilike pat
       or coalesce(pl.description, '') ilike pat
    order by 7 desc nulls last
    limit lim;
end;
$$;

grant execute on function public.global_search(text, integer) to authenticated;

-- Optional: trigram indexes for faster ILIKE on big tables.
-- Skip for now (small tables in beta) — we can add later:
-- create extension if not exists pg_trgm;
-- create index profiles_search_trgm on profiles using gin ((coalesce(forename,'') || ' ' || coalesce(surname,'') || ' ' || coalesce(username,'') || ' ' || coalesce(bio,'')) gin_trgm_ops);

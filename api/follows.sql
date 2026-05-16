-- =====================================================================
-- STAGECORD — Follow system (v2: handles existing function signatures)
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
-- =====================================================================

-- 1) Table -------------------------------------------------------------
create table if not exists public.follows (
    follower_id  uuid not null references auth.users(id) on delete cascade,
    following_id uuid not null references auth.users(id) on delete cascade,
    created_at   timestamptz not null default now(),
    primary key (follower_id, following_id),
    constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_idx  on public.follows(follower_id);

-- 2) RLS ---------------------------------------------------------------
alter table public.follows enable row level security;

drop policy if exists "follows are public" on public.follows;
create policy "follows are public"
on public.follows for select
to anon, authenticated
using (true);

drop policy if exists "users can follow as themselves" on public.follows;
create policy "users can follow as themselves"
on public.follows for insert
to authenticated
with check (follower_id = auth.uid());

drop policy if exists "users can unfollow their own" on public.follows;
create policy "users can unfollow their own"
on public.follows for delete
to authenticated
using (follower_id = auth.uid());

-- 3) Drop old functions/triggers so return types can change -----------
drop trigger  if exists on_follow_created on public.follows;
drop function if exists public.on_follow_created();
drop function if exists public.toggle_follow(text);
drop function if exists public.get_follow_summary(text);

-- 4) get_follow_summary(p_username) -----------------------------------
create function public.get_follow_summary(p_username text)
returns table (
    follower_count       bigint,
    following_count      bigint,
    viewer_is_following  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    target_id uuid;
begin
    select id into target_id from public.profiles where username = lower(p_username) limit 1;
    if target_id is null then
        return query select 0::bigint, 0::bigint, false;
        return;
    end if;

    return query
    select
        (select count(*) from public.follows where following_id = target_id)::bigint,
        (select count(*) from public.follows where follower_id  = target_id)::bigint,
        case
            when auth.uid() is null then false
            else exists (
                select 1 from public.follows
                where follower_id = auth.uid() and following_id = target_id
            )
        end;
end;
$$;

grant execute on function public.get_follow_summary(text) to anon, authenticated;

-- 5) toggle_follow(p_target_username) ---------------------------------
create function public.toggle_follow(p_target_username text)
returns table (
    is_following   boolean,
    follower_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    target_id uuid;
    existed boolean;
begin
    if me is null then
        raise exception 'must be authenticated to follow';
    end if;

    select id into target_id from public.profiles where username = lower(p_target_username) limit 1;
    if target_id is null then
        raise exception 'user not found: %', p_target_username;
    end if;

    if target_id = me then
        raise exception 'cannot follow yourself';
    end if;

    select exists(
        select 1 from public.follows where follower_id = me and following_id = target_id
    ) into existed;

    if existed then
        delete from public.follows where follower_id = me and following_id = target_id;
    else
        insert into public.follows (follower_id, following_id) values (me, target_id);
    end if;

    return query
    select
        (not existed),
        (select count(*) from public.follows where following_id = target_id)::bigint;
end;
$$;

grant execute on function public.toggle_follow(text) to authenticated;

-- 6) Notification trigger ---------------------------------------------
create function public.on_follow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.follower_id = new.following_id then
        return new;
    end if;

    insert into public.notifications (
        user_id, actor_id, type, target_type, target_id
    ) values (
        new.following_id,
        new.follower_id,
        'follow',
        'user',
        new.following_id
    );

    return new;
end;
$$;

create trigger on_follow_created
after insert on public.follows
for each row execute function public.on_follow_created();

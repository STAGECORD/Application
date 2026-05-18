-- =====================================================================
-- STAGECORD — Inbox realtime + optimistic send
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz).
-- Safe to re-run.
--
-- Adds:
--   1) SELECT RLS policies on conversations / conversation_members /
--      messages so Realtime can broadcast inserts to the right viewers.
--      (Existing INSERT/UPDATE/DELETE still go through security-definer
--      RPCs — we are NOT opening writes.)
--   2) Re-creates send_message to RETURN the inserted row so the client
--      can resolve its optimistic bubble immediately.
--   3) Enables the messages table on the supabase_realtime publication.
-- =====================================================================

-- 1) SELECT RLS policies ----------------------------------------------

-- Self-membership: every authenticated user can see only their own row.
-- (No recursion: refers only to auth.uid().)
drop policy if exists "cm_self_read" on public.conversation_members;
create policy "cm_self_read"
on public.conversation_members for select
to authenticated
using (user_id = auth.uid());

-- Conversations are visible to their members.
drop policy if exists "conv_member_read" on public.conversations;
create policy "conv_member_read"
on public.conversations for select
to authenticated
using (
    exists (
        select 1
        from public.conversation_members cm
        where cm.conversation_id = conversations.id
          and cm.user_id = auth.uid()
    )
);

-- Messages are visible to members of the conversation.
drop policy if exists "msg_member_read" on public.messages;
create policy "msg_member_read"
on public.messages for select
to authenticated
using (
    exists (
        select 1
        from public.conversation_members cm
        where cm.conversation_id = messages.conversation_id
          and cm.user_id = auth.uid()
    )
);

-- 2) send_message: return the inserted row ----------------------------

drop function if exists public.send_message(uuid, text);

-- Returns SETOF public.messages (not RETURNS TABLE) so that column
-- references inside the function body don't collide with implicit OUT
-- parameters — e.g. "where conversation_id = ..." would otherwise be
-- ambiguous against an OUT param of the same name.
create function public.send_message(
    p_conversation_id uuid,
    p_content         text
)
returns setof public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    is_member boolean;
    new_row public.messages;
    trimmed text := btrim(coalesce(p_content, ''));
begin
    if me is null then
        raise exception 'must be authenticated to send a message';
    end if;

    if length(trimmed) = 0 then
        raise exception 'message is empty';
    end if;

    if length(trimmed) > 2000 then
        raise exception 'message too long (max 2000 chars)';
    end if;

    select exists(
        select 1 from public.conversation_members cm
        where cm.conversation_id = p_conversation_id
          and cm.user_id = me
    ) into is_member;

    if not is_member then
        raise exception 'not a member of this conversation';
    end if;

    insert into public.messages (conversation_id, user_id, content)
    values (p_conversation_id, me, trimmed)
    returning * into new_row;

    update public.conversations
       set last_message_at = new_row.created_at
     where conversations.id = p_conversation_id;

    return next new_row;
end;
$$;

grant execute on function public.send_message(uuid, text) to authenticated;

-- 2b) get_conversation_messages: same column-ambiguity bug fix -------
-- Original function (shipped 2026-05-06) had the same RETURNS TABLE
-- vs. unqualified column reference issue — exposed only once messages
-- actually persisted after the send_message fix above.

drop function if exists public.get_conversation_messages(uuid, integer);

create function public.get_conversation_messages(
    p_conversation_id uuid,
    p_limit           integer default 200
)
returns table (
    id              uuid,
    user_id         uuid,
    content         text,
    created_at      timestamptz,
    forename        text,
    surname         text,
    username        text,
    avatar_url      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    is_member boolean;
begin
    if me is null then
        raise exception 'must be authenticated';
    end if;

    select exists(
        select 1 from public.conversation_members cm
        where cm.conversation_id = p_conversation_id
          and cm.user_id = me
    ) into is_member;

    if not is_member then
        raise exception 'not a member of this conversation';
    end if;

    update public.conversation_members cm
       set last_read_at = now()
     where cm.conversation_id = p_conversation_id
       and cm.user_id = me;

    return query
    select m.id, m.user_id, m.content, m.created_at,
           p.forename, p.surname, p.username, p.avatar_url
    from public.messages m
    left join public.profiles p on p.id = m.user_id
    where m.conversation_id = p_conversation_id
    order by m.created_at asc
    limit p_limit;
end;
$$;

grant execute on function public.get_conversation_messages(uuid, integer) to authenticated;

-- 3) Realtime publication ---------------------------------------------
-- Add messages to the supabase_realtime publication if it's not already
-- there. Wrapped in DO so re-running is safe (ALTER PUBLICATION raises
-- if the table is already a member).
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename  = 'messages'
    ) then
        execute 'alter publication supabase_realtime add table public.messages';
    end if;
end $$;

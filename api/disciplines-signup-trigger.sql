-- =====================================================================
-- STAGECORD — Sync disciplines from auth metadata to profile on signup
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
--
-- Why a separate trigger (vs editing handle_new_user)?
-- This is purely additive — handle_new_user keeps doing its job
-- (forename/surname/username/role), and this trigger only fills in
-- the disciplines column AFTER the profile row has been created.
-- The 'zz_' prefix on the trigger name ensures it runs after
-- handle_new_user alphabetically.
-- =====================================================================

create or replace function public.sync_new_user_disciplines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    meta jsonb := new.raw_user_meta_data;
    v_disciplines text[];
begin
    if meta is null or not (meta ? 'disciplines') then
        return new;
    end if;

    -- Accept either ["slug1","slug2"] or '{slug1,slug2}' shapes
    if jsonb_typeof(meta->'disciplines') = 'array' then
        select coalesce(array_agg(value::text), '{}'::text[])
        into v_disciplines
        from jsonb_array_elements_text(meta->'disciplines');
    else
        v_disciplines := '{}'::text[];
    end if;

    update public.profiles
    set disciplines = v_disciplines
    where id = new.id;

    return new;
end;
$$;

drop trigger if exists zz_sync_disciplines_on_signup on auth.users;
create trigger zz_sync_disciplines_on_signup
    after insert on auth.users
    for each row
    execute function public.sync_new_user_disciplines();

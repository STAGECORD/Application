-- =====================================================================
-- STAGECORD — Disciplines on waitlist signups
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
-- =====================================================================

alter table public.waitlist
    add column if not exists disciplines text[] not null default '{}';

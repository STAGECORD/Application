-- =====================================================================
-- STAGECORD — Soft-delete on waitlist (recoverable)
-- Run this in Supabase SQL editor (project: jkleiomqhmrnpsflyuoz)
-- Safe to re-run.
--
-- Switches Delete on /admin/ from a hard DELETE row to a timestamp on
-- waitlist.deleted_at. Rows with deleted_at IS NOT NULL stay in the table
-- but are hidden from the default admin view. A new Restore button (and
-- the matching /api/restore-waitlist endpoint) clears the timestamp.
-- =====================================================================

alter table public.waitlist
    add column if not exists deleted_at timestamptz;

create index if not exists waitlist_deleted_at_idx
    on public.waitlist (deleted_at);

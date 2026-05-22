-- =====================================================================
-- Settings extensions: notification preferences, privacy controls,
-- soft-delete-on-request (30-day grace window).
--
-- Adds four columns to public.profiles and two RPCs for the
-- delete-account flow. Password change uses sb.auth.updateUser
-- directly and needs no schema change.
-- =====================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
        "email_on_follow": true,
        "email_on_comment": true,
        "email_on_like": false,
        "email_on_message": true,
        "email_on_project_added": true,
        "email_weekly_digest": false
    }'::jsonb;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS dm_permission text NOT NULL DEFAULT 'everyone';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS deletion_reason text;

-- Add CHECK constraints idempotently (PostgreSQL doesn't have IF NOT EXISTS
-- for constraints — use the DO block).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_profile_visibility_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_profile_visibility_check
            CHECK (profile_visibility IN ('public', 'followers'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_dm_permission_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_dm_permission_check
            CHECK (dm_permission IN ('everyone', 'followers'));
    END IF;
END $$;

-- Schedule the calling user's account for deletion 30 days from now.
-- Background cleanup (hard delete after the grace window) is handled
-- separately — this RPC only flags the row and optionally records the
-- reason the user gave for leaving (for product feedback).
DROP FUNCTION IF EXISTS public.request_account_deletion();
DROP FUNCTION IF EXISTS public.request_account_deletion(text);
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.profiles
    SET deletion_scheduled_at = now() + interval '30 days',
        deletion_reason = p_reason
    WHERE id = auth.uid()
    RETURNING deletion_scheduled_at;
$$;

-- Cancel a pending deletion (only works while still inside the grace window).
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.profiles
    SET deletion_scheduled_at = NULL
    WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

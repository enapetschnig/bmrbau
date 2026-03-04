-- Notifications table for in-app push notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Any authenticated user can insert notifications (for notifying others)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Index for fast lookups
CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX notifications_created_at_idx ON public.notifications(created_at DESC);

-- Enable Realtime for instant popup notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function: employee calls this after uploading a sick note
-- Inserts a notification for every administrator
CREATE OR REPLACE FUNCTION public.notify_admins_sick_note(
  p_uploader_id uuid,
  p_uploader_name text,
  p_file_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, created_by, type, title, message, metadata)
  SELECT
    ur.user_id,
    p_uploader_id,
    'krankmeldung_upload',
    'Neue Krankmeldung',
    p_uploader_name || ' hat eine Krankmeldung hochgeladen',
    jsonb_build_object('file_name', p_file_name, 'uploader_id', p_uploader_id)
  FROM public.user_roles ur
  WHERE ur.role = 'administrator'
    AND ur.user_id IS DISTINCT FROM p_uploader_id;
END;
$$;

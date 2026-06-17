-- Wipe all content tables
TRUNCATE TABLE
  public.update_reactions,
  public.update_photos,
  public.phase_updates,
  public.project_phases,
  public.projects,
  public.quote_lines,
  public.quotes,
  public.quote_requests,
  public.quote_upload_tickets,
  public.messages,
  public.conversations,
  public.recent_work_items,
  public.recent_work_publications,
  public.public_form_submissions,
  public.email_send_log,
  public.email_send_state,
  public.email_unsubscribe_tokens,
  public.suppressed_emails,
  public.notify_event_failures
RESTART IDENTITY CASCADE;

-- Delete non-admin profiles and their auth users
DO $$
DECLARE
  keep_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO keep_ids
    FROM public.profiles
   WHERE email IN ('info@studioakke.com', 'bmaaruf@gmail.com');

  DELETE FROM public.user_roles WHERE user_id <> ALL(keep_ids);
  DELETE FROM public.profiles  WHERE id      <> ALL(keep_ids);
  DELETE FROM auth.users       WHERE id      <> ALL(keep_ids);
END $$;
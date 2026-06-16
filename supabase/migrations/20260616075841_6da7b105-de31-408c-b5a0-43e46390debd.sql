CREATE OR REPLACE FUNCTION public.tg_quote_lock_customer_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- service_role (server functions, auth.uid() IS NULL) and admins bypass
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.quote_number IS DISTINCT FROM OLD.quote_number
    OR NEW.quote_request_id IS DISTINCT FROM OLD.quote_request_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.vehicle_label IS DISTINCT FROM OLD.vehicle_label
    OR NEW.intro_text IS DISTINCT FROM OLD.intro_text
    OR NEW.notes_text IS DISTINCT FROM OLD.notes_text
    OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Alleen status, responded_at en response_reason mogen door de klant gewijzigd worden';
  END IF;
  NEW.responded_at := COALESCE(NEW.responded_at, now());
  RETURN NEW;
END $$;

CREATE TYPE public.quote_doc_status AS ENUM ('concept', 'verstuurd', 'akkoord', 'afgewezen');

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  quote_request_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  vehicle_label text NOT NULL DEFAULT '',
  intro_text text NOT NULL DEFAULT '',
  notes_text text NOT NULL DEFAULT '',
  status public.quote_doc_status NOT NULL DEFAULT 'concept'::public.quote_doc_status,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  valid_until date,
  response_reason text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_admin_all" ON public.quotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "quotes_customer_select" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    AND status IN ('verstuurd'::public.quote_doc_status,'akkoord'::public.quote_doc_status,'afgewezen'::public.quote_doc_status)
  );

CREATE POLICY "quotes_customer_respond" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid()
    AND status = 'verstuurd'::public.quote_doc_status
  )
  WITH CHECK (
    customer_id = auth.uid()
    AND status IN ('akkoord'::public.quote_doc_status,'afgewezen'::public.quote_doc_status)
  );

CREATE OR REPLACE FUNCTION public.tg_quote_lock_customer_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
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

CREATE TRIGGER quote_lock_customer_update
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_lock_customer_update();

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_lines_quote_id_idx ON public.quote_lines(quote_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_lines TO authenticated;
GRANT ALL ON public.quote_lines TO service_role;

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_lines_admin_all" ON public.quote_lines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "quote_lines_customer_select" ON public.quote_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_lines.quote_id
      AND q.customer_id = auth.uid()
      AND q.status IN ('verstuurd'::public.quote_doc_status,'akkoord'::public.quote_doc_status,'afgewezen'::public.quote_doc_status)
  ));

CREATE OR REPLACE FUNCTION public.tg_recalc_quote_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_quote uuid;
  v_total numeric(12,2);
BEGIN
  v_quote := COALESCE(NEW.quote_id, OLD.quote_id);
  SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM public.quote_lines WHERE quote_id = v_quote;
  UPDATE public.quotes SET total_amount = v_total WHERE id = v_quote;
  RETURN NEW;
END $$;

CREATE TRIGGER quote_lines_recalc_total
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_quote_total();

CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_count int;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
    FROM public.quotes
    WHERE quote_number LIKE 'YEK-' || v_year || '-%';
  RETURN 'YEK-' || v_year || '-' || lpad(v_count::text, 3, '0');
END $$;

CREATE OR REPLACE FUNCTION public.tg_quote_status_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('verstuurd'::public.quote_doc_status,'akkoord'::public.quote_doc_status,'afgewezen'::public.quote_doc_status) THEN
      PERFORM public.dispatch_notify_event(jsonb_build_object(
        'type', 'UPDATE',
        'table', 'quotes',
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      ));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quote_status_notify
  AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_status_notify();

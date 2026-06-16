## Probleem

Bij "Versturen" naar de klant geeft de offerte deze fout:

> Alleen status, responded_at en response_reason mogen door de klant gewijzigd worden

### Oorzaak

De server-functie `sendQuoteToCustomer` schrijft `quote_number`, `sent_at` en `status` weg via `supabaseAdmin` (service_role). De trigger `tg_quote_lock_customer_update` controleert alleen op admin via `has_role(auth.uid(), 'admin')`. Bij een service_role-call is `auth.uid()` NULL, dus `has_role` is false → de trigger blokkeert de update alsof het de klant is.

Dit treft alleen admin-server-functies (versturen, nummeren, eventuele andere backoffice-updates). De klant-RLS blijft intact.

## Oplossing (1 migration)

Vervang `public.tg_quote_lock_customer_update()` zodat hij ook door laat wanneer de call vanuit de service_role komt (geen JWT-user). De klantbescherming blijft 1-op-1 gelijk.

```sql
CREATE OR REPLACE FUNCTION public.tg_quote_lock_customer_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- service_role (server functions) en admin mogen alles
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- klant-pad: alleen status / responded_at / response_reason
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
```

`auth.uid() IS NULL` is veilig hier: PostgREST staat alleen `authenticated` toe via RLS-policies; service_role omzeilt RLS sowieso, dus deze branch is exact "server-functie of klant-write die de RLS al heeft afgewezen" — RLS blokkeert ongeauthenticeerde writes vóór de trigger draait.

## Niet aangeraakt

- RLS-policies op `quotes` / `quote_lines`
- Klant-portal flow (akkoord/afgewezen)
- Notify pipeline
- PDF / e-mail logica

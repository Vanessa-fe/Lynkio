-- Dernier diagnostic de la fiche. Une ancienne détection de stack ne prouve pas le protocole.
ALTER TABLE public.companies
  ADD COLUMN website_audit_url text CHECK (website_audit_url ~ '^https?://'),
  ADD COLUMN website_audited_at timestamptz;

INSERT INTO public.signal_types(key, label, description, default_ttl_days, category, nature, reliability)
VALUES ('website_http_observed', 'Page consultée en HTTP',
        'La page a répondu en HTTP à la date indiquée.', 30, 'website', 'observed', 'medium');

CREATE FUNCTION public.clear_changed_website_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.website_audit_url := NULL;
  NEW.website_audited_at := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_changed_website_audit BEFORE UPDATE OF website ON public.companies
FOR EACH ROW WHEN (OLD.website IS DISTINCT FROM NEW.website)
EXECUTE FUNCTION public.clear_changed_website_audit();

CREATE FUNCTION public.sync_website_protocol_signal() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.website_audit_url LIKE 'http://%' AND NEW.website_audited_at IS NOT NULL THEN
    INSERT INTO public.company_signals
      (company_id, user_id, signal_type, dedupe_key, source_url, detected_at, expires_at, evidence)
    VALUES (NEW.id, NEW.user_id, 'website_http_observed', 'homepage', NEW.website_audit_url,
      NEW.website_audited_at, NEW.website_audited_at + interval '30 days',
      jsonb_build_object('source', 'site', 'protocol', 'HTTP'))
    ON CONFLICT (company_id, signal_type, dedupe_key) DO UPDATE SET
      source_url = EXCLUDED.source_url, detected_at = EXCLUDED.detected_at, expires_at = EXCLUDED.expires_at;
  ELSE
    DELETE FROM public.company_signals WHERE company_id = NEW.id
      AND signal_type = 'website_http_observed' AND dedupe_key = 'homepage';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_website_protocol_signal AFTER UPDATE ON public.companies
FOR EACH ROW WHEN (OLD.website_audited_at IS DISTINCT FROM NEW.website_audited_at
                OR OLD.website_audit_url IS DISTINCT FROM NEW.website_audit_url)
EXECUTE FUNCTION public.sync_website_protocol_signal();

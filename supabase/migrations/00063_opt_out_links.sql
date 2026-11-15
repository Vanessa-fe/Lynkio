-- Lien « ne plus être contacté » du premier e-mail de Sophie (RGPD, art. 21).
-- Un lien par rédaction et par contact. Seule l'empreinte du jeton est gardée : la base
-- ne permet pas de retrouver les liens envoyés.
CREATE TABLE public.opt_out_links (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.company_contacts ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX opt_out_links_contact ON public.opt_out_links(contact_id);
-- Aucun accès direct : les liens sont créés par la fonction draft-message (clé de service)
-- et utilisés par opt_out_by_token
ALTER TABLE public.opt_out_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opt_out_links FROM PUBLIC, anon, authenticated;

-- Page publique /stop/<jeton> : la personne confirme, son contact est marqué « ne plus contacter ».
-- Renvoie 'done' (enregistré, ou déjà fait) ou 'invalid' (lien inconnu ou expiré, 3 ans).
CREATE FUNCTION public.opt_out_by_token(p_token text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE link public.opt_out_links%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 100 THEN RETURN 'invalid'; END IF;
  SELECT * INTO link FROM public.opt_out_links
    WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      AND created_at > now() - interval '3 years';
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  UPDATE public.company_contacts SET opted_out_at = coalesce(opted_out_at, now())
    WHERE id = link.contact_id AND user_id = link.user_id;
  UPDATE public.opt_out_links SET used_at = coalesce(used_at, now()) WHERE token_hash = link.token_hash;
  RETURN 'done';
END;
$$;
REVOKE ALL ON FUNCTION public.opt_out_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.opt_out_by_token(text) TO anon, authenticated;

-- Les liens expirés (plus de 3 ans) sont effacés chaque nuit
SELECT cron.schedule('opt-out-links-retention', '50 3 * * *',
  $$ DELETE FROM public.opt_out_links WHERE created_at < now() - interval '3 years'; $$);

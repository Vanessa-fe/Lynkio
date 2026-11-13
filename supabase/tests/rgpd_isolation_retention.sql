-- =====================================================================
-- Tests RGPD : isolation entre comptes, conservation, journal d'accès, suppression du compte
-- =====================================================================
--
-- Tout se passe dans une transaction ANNULÉE à la fin (ROLLBACK) : deux comptes fictifs sont créés,
-- testés puis effacés avec la transaction. Rien ne reste en base, même en cas d'échec.
--
-- Lancer (depuis la racine du dépôt lié au projet Supabase) :
--   supabase db query --linked -f supabase/tests/rgpd_isolation_retention.sql
-- Réussite : la dernière ligne affiche « RGPD : tous les tests passent ».
-- Échec : une erreur « ÉCHEC : … » nomme le test, et la transaction est annulée.

BEGIN;

-- Deux comptes fictifs (le déclencheur d'inscription crée leur profil et leurs étapes)
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rgpd-test-a@example.invalid', '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rgpd-test-b@example.invalid', '{}'::jsonb, now(), now());

-- Étape « gagnée » propre au test (pas de dépendance aux étapes par défaut)
INSERT INTO public.pipeline_stages (id, user_id, name, color, kind, "order")
VALUES ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000a', 'Client test', '#000000', 'won', 999);

-- Entreprises du compte A
INSERT INTO public.companies (id, user_id, name, created_at, collected_at, stage_id) VALUES
  -- Vieille fiche sans suite : seule candidate au nettoyage
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'A vieille sans suite', now() - interval '4 years', now() - interval '4 years', NULL),
  -- Vieille mais cliente : gardée
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'A cliente', now() - interval '4 years', now() - interval '4 years', '00000000-0000-4000-8000-0000000000f1'),
  -- Vieille, contact opposé : gardée (l'opposition doit être retenue)
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000000a', 'A opposition', now() - interval '4 years', now() - interval '4 years', NULL),
  -- Vieille, échange récent : gardée
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000000a', 'A échange récent', now() - interval '4 years', now() - interval '4 years', NULL),
  -- Récente : gardée
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-00000000000a', 'A récente', now() - interval '2 months', now() - interval '2 months', NULL);

INSERT INTO public.company_contacts (user_id, company_id, first_name, last_name, opted_out_at) VALUES
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'Alice', 'Ancienne', NULL),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'Olivier', 'Opposé', now() - interval '3 years');

INSERT INTO public.company_interactions (user_id, company_id, type, occurred_at)
VALUES ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', 'note', now() - interval '1 month');

-- Entreprise du compte B : vieille sans suite, mais B n'a pas activé le nettoyage
INSERT INTO public.companies (id, user_id, name, created_at, collected_at) VALUES
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', 'B vieille sans suite', now() - interval '4 years', now() - interval '4 years');
INSERT INTO public.company_contacts (user_id, company_id, first_name, last_name)
VALUES ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'Bruno', 'Bdonnées');

-- Posts LinkedIn de 40 jours, non retenus : A garde 60 jours, B la durée par défaut (30)
INSERT INTO public.linkedin_posts (user_id, post_urn, post_url, author_name, text, created_at) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'urn:li:activity:900000000001', 'https://www.linkedin.com/feed/', 'Auteur A', 'Post A', now() - interval '40 days'),
  ('00000000-0000-4000-8000-00000000000b', 'urn:li:activity:900000000002', 'https://www.linkedin.com/feed/', 'Auteur B', 'Post B', now() - interval '40 days');

-- ---------------------------------------------------------------------
-- Connecté en tant que A
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

DO $$
DECLARE
  n INTEGER;
  preview RECORD;
BEGIN
  -- 1. Isolation : A ne voit, ne modifie et n'efface rien de B
  SELECT count(*) INTO n FROM public.companies WHERE user_id = '00000000-0000-4000-8000-00000000000b';
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A voit % entreprise(s) de B', n; END IF;

  SELECT count(*) INTO n FROM public.company_contacts WHERE user_id = '00000000-0000-4000-8000-00000000000b';
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A voit % contact(s) de B', n; END IF;

  SELECT count(*) INTO n FROM public.linkedin_posts WHERE user_id = '00000000-0000-4000-8000-00000000000b';
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A voit % post(s) de B', n; END IF;

  UPDATE public.companies SET name = 'piraté' WHERE id = '00000000-0000-4000-8000-0000000000b1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A a modifié une entreprise de B'; END IF;

  DELETE FROM public.companies WHERE id = '00000000-0000-4000-8000-0000000000b1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A a effacé une entreprise de B'; END IF;

  BEGIN
    INSERT INTO public.companies (user_id, name) VALUES ('00000000-0000-4000-8000-00000000000b', 'Intrus');
    RAISE EXCEPTION 'ÉCHEC isolation : A a créé une entreprise dans le compte de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT count(*) INTO n FROM public.retention_candidate_companies('00000000-0000-4000-8000-00000000000b', 36);
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A voit les candidats au nettoyage de B'; END IF;

  -- 2. Secrets : A ne peut pas lire une clé déchiffrée, même la sienne
  BEGIN
    PERFORM public.read_user_api_key('00000000-0000-4000-8000-00000000000a', 'openai');
    RAISE EXCEPTION 'ÉCHEC secrets : read_user_api_key est appelable depuis le site';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 3. Journal : en ajout seul, impossible à falsifier ou effacer
  BEGIN
    INSERT INTO public.data_access_log (user_id, action) VALUES ('00000000-0000-4000-8000-00000000000a', 'export_account');
    RAISE EXCEPTION 'ÉCHEC journal : écriture directe possible';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.log_my_data_access('retention_purge', '{}'::jsonb);
    RAISE EXCEPTION 'ÉCHEC journal : le site peut inscrire un faux nettoyage';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.log_my_data_access('export_account', '{"companies": 5}'::jsonb);

  -- Clé enregistrée : journalisée automatiquement
  PERFORM public.save_my_api_key('hunter', 'test-key-rgpd-0000000000000000', NULL);
  SELECT count(*) INTO n FROM public.data_access_log WHERE action = 'api_key_saved';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC journal : enregistrement de clé non journalisé (%)', n; END IF;

  -- 4. Conservation : aperçu, puis nettoyage refusé tant qu'il n'est pas activé
  SELECT * INTO preview FROM public.preview_my_retention(36);
  IF preview.companies <> 1 OR preview.contacts <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC conservation : aperçu % entreprise(s) / % contact(s), attendu 1 / 1', preview.companies, preview.contacts;
  END IF;

  n := public.purge_my_inactive_prospects();
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC conservation : nettoyage sans activation (% effacée(s))', n; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 5 THEN RAISE EXCEPTION 'ÉCHEC conservation : % entreprise(s) après un nettoyage désactivé, attendu 5', n; END IF;

  -- last_purge_at n'est pas modifiable depuis le site
  INSERT INTO public.data_retention_settings (user_id, inactive_prospect_months, auto_purge_enabled, linkedin_posts_days)
  VALUES ('00000000-0000-4000-8000-00000000000a', 36, true, 60);
  BEGIN
    UPDATE public.data_retention_settings SET last_purge_at = now() WHERE user_id = '00000000-0000-4000-8000-00000000000a';
    RAISE EXCEPTION 'ÉCHEC conservation : last_purge_at modifiable depuis le site';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A ne peut pas écrire les réglages de B
  BEGIN
    INSERT INTO public.data_retention_settings (user_id, auto_purge_enabled) VALUES ('00000000-0000-4000-8000-00000000000b', true);
    RAISE EXCEPTION 'ÉCHEC isolation : A a activé le nettoyage de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Nettoyage activé : seule la vieille fiche sans suite part
  n := public.purge_my_inactive_prospects();
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC conservation : % entreprise(s) effacée(s), attendu 1', n; END IF;
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'ÉCHEC conservation : la vieille fiche sans suite est toujours là';
  END IF;
  SELECT count(*) INTO n FROM public.companies WHERE id IN (
    '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a5');
  IF n <> 4 THEN RAISE EXCEPTION 'ÉCHEC conservation : une fiche protégée a été effacée (% restantes sur 4)', n; END IF;
  SELECT count(*) INTO n FROM public.company_contacts WHERE last_name = 'Ancienne';
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC conservation : le contact de la fiche effacée est resté'; END IF;

  -- Journal : réglage + nettoyage, avec des compteurs et aucun nom
  SELECT count(*) INTO n FROM public.data_access_log WHERE action = 'retention_changed';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC journal : changement de réglage non journalisé'; END IF;
  SELECT count(*) INTO n FROM public.data_access_log
   WHERE action = 'retention_purge' AND details->>'companies' = '1' AND details->>'contacts' = '1'
     AND details::text NOT LIKE '%Ancienne%';
  IF n <> 1 THEN RAISE EXCEPTION 'ÉCHEC journal : nettoyage mal journalisé'; END IF;

  -- A ne lit que son propre journal
  SELECT count(*) INTO n FROM public.data_access_log WHERE user_id <> '00000000-0000-4000-8000-00000000000a';
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC isolation : A lit le journal d''un autre compte'; END IF;
END;
$$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- Tâche de nuit, puis suppression du compte A
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n INTEGER;
  key_secret UUID;
BEGIN
  PERFORM public.apply_data_retention();

  -- B n'a pas activé le nettoyage : sa vieille fiche reste
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-4000-8000-0000000000b1') THEN
    RAISE EXCEPTION 'ÉCHEC conservation : la tâche de nuit a effacé une fiche d''un compte non volontaire';
  END IF;
  -- Posts : A (60 jours) garde son post de 40 jours, B (30 jours par défaut) le perd
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_posts WHERE post_urn = 'urn:li:activity:900000000001') THEN
    RAISE EXCEPTION 'ÉCHEC conservation : le post de A (gardé 60 jours) a été effacé';
  END IF;
  IF EXISTS (SELECT 1 FROM public.linkedin_posts WHERE post_urn = 'urn:li:activity:900000000002') THEN
    RAISE EXCEPTION 'ÉCHEC conservation : le post de B (30 jours par défaut) est resté';
  END IF;

  SELECT secret_id INTO key_secret FROM public.user_api_keys WHERE user_id = '00000000-0000-4000-8000-00000000000a';
  IF key_secret IS NULL THEN RAISE EXCEPTION 'ÉCHEC préparation : la clé de test de A est introuvable'; END IF;

  -- Suppression du compte A (ce que fait la fonction delete-account) : tout part, B reste intact
  DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000000a';

  SELECT (SELECT count(*) FROM public.companies WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.company_contacts WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.company_interactions WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.linkedin_posts WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.user_api_keys WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.data_retention_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.data_access_log WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.pipeline_stages WHERE user_id = '00000000-0000-4000-8000-00000000000a')
       + (SELECT count(*) FROM public.user_profiles WHERE id = '00000000-0000-4000-8000-00000000000a')
    INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC suppression : % ligne(s) du compte A restent après sa suppression', n; END IF;

  -- La clé chiffrée de A a quitté le coffre
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE id = key_secret) THEN
    RAISE EXCEPTION 'ÉCHEC suppression : la clé chiffrée de A est restée dans le coffre';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = '00000000-0000-4000-8000-0000000000b1') THEN
    RAISE EXCEPTION 'ÉCHEC suppression : les données de B ont été touchées';
  END IF;
END;
$$;

SELECT 'RGPD : tous les tests passent' AS resultat;

ROLLBACK;

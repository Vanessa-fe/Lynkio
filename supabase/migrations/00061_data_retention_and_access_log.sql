-- =====================================================================
-- Conformité RGPD : conservation configurable + journal d'accès aux données
-- =====================================================================
--
-- 1. data_retention_settings : chaque compte choisit combien de temps garder un prospect
--    resté sans suite (6, 12, 24 ou 36 mois, 36 par défaut, la durée recommandée par la CNIL
--    pour la prospection) et combien de jours garder les posts LinkedIn non retenus (30 par défaut,
--    comme avant). Le nettoyage automatique des prospects est DÉSACTIVÉ par défaut : rien n'est
--    effacé tant que la personne ne l'a pas activé elle-même.
-- 2. data_access_log : journal en ajout seul (exports, clés, réglages, nettoyages), lisible par
--    son propriétaire, gardé 12 mois. Personne ne peut le modifier ni l'effacer depuis l'app.
-- 3. Tâches de nuit : nettoyage des prospects (comptes volontaires seulement), des posts LinkedIn
--    (durée du compte, 30 jours sinon : même comportement qu'avant) et du journal lui-même.

-- ---------------------------------------------------------------------
-- 1. Réglages de conservation
-- ---------------------------------------------------------------------
CREATE TABLE public.data_retention_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inactive_prospect_months INTEGER NOT NULL DEFAULT 36 CHECK (inactive_prospect_months IN (6, 12, 24, 36)),
  auto_purge_enabled BOOLEAN NOT NULL DEFAULT false,
  linkedin_posts_days INTEGER NOT NULL DEFAULT 30 CHECK (linkedin_posts_days IN (7, 14, 30, 60, 90)),
  last_purge_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_retention_settings IS 'Durées de conservation choisies par le compte (sans ligne : valeurs par défaut, nettoyage des prospects désactivé)';

ALTER TABLE public.data_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own retention settings"
  ON public.data_retention_settings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own retention settings"
  ON public.data_retention_settings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND last_purge_at IS NULL);
CREATE POLICY "Users can update their own retention settings"
  ON public.data_retention_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- last_purge_at n'est écrit que par le nettoyage (fonction serveur), jamais par l'app
REVOKE UPDATE ON public.data_retention_settings FROM anon, authenticated;
GRANT UPDATE (inactive_prospect_months, auto_purge_enabled, linkedin_posts_days, updated_at)
  ON public.data_retention_settings TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Journal d'accès (ajout seul)
-- ---------------------------------------------------------------------
CREATE TABLE public.data_access_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'export_companies', 'export_waalaxy', 'export_account',
    'api_key_saved', 'api_key_deleted',
    'retention_changed', 'retention_purge'
  )),
  -- Jamais de donnée personnelle de prospect ici : des compteurs et des noms de service seulement
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object' AND length(details::text) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_access_log_user ON public.data_access_log(user_id, created_at DESC);

COMMENT ON TABLE public.data_access_log IS 'Journal des accès sensibles aux données du compte (exports, clés, conservation) : ajout seul, gardé 12 mois';

ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access log"
  ON public.data_access_log FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Aucune politique d'écriture : seules les fonctions ci-dessous (SECURITY DEFINER) écrivent
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.data_access_log FROM anon, authenticated;

/**
 * Inscrit une action de l'utilisateur connecté dans son journal (exports, appelés par le site)
 */
CREATE FUNCTION public.log_my_data_access(p_action TEXT, p_details JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  -- Le site ne peut inscrire que des exports ; le reste est inscrit par la base elle-même
  IF p_action NOT IN ('export_companies', 'export_waalaxy', 'export_account') THEN
    RAISE EXCEPTION 'Action not allowed' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.data_access_log (user_id, action, details)
  VALUES (auth.uid(), p_action, COALESCE(p_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_my_data_access(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_my_data_access(TEXT, JSONB) TO authenticated;

-- Clés personnelles : chaque enregistrement ou suppression est journalisé, quel que soit le chemin
CREATE FUNCTION public.log_api_key_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Suppression du compte : la ligne de l'utilisateur n'existe plus, rien à journaliser
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
      INSERT INTO public.data_access_log (user_id, action, details)
      VALUES (OLD.user_id, 'api_key_deleted', jsonb_build_object('provider', OLD.provider));
    END IF;
    RETURN OLD;
  END IF;
  INSERT INTO public.data_access_log (user_id, action, details)
  VALUES (NEW.user_id, 'api_key_saved', jsonb_build_object('provider', NEW.provider));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_api_key_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_api_keys_access_log
  AFTER INSERT OR UPDATE OF secret_id, key_hint OR DELETE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.log_api_key_change();

-- Réglages de conservation : chaque changement est journalisé
CREATE FUNCTION public.log_retention_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.inactive_prospect_months = OLD.inactive_prospect_months
     AND NEW.auto_purge_enabled = OLD.auto_purge_enabled
     AND NEW.linkedin_posts_days = OLD.linkedin_posts_days THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.data_access_log (user_id, action, details)
  VALUES (NEW.user_id, 'retention_changed', jsonb_build_object(
    'inactive_prospect_months', NEW.inactive_prospect_months,
    'auto_purge_enabled', NEW.auto_purge_enabled,
    'linkedin_posts_days', NEW.linkedin_posts_days
  ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_retention_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER data_retention_settings_access_log
  AFTER INSERT OR UPDATE ON public.data_retention_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_retention_change();

-- ---------------------------------------------------------------------
-- 3. Prospects restés sans suite
-- ---------------------------------------------------------------------

/**
 * Entreprises d'un compte restées sans suite depuis p_months mois. Gardées dans tous les cas :
 * - un client (étape gagnée) : la relation commerciale existe ;
 * - une fiche avec un échange, un signal ou une collecte récents ;
 * - une fiche avec un rappel non terminé ;
 * - une fiche dont un contact a demandé à ne plus être contacté (l'opposition doit être retenue,
 *   sinon Sophie pourrait la retrouver et la reproposer).
 * SECURITY INVOKER : appelée par l'utilisateur, elle ne voit que ses lignes (RLS).
 */
CREATE FUNCTION public.retention_candidate_companies(p_user_id UUID, p_months INTEGER)
RETURNS TABLE (company_id UUID)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT c.id
    FROM public.companies c
    LEFT JOIN public.pipeline_stages s ON s.id = c.stage_id
   WHERE c.user_id = p_user_id
     AND p_months IN (6, 12, 24, 36)
     AND GREATEST(c.created_at, COALESCE(c.collected_at, c.created_at), COALESCE(c.last_interaction_at, c.created_at))
         < now() - make_interval(months => p_months)
     AND COALESCE(s.kind, 'open') <> 'won'
     AND NOT EXISTS (
       SELECT 1 FROM public.company_interactions i
        WHERE i.company_id = c.id AND i.occurred_at >= now() - make_interval(months => p_months))
     AND NOT EXISTS (
       SELECT 1 FROM public.company_signals sig
        WHERE sig.company_id = c.id AND sig.detected_at >= now() - make_interval(months => p_months))
     AND NOT EXISTS (
       SELECT 1 FROM public.reminders r WHERE r.company_id = c.id AND r.completed_at IS NULL)
     AND NOT EXISTS (
       SELECT 1 FROM public.company_contacts cc WHERE cc.company_id = c.id AND cc.opted_out_at IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.retention_candidate_companies(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retention_candidate_companies(UUID, INTEGER) TO authenticated;

/**
 * Aperçu pour l'utilisateur connecté : combien d'entreprises et de contacts seraient effacés
 * avec la durée p_months. N'efface rien.
 */
CREATE FUNCTION public.preview_my_retention(p_months INTEGER)
RETURNS TABLE (companies INTEGER, contacts INTEGER)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT company_id FROM public.retention_candidate_companies((select auth.uid()), p_months)
  )
  SELECT
    (SELECT count(*)::INTEGER FROM candidates),
    (SELECT count(*)::INTEGER FROM public.company_contacts cc WHERE cc.company_id IN (SELECT company_id FROM candidates));
$$;

REVOKE ALL ON FUNCTION public.preview_my_retention(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_my_retention(INTEGER) TO authenticated;

/**
 * Efface les prospects sans suite d'un compte selon SES réglages, s'il a activé le nettoyage.
 * Retourne le nombre d'entreprises effacées (contacts, échanges et signaux suivent en cascade).
 */
CREATE FUNCTION public.purge_user_inactive_prospects(p_user_id UUID, p_trigger TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings public.data_retention_settings;
  removed_contacts INTEGER;
  removed INTEGER;
BEGIN
  SELECT * INTO settings FROM public.data_retention_settings WHERE user_id = p_user_id;
  IF NOT FOUND OR NOT settings.auto_purge_enabled THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO removed_contacts
    FROM public.company_contacts cc
   WHERE cc.company_id IN (SELECT company_id FROM public.retention_candidate_companies(p_user_id, settings.inactive_prospect_months));

  DELETE FROM public.companies c
   WHERE c.user_id = p_user_id
     AND c.id IN (SELECT company_id FROM public.retention_candidate_companies(p_user_id, settings.inactive_prospect_months));
  GET DIAGNOSTICS removed = ROW_COUNT;

  UPDATE public.data_retention_settings SET last_purge_at = now() WHERE user_id = p_user_id;

  IF removed > 0 OR p_trigger = 'manual' THEN
    INSERT INTO public.data_access_log (user_id, action, details)
    VALUES (p_user_id, 'retention_purge', jsonb_build_object(
      'trigger', p_trigger,
      'months', settings.inactive_prospect_months,
      'companies', removed,
      'contacts', removed_contacts
    ));
  END IF;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_user_inactive_prospects(UUID, TEXT) FROM PUBLIC, anon, authenticated;

/**
 * « Nettoyer maintenant » : applique tout de suite les réglages de l'utilisateur connecté
 * (uniquement s'il a activé le nettoyage)
 */
CREATE FUNCTION public.purge_my_inactive_prospects()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN public.purge_user_inactive_prospects(auth.uid(), 'manual');
END;
$$;

REVOKE ALL ON FUNCTION public.purge_my_inactive_prospects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_my_inactive_prospects() TO authenticated;

/**
 * Tâche de nuit : comptes volontaires, posts LinkedIn non retenus, journal de plus de 12 mois
 */
CREATE FUNCTION public.apply_data_retention()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account RECORD;
BEGIN
  FOR account IN SELECT user_id FROM public.data_retention_settings WHERE auto_purge_enabled LOOP
    PERFORM public.purge_user_inactive_prospects(account.user_id, 'schedule');
  END LOOP;

  -- Posts LinkedIn non retenus : durée choisie par le compte, 30 jours sinon (comportement d'avant)
  DELETE FROM public.linkedin_posts p
   WHERE p.status <> 'added'
     AND p.created_at < now() - make_interval(days => COALESCE(
       (SELECT r.linkedin_posts_days FROM public.data_retention_settings r WHERE r.user_id = p.user_id), 30));

  DELETE FROM public.data_access_log WHERE created_at < now() - interval '12 months';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_data_retention() FROM PUBLIC, anon, authenticated;

-- La tâche « linkedin-posts-retention » (30 jours fixes) est remplacée par apply_data_retention
SELECT cron.unschedule('linkedin-posts-retention')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'linkedin-posts-retention');
SELECT cron.schedule('data-retention', '15 3 * * *', $$ SELECT public.apply_data_retention(); $$);

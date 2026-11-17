-- =====================================================================
-- ASSISTANT « SIMPLIFIER MON PIPELINE » (lot 1.11 de la refonte, §4.2-E)
-- Proposé aux comptes créés avec les anciennes étapes, lancé seulement par
-- l'utilisateur, après un aperçu avant / après. Chaque proposition est
-- facultative :
--   arrival      retirer l'étape d'arrivée sans rôle (« À qualifier ») :
--                l'étape « à contacter » devient l'étape d'arrivée et
--                reçoit ses entreprises (les découvertes restent des
--                découvertes : engaged_at n'est pas touché)
--   followed_up  retirer « Relancé » : ses entreprises passent dans
--                l'étape « contacté » (les relances restent dans les échanges)
--   negotiation  ajouter « Négociation » après la proposition
--   rename       « Gagné » -> « Signé », « Perdu » -> « Non concrétisé »
--                (noms d'origine exacts seulement)
--
-- Tout ou rien (une transaction). Droits de l'utilisateur (SECURITY
-- INVOKER, RLS). Chaque condition est revérifiée ici : une proposition
-- devenue inutile est simplement ignorée. Aucune entreprise, aucun échange,
-- aucun historique n'est supprimé ; ces déplacements techniques ne sont pas
-- notés comme des changements d'étape commerciaux.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.simplify_pipeline(p_steps TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  arrival pipeline_stages%ROWTYPE;
  to_contact pipeline_stages%ROWTYPE;
  followed pipeline_stages%ROWTYPE;
  contacted pipeline_stages%ROWTYPE;
  anchor pipeline_stages%ROWTYPE;
  applied TEXT[] := '{}';
  moved_arrival INT := 0;
  moved_followed INT := 0;
  renamed INT := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Vous devez être connecté';
  END IF;

  -- Déplacements techniques : pas d'entrée « changement d'étape » dans la chronologie
  PERFORM set_config('filonea.stage_change_undo', '1', true);

  IF 'arrival' = ANY (p_steps) THEN
    SELECT * INTO arrival FROM pipeline_stages WHERE user_id = uid AND is_default;
    SELECT * INTO to_contact FROM pipeline_stages WHERE user_id = uid AND role = 'to_contact';
    IF arrival.id IS NOT NULL AND to_contact.id IS NOT NULL AND arrival.id <> to_contact.id
       AND arrival.role IS NULL AND arrival.kind = 'open' THEN
      -- L'étape d'arrivée change d'abord : y déplacer une découverte ne la fait pas entrer dans le suivi
      UPDATE pipeline_stages SET is_default = false WHERE id = arrival.id;
      UPDATE pipeline_stages SET is_default = true WHERE id = to_contact.id;
      UPDATE companies SET stage_id = to_contact.id WHERE user_id = uid AND stage_id = arrival.id;
      GET DIAGNOSTICS moved_arrival = ROW_COUNT;
      DELETE FROM pipeline_stages WHERE id = arrival.id;
      applied := array_append(applied, 'arrival');
    END IF;
  END IF;

  IF 'followed_up' = ANY (p_steps) THEN
    SELECT * INTO followed FROM pipeline_stages WHERE user_id = uid AND role = 'followed_up';
    SELECT * INTO contacted FROM pipeline_stages WHERE user_id = uid AND role = 'contacted';
    IF followed.id IS NOT NULL AND contacted.id IS NOT NULL AND NOT followed.is_default THEN
      UPDATE companies SET stage_id = contacted.id WHERE user_id = uid AND stage_id = followed.id;
      GET DIAGNOSTICS moved_followed = ROW_COUNT;
      DELETE FROM pipeline_stages WHERE id = followed.id;
      applied := array_append(applied, 'followed_up');
    END IF;
  END IF;

  IF 'negotiation' = ANY (p_steps)
     AND NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = uid AND (role = 'negotiation' OR name = 'Négociation')) THEN
    SELECT * INTO anchor FROM pipeline_stages WHERE user_id = uid AND role = 'proposal';
    IF anchor.id IS NULL THEN
      SELECT * INTO anchor FROM pipeline_stages WHERE user_id = uid AND kind = 'open' ORDER BY "order" DESC LIMIT 1;
    END IF;
    IF anchor.id IS NOT NULL THEN
      UPDATE pipeline_stages SET "order" = "order" + 1 WHERE user_id = uid AND "order" > anchor."order";
      INSERT INTO pipeline_stages (user_id, name, color, kind, role, "order", is_default)
      VALUES (uid, 'Négociation', '#8b5cf6', 'open', 'negotiation', anchor."order" + 1, false);
      applied := array_append(applied, 'negotiation');
    END IF;
  END IF;

  IF 'rename' = ANY (p_steps) THEN
    UPDATE pipeline_stages SET name = 'Signé'
    WHERE user_id = uid AND kind = 'won' AND role IS NULL AND name = 'Gagné'
      AND NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = uid AND name = 'Signé');
    GET DIAGNOSTICS renamed = ROW_COUNT;
    UPDATE pipeline_stages SET name = 'Non concrétisé'
    WHERE user_id = uid AND kind = 'lost' AND role = 'not_concluded' AND name = 'Perdu'
      AND NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = uid AND name = 'Non concrétisé');
    IF FOUND THEN
      renamed := renamed + 1;
    END IF;
    IF renamed > 0 THEN
      applied := array_append(applied, 'rename');
    END IF;
  END IF;

  -- Positions remises de 0 à n, dans le même ordre
  UPDATE pipeline_stages s SET "order" = ranked.position
  FROM (
    SELECT id, (row_number() OVER (ORDER BY "order", created_at) - 1)::int AS position
    FROM pipeline_stages WHERE user_id = uid
  ) ranked
  WHERE s.id = ranked.id AND s."order" IS DISTINCT FROM ranked.position;

  PERFORM set_config('filonea.stage_change_undo', '', true);

  RETURN jsonb_build_object(
    'applied', to_jsonb(applied),
    'movedFromArrival', moved_arrival,
    'movedFromFollowedUp', moved_followed,
    'renamed', renamed
  );
END;
$$;

COMMENT ON FUNCTION public.simplify_pipeline(TEXT[]) IS 'Assistant « Simplifier mon pipeline » : applique les propositions choisies par l''utilisateur, tout ou rien, avec ses droits';

REVOKE ALL ON FUNCTION public.simplify_pipeline(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simplify_pipeline(TEXT[]) TO authenticated;

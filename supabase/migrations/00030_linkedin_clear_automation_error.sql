-- =====================================================================
-- ENVOI LINKEDIN AUTOMATIQUE : une erreur ne vaut que pour son étape
-- Quand une étape est franchie (par l'extension ou à la main), l'erreur que
-- l'extension avait notée pour la personne est effacée : elle reprend la main
-- à l'étape suivante.
-- =====================================================================

CREATE OR REPLACE FUNCTION advance_linkedin_sequence(p_sequence_id UUID, p_step TEXT)
RETURNS linkedin_sequences
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  seq linkedin_sequences%ROWTYPE;
  previous_status TEXT;
  person company_contacts%ROWTYPE;
  allowed TEXT[];
BEGIN
  allowed := CASE p_step
    WHEN 'invited' THEN ARRAY['approved']
    -- Depuis « approved » : la personne était déjà dans le réseau, pas d'invitation
    WHEN 'connected' THEN ARRAY['approved', 'invited']
    WHEN 'messaged' THEN ARRAY['connected']
    WHEN 'followed_up_1' THEN ARRAY['messaged']
    WHEN 'followed_up_2' THEN ARRAY['followed_up_1']
    WHEN 'replied' THEN ARRAY['invited', 'connected', 'messaged', 'followed_up_1', 'followed_up_2']
    WHEN 'stopped' THEN ARRAY['approved', 'invited', 'connected', 'messaged', 'followed_up_1']
  END;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Étape inconnue';
  END IF;

  SELECT * INTO seq FROM linkedin_sequences WHERE id = p_sequence_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envoi introuvable';
  END IF;
  IF NOT (seq.status = ANY (allowed)) THEN
    RAISE EXCEPTION 'Cette étape est déjà passée';
  END IF;

  SELECT * INTO person FROM company_contacts WHERE id = seq.contact_id;
  IF p_step IN ('invited', 'messaged', 'followed_up_1', 'followed_up_2') AND person.opted_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette personne ne souhaite plus être contactée';
  END IF;
  IF (p_step = 'messaged' AND coalesce(trim(seq.message), '') = '')
     OR (p_step = 'followed_up_1' AND coalesce(trim(seq.follow_up_1), '') = '')
     OR (p_step = 'followed_up_2' AND coalesce(trim(seq.follow_up_2), '') = '') THEN
    RAISE EXCEPTION 'Le message est vide';
  END IF;

  previous_status := seq.status;

  UPDATE linkedin_sequences
     SET status = p_step,
         invited_at = CASE WHEN p_step = 'invited' THEN now() ELSE invited_at END,
         connected_at = CASE WHEN p_step = 'connected' THEN now() ELSE connected_at END,
         messaged_at = CASE WHEN p_step = 'messaged' THEN now() ELSE messaged_at END,
         follow_up_1_at = CASE WHEN p_step = 'followed_up_1' THEN now() ELSE follow_up_1_at END,
         follow_up_2_at = CASE WHEN p_step = 'followed_up_2' THEN now() ELSE follow_up_2_at END,
         replied_at = CASE WHEN p_step = 'replied' THEN now() ELSE replied_at END,
         stopped_at = CASE WHEN p_step = 'stopped' THEN now() ELSE stopped_at END,
         -- Une erreur de l'extension ne vaut que pour l'étape où elle s'est produite
         automation_error = NULL,
         automation_error_at = NULL
   WHERE id = seq.id
  RETURNING * INTO seq;

  INSERT INTO company_interactions (user_id, company_id, contact_id, type, direction, status, occurred_at, subject, content)
  SELECT seq.user_id, person.company_id, person.id, e.type, e.direction, 'done', now(), e.subject, e.content
    FROM (
      SELECT 'system_event' AS type, NULL::text AS direction, 'Invitation LinkedIn envoyée' AS subject, NULL::text AS content
       WHERE p_step = 'invited'
      UNION ALL
      SELECT 'system_event', NULL, 'Invitation LinkedIn acceptée', NULL
       WHERE p_step = 'connected' AND previous_status = 'invited'
      UNION ALL
      SELECT 'linkedin_message', 'outgoing', 'Message LinkedIn', seq.message
       WHERE p_step = 'messaged'
      UNION ALL
      SELECT 'linkedin_message', 'outgoing', 'Relance LinkedIn', seq.follow_up_1
       WHERE p_step = 'followed_up_1'
      UNION ALL
      SELECT 'linkedin_message', 'outgoing', 'Dernière relance LinkedIn', seq.follow_up_2
       WHERE p_step = 'followed_up_2'
      UNION ALL
      SELECT 'linkedin_message', 'incoming', 'Réponse LinkedIn', NULL
       WHERE p_step = 'replied'
    ) AS e;

  RETURN seq;
END;
$$;

REVOKE ALL ON FUNCTION advance_linkedin_sequence(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION advance_linkedin_sequence(UUID, TEXT) TO authenticated;

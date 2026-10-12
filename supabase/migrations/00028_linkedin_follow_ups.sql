-- =====================================================================
-- ENVOI LINKEDIN : LES DEUX RELANCES
-- Sophie rédige la séquence entière d'un coup, relue et validée une fois :
-- le message (après l'acceptation), une relance 5 jours plus tard, puis un
-- message de sortie 7 jours après. Une relance vidée n'est pas envoyée.
-- Tout s'arrête dès que la personne répond.
-- =====================================================================

ALTER TABLE linkedin_sequences
  ADD COLUMN follow_up_1 TEXT CHECK (follow_up_1 IS NULL OR length(follow_up_1) <= 2000),
  ADD COLUMN follow_up_2 TEXT CHECK (follow_up_2 IS NULL OR length(follow_up_2) <= 2000),
  ADD COLUMN follow_up_1_at TIMESTAMPTZ,
  ADD COLUMN follow_up_2_at TIMESTAMPTZ;

COMMENT ON COLUMN linkedin_sequences.follow_up_1 IS 'Relance 1, à envoyer 5 jours après le message (vide : pas de relance)';
COMMENT ON COLUMN linkedin_sequences.follow_up_2 IS 'Message de sortie, à envoyer 7 jours après la relance 1 (vide : pas de second envoi)';

ALTER TABLE linkedin_sequences DROP CONSTRAINT linkedin_sequences_status_check;
ALTER TABLE linkedin_sequences ADD CONSTRAINT linkedin_sequences_status_check
  CHECK (status IN ('to_review', 'approved', 'invited', 'connected', 'messaged', 'followed_up_1', 'followed_up_2', 'replied', 'stopped'));

COMMENT ON TABLE linkedin_sequences IS 'Envoi LinkedIn, une ligne par personne : to_review → approved → invited → connected → messaged → followed_up_1 → followed_up_2, ou replied / stopped';

-- ---------------------------------------------------------------------
-- Les relances deviennent des étapes, notées dans les échanges comme le message
-- ---------------------------------------------------------------------
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
         stopped_at = CASE WHEN p_step = 'stopped' THEN now() ELSE stopped_at END
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

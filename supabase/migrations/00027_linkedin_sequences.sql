-- =====================================================================
-- ENVOI LINKEDIN
-- Une « séquence » par personne : invitation (sans note), puis message de
-- Sophie une fois l'invitation acceptée. Les relances viendront ensuite.
-- - Rien ne part sans validation : Sophie rédige (to_review), l'utilisatrice
--   relit et valide (approved).
-- - Chaque étape franchie est aussi notée dans les échanges de la personne :
--   son statut et l'étape de sa fiche suivent comme pour un envoi noté à la main.
-- =====================================================================

CREATE TABLE linkedin_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  -- Liste d'où vient la personne (pour mémoire)
  list_id UUID REFERENCES prospect_lists(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'to_review'
    CHECK (status IN ('to_review', 'approved', 'invited', 'connected', 'messaged', 'replied', 'stopped')),
  -- Message de Sophie, tel que l'utilisatrice l'a validé
  message TEXT CHECK (message IS NULL OR length(message) <= 2000),
  -- Sur quoi repose le message (donné par Sophie), pour la relecture
  message_angle TEXT CHECK (message_angle IS NULL OR length(message_angle) <= 500),
  invited_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  messaged_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (contact_id, user_id) REFERENCES company_contacts(id, user_id) ON DELETE CASCADE
);

-- Une seule séquence en cours par personne
CREATE UNIQUE INDEX uq_linkedin_sequences_active ON linkedin_sequences(contact_id) WHERE status <> 'stopped';
CREATE INDEX idx_linkedin_sequences_user_status ON linkedin_sequences(user_id, status);

COMMENT ON TABLE linkedin_sequences IS 'Envoi LinkedIn, une ligne par personne : to_review → approved → invited → connected → messaged → replied (ou stopped)';

CREATE TRIGGER update_linkedin_sequences_updated_at
  BEFORE UPDATE ON linkedin_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE linkedin_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rows" ON linkedin_sequences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own rows" ON linkedin_sequences
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own rows" ON linkedin_sequences
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own rows" ON linkedin_sequences
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Franchir une étape et la noter dans les échanges, d'un seul coup.
-- L'étape doit suivre la précédente : un double clic ne note rien deux fois.
-- SECURITY INVOKER : la RLS s'applique, chacun n'avance que ses séquences.
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
    WHEN 'replied' THEN ARRAY['invited', 'connected', 'messaged']
    WHEN 'stopped' THEN ARRAY['approved', 'invited', 'connected', 'messaged']
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
  IF p_step IN ('invited', 'messaged') AND person.opted_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette personne ne souhaite plus être contactée';
  END IF;
  IF p_step = 'messaged' AND coalesce(trim(seq.message), '') = '' THEN
    RAISE EXCEPTION 'Le message est vide';
  END IF;

  previous_status := seq.status;

  UPDATE linkedin_sequences
     SET status = p_step,
         invited_at = CASE WHEN p_step = 'invited' THEN now() ELSE invited_at END,
         connected_at = CASE WHEN p_step = 'connected' THEN now() ELSE connected_at END,
         messaged_at = CASE WHEN p_step = 'messaged' THEN now() ELSE messaged_at END,
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
      SELECT 'linkedin_message', 'incoming', 'Réponse LinkedIn', NULL
       WHERE p_step = 'replied'
    ) AS e;

  RETURN seq;
END;
$$;

REVOKE ALL ON FUNCTION advance_linkedin_sequence(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION advance_linkedin_sequence(UUID, TEXT) TO authenticated;

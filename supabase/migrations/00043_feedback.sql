-- Boîte à idées (demande du 11/11/2026) : besoins, idées de fonctions, points à améliorer, problèmes.
-- Chaque compte écrit et relit ses propres messages ; l'équipe les reçoit aussi par e-mail.
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('idea', 'improvement', 'problem', 'other')),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 5 AND 2000),
  -- Page d'où le message a été envoyé, pour le contexte
  page TEXT CHECK (page IS NULL OR char_length(page) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feedback IS 'Boîte à idées : messages des utilisateurs à l''équipe';

CREATE INDEX idx_feedback_user_created ON feedback(user_id, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own feedback"
  ON feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can send feedback"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =====================================================================
-- POSTS LINKEDIN « JE CHERCHE UN FREELANCE »
-- L'extension cherche, toutes les 2 heures, les posts LinkedIn récents qui
-- contiennent les mots-clés de l'utilisatrice. La fonction linkedin-posts les
-- trie (doublons, intermédiaires, hors métier) et les garde ici :
-- l'utilisatrice ajoute ceux qui l'intéressent (la personne, son entreprise
-- et le signal) ou les ignore. Rien n'entre dans Personnes sans elle.
-- RGPD : un post qui n'a pas été ajouté est effacé au bout de 30 jours.
-- =====================================================================

ALTER TABLE linkedin_automation
  -- Interrupteur à part : la recherche ne dépend pas de l'envoi automatique
  ADD COLUMN post_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN post_keywords TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(post_keywords) <= 5),
  -- Dernière recherche de l'extension, affichée dans Filonea
  ADD COLUMN post_search_at TIMESTAMPTZ;

CREATE TABLE linkedin_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- urn:li:activity:… : un même post n'est gardé qu'une fois
  post_urn TEXT NOT NULL CHECK (post_urn ~ '^urn:li:[A-Za-z]+:[0-9]+$'),
  post_url TEXT NOT NULL CHECK (length(post_url) <= 500),
  author_name TEXT NOT NULL CHECK (length(author_name) <= 200),
  author_headline TEXT CHECK (author_headline IS NULL OR length(author_headline) <= 500),
  author_linkedin_url TEXT CHECK (author_linkedin_url IS NULL OR length(author_linkedin_url) <= 500),
  text TEXT NOT NULL CHECK (length(text) <= 5000),
  -- Date approximative : LinkedIn ne donne qu'un « il y a 3 h »
  posted_at TIMESTAMPTZ,
  keyword TEXT CHECK (keyword IS NULL OR length(keyword) <= 100),
  -- Ce que Sophie a compris du post
  summary TEXT CHECK (summary IS NULL OR length(summary) <= 300),
  company_name TEXT CHECK (company_name IS NULL OR length(company_name) <= 200),
  -- E-mail écrit dans le post par son auteur
  email TEXT CHECK (email IS NULL OR length(email) <= 255),
  -- new : à traiter ; filtered : écarté par Sophie (raison donnée) ; dismissed : ignoré ; added : ajouté
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'filtered', 'dismissed', 'added')),
  filter_reason TEXT CHECK (filter_reason IS NULL OR length(filter_reason) <= 300),
  company_id UUID,
  contact_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_urn),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE SET NULL (company_id),
  FOREIGN KEY (contact_id, user_id) REFERENCES company_contacts(id, user_id) ON DELETE SET NULL (contact_id)
);

COMMENT ON TABLE linkedin_posts IS 'Posts LinkedIn trouvés par l''extension et triés par Sophie, à ajouter ou ignorer';

CREATE INDEX idx_linkedin_posts_user_status ON linkedin_posts(user_id, status, created_at DESC);

CREATE TRIGGER update_linkedin_posts_updated_at
  BEFORE UPDATE ON linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Écrits par la fonction linkedin-posts (clé de service) ; l'utilisatrice les lit, les ignore ou les ajoute
ALTER TABLE linkedin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rows" ON linkedin_posts
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own rows" ON linkedin_posts
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- La demande est explicite : mieux pondérée qu'une mission freelance (40)
INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('linkedin_post_request', 'Cherche un freelance sur LinkedIn',
   'Post LinkedIn où la personne cherche un freelance pour une mission', 21)
ON CONFLICT (key) DO NOTHING;

INSERT INTO profession_signals (profession_key, signal_type, default_weight) VALUES
  ('web_developer', 'linkedin_post_request', 45)
ON CONFLICT (profession_key, signal_type) DO NOTHING;

-- L'e-mail d'une personne peut venir de son post
ALTER TABLE company_contacts DROP CONSTRAINT company_contacts_email_source_check;
ALTER TABLE company_contacts ADD CONSTRAINT company_contacts_email_source_check
  CHECK (email_source IN ('manual', 'hunter', 'website', 'linkedin_post', 'other'));

-- Chaque nuit : les posts qui n'ont pas été ajoutés sont effacés après 30 jours
SELECT cron.schedule(
  'linkedin-posts-retention',
  '15 3 * * *',
  $$DELETE FROM public.linkedin_posts WHERE status <> 'added' AND created_at < now() - interval '30 days'$$
);

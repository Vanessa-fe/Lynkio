-- =====================================================================
-- MODÈLE DE PROSPECTION MULTI-MÉTIERS
-- =====================================================================
-- Migration ADDITIVE (phase « expand ») : elle crée le nouveau modèle à
-- côté de l'ancien sans rien casser. Les anciens modules (contacts B2C,
-- agences, rendez-vous, paiements) seront supprimés dans une migration
-- séparée (phase « contract »), une fois l'application basculée dessus.
--
-- Principes :
--   * Le métier est de la CONFIGURATION, pas du code : ajouter un métier
--     = insérer des lignes dans `professions` et `profession_signals`.
--   * Un fait sur l'entreprise (sa stack, sa taille) vit sur `companies`.
--     Un ÉVÉNEMENT daté (elle recrute, son site est lent) vit dans
--     `company_signals`, avec une date d'expiration.
--   * Chaque table enfant porte `user_id` ET une clé étrangère composite
--     (parent_id, user_id) : impossible d'accrocher une donnée à
--     l'entreprise d'un autre utilisateur, même en forgeant une requête.
-- =====================================================================


-- =====================================================================
-- 1. CATALOGUES GLOBAUX (communs à tous les utilisateurs, lecture seule)
-- =====================================================================

-- Types de signaux d'achat. Chaque type correspond à un détecteur codé
-- dans l'application ; cette table en est le registre.
CREATE TABLE signal_types (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label TEXT NOT NULL,
  description TEXT,
  default_ttl_days INTEGER CHECK (default_ttl_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE signal_types IS 'Registre des types de signaux d''achat (un type = un détecteur dans le code)';
COMMENT ON COLUMN signal_types.default_ttl_days IS 'Durée de validité par défaut d''un signal de ce type. NULL = n''expire pas';

-- Métiers (playbooks) : ce qu'un freelance de ce métier cherche.
CREATE TABLE professions (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label TEXT NOT NULL,
  description TEXT,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  default_icp JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(default_icp) = 'object'),
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE professions IS 'Métiers de freelance supportés : postes à cibler, ICP par défaut. Ajouter un métier = insérer une ligne';
COMMENT ON COLUMN professions.target_roles IS 'Intitulés de poste des décideurs à contacter (remplace les mots-clés codés en dur dans find-contact)';
COMMENT ON COLUMN professions.default_icp IS 'Critères d''ICP proposés à l''onboarding, copiés dans icp_profiles puis modifiables';

-- Quels signaux comptent pour quel métier, et avec quel poids par défaut.
-- Table de liaison plutôt qu'un tableau TEXT[] : Postgres ne sait pas
-- vérifier une clé étrangère à l'intérieur d'un tableau.
CREATE TABLE profession_signals (
  profession_key TEXT NOT NULL REFERENCES professions(key) ON UPDATE CASCADE ON DELETE CASCADE,
  signal_type TEXT NOT NULL REFERENCES signal_types(key) ON UPDATE CASCADE ON DELETE CASCADE,
  default_weight SMALLINT NOT NULL DEFAULT 10 CHECK (default_weight BETWEEN -100 AND 100),
  PRIMARY KEY (profession_key, signal_type)
);

CREATE INDEX idx_profession_signals_signal_type ON profession_signals(signal_type);

COMMENT ON TABLE profession_signals IS 'Signaux pertinents pour chaque métier et leur poids par défaut dans le score';

-- Le métier choisi à l'onboarding
ALTER TABLE user_profiles
  ADD COLUMN profession_key TEXT REFERENCES professions(key) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX idx_user_profiles_profession_key ON user_profiles(profession_key);


-- =====================================================================
-- 2. PARAMÉTRAGE PAR UTILISATEUR
-- =====================================================================

-- Profils de client idéal. Un utilisateur peut en avoir plusieurs
-- (ex. « clients directs » et « agences en sous-traitance »).
CREATE TABLE icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profession_key TEXT REFERENCES professions(key) ON UPDATE CASCADE ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(criteria) = 'object'),
  signal_weights JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(signal_weights) = 'object'),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_icp_profiles_user_id ON icp_profiles(user_id);

COMMENT ON TABLE icp_profiles IS 'Profils de client idéal (ICP) d''un utilisateur, utilisés pour scorer les entreprises';
COMMENT ON COLUMN icp_profiles.criteria IS 'Critères éliminatoires et pondérés (format validé côté application par Zod)';
COMMENT ON COLUMN icp_profiles.signal_weights IS 'Surcharge des poids par défaut du métier, ex. {"job_posting_dev": 40}';
COMMENT ON COLUMN icp_profiles.version IS 'Incrémentée automatiquement à chaque changement de critères ou de poids';

-- Étapes du pipeline commercial (remplacent contact_statuses et agency_statuses)
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  kind TEXT NOT NULL DEFAULT 'open' CHECK (kind IN ('open', 'won', 'lost', 'excluded')),
  "order" INTEGER NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_pipeline_stages_order ON pipeline_stages(user_id, "order");
-- Un seul statut par défaut par utilisateur, garanti par la base
CREATE UNIQUE INDEX uq_pipeline_stages_one_default ON pipeline_stages(user_id) WHERE is_default;

COMMENT ON TABLE pipeline_stages IS 'Étapes personnalisables du pipeline commercial';
COMMENT ON COLUMN pipeline_stages.kind IS 'Nature de l''étape, pour les statistiques : open (en cours), won, lost, excluded (hors cible)';

-- Sources d'origine des prospects (remplacent contact_sources et agency_sources)
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  icon TEXT,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_lead_sources_order ON lead_sources(user_id, "order");

COMMENT ON TABLE lead_sources IS 'Sources personnalisables pour identifier l''origine des prospects';

-- Références (missions passées) : matière pour personnaliser les messages
CREATE TABLE portfolio_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  client_name TEXT,
  is_client_name_public BOOLEAN NOT NULL DEFAULT FALSE,
  sector TEXT,
  naf_code TEXT,
  summary TEXT NOT NULL,
  technologies TEXT[] NOT NULL DEFAULT '{}',
  url TEXT,
  year SMALLINT CHECK (year BETWEEN 1990 AND 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_references_user_id ON portfolio_references(user_id);

COMMENT ON TABLE portfolio_references IS 'Missions passées de l''utilisateur, citées dans les messages de prospection';
COMMENT ON COLUMN portfolio_references.is_client_name_public IS 'FALSE = le nom du client ne doit jamais apparaître dans un message (confidentialité)';


-- =====================================================================
-- 3. PROSPECTS
-- =====================================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  icp_profile_id UUID,
  stage_id UUID,
  source_id UUID,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'import', 'detector')),

  -- Identité
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  country CHAR(2) NOT NULL DEFAULT 'FR' CHECK (country ~ '^[A-Z]{2}$'),
  registration_id TEXT,
  legal_form TEXT,
  naf_code TEXT,
  sector TEXT,
  headcount_code TEXT,
  size_category TEXT CHECK (size_category IN ('solo', 'tpe', 'pme', 'eti', 'ge')),
  founded_on DATE,
  city TEXT,
  postal_code TEXT,

  -- Site web. Le domaine est calculé par la base, jamais par l'application :
  -- « https://www.Acme.fr/contact » et « acme.fr » donnent le même domaine,
  -- ce qui rend le dédoublonnage fiable quel que soit le code qui insère.
  website TEXT,
  website_domain TEXT GENERATED ALWAYS AS (
    NULLIF(
      lower(regexp_replace(regexp_replace(trim(website), '^(https?://)?(www\.)?', '', 'i'), '[/:?#].*$', '')),
      ''
    )
  ) STORED,
  detected_stack TEXT[] NOT NULL DEFAULT '{}',
  stack_detected_at TIMESTAMPTZ,

  -- Dénormalisé depuis company_qualifications (voir trigger) pour trier
  -- la liste sans jointure
  score SMALLINT CHECK (score BETWEEN 0 AND 100),
  scored_at TIMESTAMPTZ,

  notes TEXT,
  last_interaction_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (id, user_id),
  -- « SET NULL (colonne) » : ne remet à NULL que la colonne visée, pas
  -- user_id (qui est NOT NULL et fait partie de la clé composite)
  FOREIGN KEY (icp_profile_id, user_id) REFERENCES icp_profiles(id, user_id) ON DELETE SET NULL (icp_profile_id),
  FOREIGN KEY (stage_id, user_id) REFERENCES pipeline_stages(id, user_id) ON DELETE SET NULL (stage_id),
  FOREIGN KEY (source_id, user_id) REFERENCES lead_sources(id, user_id) ON DELETE SET NULL (source_id)
);

-- Dédoublonnage garanti par la base
CREATE UNIQUE INDEX uq_companies_registration ON companies(user_id, country, registration_id)
  WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX uq_companies_domain ON companies(user_id, website_domain)
  WHERE website_domain IS NOT NULL;

CREATE INDEX idx_companies_stage ON companies(user_id, stage_id);
CREATE INDEX idx_companies_score ON companies(user_id, score DESC NULLS LAST);
CREATE INDEX idx_companies_last_interaction ON companies(user_id, last_interaction_at DESC NULLS LAST);
CREATE INDEX idx_companies_icp_profile_id ON companies(icp_profile_id);
CREATE INDEX idx_companies_stage_id ON companies(stage_id);
CREATE INDEX idx_companies_source_id ON companies(source_id);
CREATE INDEX idx_companies_detected_stack ON companies USING GIN (detected_stack);

COMMENT ON TABLE companies IS 'Entreprises prospectées (tous métiers, tous canaux)';
COMMENT ON COLUMN companies.registration_id IS 'Identifiant officiel selon le pays : SIREN (FR), numéro BCE (BE), IDE (CH)';
COMMENT ON COLUMN companies.headcount_code IS 'Tranche d''effectif brute de la source (ex. code INSEE), conservée pour traçabilité';
COMMENT ON COLUMN companies.size_category IS 'Taille normalisée, utilisée par le scoring : solo, tpe, pme, eti, ge';
COMMENT ON COLUMN companies.origin IS 'Comment l''entreprise est entrée : saisie manuelle, import CSV ou détecteur automatique';
COMMENT ON COLUMN companies.score IS 'Dernier score (0-100) pour l''ICP de l''entreprise, maintenu par trigger';

-- Personnes à contacter dans une entreprise (données personnelles : RGPD)
CREATE TABLE company_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  is_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
  email TEXT CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_source TEXT CHECK (email_source IN ('manual', 'hunter', 'website', 'other')),
  email_confidence SMALLINT CHECK (email_confidence BETWEEN 0 AND 100),
  phone TEXT,
  linkedin_url TEXT,
  data_source TEXT NOT NULL DEFAULT 'manual',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, company_id),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE,
  CHECK (coalesce(first_name, last_name, email, linkedin_url) IS NOT NULL)
);

-- Un e-mail = une personne : l'opposition (opt-out) ne peut pas être
-- contournée par un doublon rattaché à une autre entreprise
CREATE UNIQUE INDEX uq_company_contacts_email ON company_contacts(user_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX idx_company_contacts_company_id ON company_contacts(company_id);

COMMENT ON TABLE company_contacts IS 'Personnes à contacter dans les entreprises prospectées';
COMMENT ON COLUMN company_contacts.data_source IS 'RGPD : origine de la donnée (manual, hunter, site web...), à communiquer sur demande';
COMMENT ON COLUMN company_contacts.collected_at IS 'RGPD : date de collecte';
COMMENT ON COLUMN company_contacts.opted_out_at IS 'RGPD : date à laquelle la personne a refusé d''être contactée. NULL = pas d''opposition';

-- Signaux d'achat détectés (événements datés)
CREATE TABLE company_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  signal_type TEXT NOT NULL REFERENCES signal_types(key) ON UPDATE CASCADE,
  dedupe_key TEXT,
  source_url TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE,
  CHECK (expires_at IS NULL OR expires_at > detected_at)
);

-- Un même signal n'est enregistré qu'une fois par entreprise. Sans
-- dedupe_key (ex. « site lent »), NULLS NOT DISTINCT fait que la
-- re-détection met à jour la ligne existante (upsert) au lieu d'en créer
-- une nouvelle chaque nuit.
CREATE UNIQUE INDEX uq_company_signals_dedupe
  ON company_signals(company_id, signal_type, dedupe_key) NULLS NOT DISTINCT;
CREATE INDEX idx_company_signals_recent ON company_signals(user_id, detected_at DESC);
CREATE INDEX idx_company_signals_signal_type ON company_signals(signal_type);

COMMENT ON TABLE company_signals IS 'Signaux d''achat détectés sur une entreprise (recrutement, site lent...)';
COMMENT ON COLUMN company_signals.dedupe_key IS 'Identifiant externe pour éviter les doublons, ex. id de l''offre d''emploi';
COMMENT ON COLUMN company_signals.evidence IS 'Preuve exploitable dans le message : intitulé de l''offre, score PageSpeed...';

-- Historique des qualifications (immuable : on ajoute, on ne modifie pas)
CREATE TABLE company_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  icp_profile_id UUID NOT NULL,
  icp_version INTEGER NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  is_eliminated BOOLEAN NOT NULL DEFAULT FALSE,
  elimination_reason TEXT,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reasons) = 'array'),
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (icp_profile_id, user_id) REFERENCES icp_profiles(id, user_id) ON DELETE CASCADE,
  CHECK (NOT is_eliminated OR elimination_reason IS NOT NULL)
);

CREATE INDEX idx_company_qualifications_company ON company_qualifications(company_id, created_at DESC);
CREATE INDEX idx_company_qualifications_icp ON company_qualifications(icp_profile_id, icp_version);

COMMENT ON TABLE company_qualifications IS 'Historique des scores : permet de comparer l''efficacité des versions d''ICP';
COMMENT ON COLUMN company_qualifications.icp_version IS 'Version de l''ICP au moment du calcul, remplie automatiquement par trigger';
COMMENT ON COLUMN company_qualifications.reasons IS 'Justification point par point, ex. [{"criterion": "job_posting_dev", "points": 30, "detail": "..."}]';
COMMENT ON COLUMN company_qualifications.model IS 'Moteur de scoring utilisé : règles (rules-v1) ou identifiant du modèle d''IA';

-- Échanges avec l'entreprise (remplace interactions et agency_interactions)
CREATE TABLE company_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  contact_id UUID,
  type TEXT NOT NULL CHECK (type IN ('email', 'linkedin_message', 'call', 'meeting', 'note', 'system_event')),
  direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('draft', 'scheduled', 'done')),
  subject TEXT,
  content TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE,
  -- Le contact doit appartenir à la MÊME entreprise que l'échange
  FOREIGN KEY (contact_id, company_id) REFERENCES company_contacts(id, company_id) ON DELETE SET NULL (contact_id)
);

CREATE INDEX idx_company_interactions_company ON company_interactions(company_id, occurred_at DESC);
CREATE INDEX idx_company_interactions_user ON company_interactions(user_id, occurred_at DESC);
CREATE INDEX idx_company_interactions_contact_id ON company_interactions(contact_id) WHERE contact_id IS NOT NULL;

COMMENT ON TABLE company_interactions IS 'Historique des échanges avec les entreprises prospectées';
COMMENT ON COLUMN company_interactions.status IS 'draft = message préparé (ex. rédigé par l''IA) pas encore envoyé';

-- Relances : on réutilise la table existante
ALTER TABLE reminders ADD COLUMN company_id UUID;
ALTER TABLE reminders ADD CONSTRAINT reminders_company_fkey
  FOREIGN KEY (company_id, user_id) REFERENCES companies(id, user_id) ON DELETE CASCADE;
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_single_target_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_single_target_check
  CHECK (num_nonnulls(contact_id, agency_id, company_id) <= 1);

CREATE INDEX idx_reminders_company_id ON reminders(company_id) WHERE company_id IS NOT NULL;

COMMENT ON COLUMN reminders.company_id IS 'Entreprise associée à la relance (une seule cible par relance)';


-- =====================================================================
-- 4. TRIGGERS
-- =====================================================================

CREATE TRIGGER update_icp_profiles_updated_at
  BEFORE UPDATE ON icp_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_references_updated_at
  BEFORE UPDATE ON portfolio_references
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_contacts_updated_at
  BEFORE UPDATE ON company_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Version de l'ICP : incrémentée par la base, jamais par le client
CREATE OR REPLACE FUNCTION bump_icp_profile_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.criteria IS DISTINCT FROM OLD.criteria
     OR NEW.signal_weights IS DISTINCT FROM OLD.signal_weights THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bump_icp_profile_version_trigger
  BEFORE UPDATE ON icp_profiles
  FOR EACH ROW EXECUTE FUNCTION bump_icp_profile_version();

-- Date d'expiration par défaut d'un signal, selon son type
CREATE OR REPLACE FUNCTION set_company_signal_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT NEW.detected_at + make_interval(days => st.default_ttl_days)
      INTO NEW.expires_at
      FROM signal_types st
     WHERE st.key = NEW.signal_type
       AND st.default_ttl_days IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_company_signal_expiry_trigger
  BEFORE INSERT ON company_signals
  FOR EACH ROW EXECUTE FUNCTION set_company_signal_expiry();

-- La version d'ICP d'une qualification est celle du moment : on ne fait
-- pas confiance à la valeur envoyée par le client
CREATE OR REPLACE FUNCTION set_qualification_icp_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT version INTO NEW.icp_version
    FROM icp_profiles
   WHERE id = NEW.icp_profile_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_qualification_icp_version_trigger
  BEFORE INSERT ON company_qualifications
  FOR EACH ROW EXECUTE FUNCTION set_qualification_icp_version();

-- Recopie le dernier score sur l'entreprise (dénormalisation contrôlée)
CREATE OR REPLACE FUNCTION apply_company_qualification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE companies
     SET score = CASE WHEN NEW.is_eliminated THEN 0 ELSE NEW.score END,
         scored_at = NEW.created_at,
         icp_profile_id = COALESCE(icp_profile_id, NEW.icp_profile_id)
   WHERE id = NEW.company_id
     AND (icp_profile_id IS NULL OR icp_profile_id = NEW.icp_profile_id)
     AND (scored_at IS NULL OR scored_at <= NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_company_qualification_trigger
  AFTER INSERT ON company_qualifications
  FOR EACH ROW EXECUTE FUNCTION apply_company_qualification();

-- Date du dernier échange réel (les brouillons ne comptent pas)
CREATE OR REPLACE FUNCTION update_company_last_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' THEN
    UPDATE companies
       SET last_interaction_at = NEW.occurred_at
     WHERE id = NEW.company_id
       AND (last_interaction_at IS NULL OR last_interaction_at < NEW.occurred_at);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_company_last_interaction_trigger
  AFTER INSERT OR UPDATE OF status, occurred_at ON company_interactions
  FOR EACH ROW EXECUTE FUNCTION update_company_last_interaction();


-- =====================================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================================
-- (select auth.uid()) plutôt que auth.uid() : Postgres calcule la valeur
-- une seule fois par requête au lieu d'une fois par ligne.

-- Catalogues : lecture pour tout utilisateur connecté, aucune écriture
-- (pas de politique INSERT/UPDATE/DELETE = interdit). Seules les
-- migrations et le service role peuvent les modifier.
ALTER TABLE signal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profession_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read signal types"
  ON signal_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read professions"
  ON professions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read profession signals"
  ON profession_signals FOR SELECT TO authenticated USING (true);

-- Tables par utilisateur : chacun ne voit et ne modifie que ses lignes.
-- Mêmes quatre politiques partout, générées par une boucle pour éviter
-- les copier-coller (et les oublis).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'icp_profiles', 'pipeline_stages', 'lead_sources', 'portfolio_references',
    'companies', 'company_contacts', 'company_signals', 'company_interactions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Users can view their own rows" ON %I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Users can insert their own rows" ON %I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Users can update their own rows" ON %I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Users can delete their own rows" ON %I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)', t);
  END LOOP;
END;
$$;

-- Qualifications : historique immuable, donc pas de politique UPDATE
ALTER TABLE company_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rows"
  ON company_qualifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own rows"
  ON company_qualifications FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own rows"
  ON company_qualifications FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);


-- =====================================================================
-- 6. INITIALISATION D'UN COMPTE
-- =====================================================================
-- SECURITY INVOKER (le défaut) : la fonction s'exécute avec les droits
-- de l'utilisateur connecté, donc la RLS s'applique. Pas de paramètre
-- user_id : impossible de viser le compte de quelqu'un d'autre.
-- Idempotente : on peut l'appeler plusieurs fois sans créer de doublons.
CREATE OR REPLACE FUNCTION initialize_prospection_defaults()
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE user_id = uid) THEN
    INSERT INTO pipeline_stages (user_id, name, color, kind, "order", is_default) VALUES
      (uid, 'À qualifier',   '#64748b', 'open',     0, true),
      (uid, 'À contacter',   '#3b82f6', 'open',     1, false),
      (uid, 'Contacté',      '#f59e0b', 'open',     2, false),
      (uid, 'Relancé',       '#8b5cf6', 'open',     3, false),
      (uid, 'En discussion', '#06b6d4', 'open',     4, false),
      (uid, 'Gagné',         '#22c55e', 'won',      5, false),
      (uid, 'Perdu',         '#ef4444', 'lost',     6, false),
      (uid, 'Hors cible',    '#6b7280', 'excluded', 7, false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lead_sources WHERE user_id = uid) THEN
    INSERT INTO lead_sources (user_id, name, icon, "order") VALUES
      (uid, 'Détection automatique', 'radar',      0),
      (uid, 'LinkedIn',              'linkedin',   1),
      (uid, 'Recommandation',        'users',      2),
      (uid, 'Réseau',                'network',    3),
      (uid, 'Événement',             'calendar',   4),
      (uid, 'Autre',                 'help-circle', 5);
  END IF;

  -- Premier ICP, pré-rempli avec les critères par défaut du métier choisi
  IF NOT EXISTS (SELECT 1 FROM icp_profiles WHERE user_id = uid) THEN
    INSERT INTO icp_profiles (user_id, profession_key, name, criteria)
    SELECT uid, p.key, 'Mon client idéal', p.default_icp
      FROM user_profiles up
      JOIN professions p ON p.key = up.profession_key
     WHERE up.id = uid;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION initialize_prospection_defaults() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION initialize_prospection_defaults() TO authenticated;

COMMENT ON FUNCTION initialize_prospection_defaults IS 'Crée les étapes, sources et le premier ICP de l''utilisateur connecté (idempotente)';


-- =====================================================================
-- 7. DONNÉES DE RÉFÉRENCE
-- =====================================================================
-- Les catalogues vont dans une migration (ils doivent exister partout,
-- en production comme en local), pas dans seed.sql (réservé aux données
-- de test du développement local).

INSERT INTO signal_types (key, label, description, default_ttl_days) VALUES
  ('job_posting_dev',       'Recrute un développeur',            'Offre d''emploi de développeur publiée récemment', 45),
  ('job_posting_design',    'Recrute un designer',               'Offre d''emploi de designer ou graphiste publiée récemment', 45),
  ('job_posting_marketing', 'Recrute en marketing',              'Offre d''emploi en marketing, communication ou contenu', 45),
  ('recently_created',      'Entreprise créée récemment',        'Immatriculée depuis moins d''un an : elle a besoin de tout', 180),
  ('headcount_growth',      'Effectif en croissance',            'Changement de tranche d''effectif à la hausse', 180),
  ('funding_round',         'Levée de fonds',                    'Levée de fonds annoncée récemment', 180),
  ('slow_website',          'Site lent',                         'Score de performance PageSpeed faible', 90),
  ('outdated_website',      'Site daté',                         'Site non responsive ou technologies anciennes', 180),
  ('no_website',            'Pas de site internet',              'Aucun site trouvé pour l''entreprise', 180),
  ('tech_stack_match',      'Stack technique compatible',        'Technologies du site correspondant au savoir-faire de l''utilisateur', 180),
  ('inactive_blog',         'Blog inactif',                      'Aucune publication depuis plusieurs mois', 180);

INSERT INTO professions (key, label, description, target_roles, default_icp, "order") VALUES
  (
    'web_developer',
    'Développeur·se web',
    'Sites, applications web, SaaS, automatisation',
    ARRAY['cto', 'directeur technique', 'directrice technique', 'responsable technique', 'tech lead',
          'lead developer', 'fondateur', 'fondatrice', 'co-fondateur', 'co-fondatrice',
          'gérant', 'gérante', 'directeur général', 'directrice générale', 'ceo'],
    '{
      "countries": ["FR"],
      "size_categories": {"preferred": ["pme"], "accepted": ["tpe", "solo"]},
      "remote": "preferred",
      "exclude_keywords": ["site vitrine"]
    }'::jsonb,
    0
  ),
  (
    'designer',
    'Designer / graphiste',
    'Identité visuelle, UI/UX, supports de communication',
    ARRAY['directeur marketing', 'directrice marketing', 'responsable communication', 'responsable marketing',
          'brand manager', 'fondateur', 'fondatrice', 'gérant', 'gérante', 'ceo'],
    '{
      "countries": ["FR"],
      "size_categories": {"preferred": ["tpe", "pme"], "accepted": ["solo"]},
      "remote": "preferred"
    }'::jsonb,
    1
  ),
  (
    'copywriter_seo',
    'Rédacteur·rice / SEO',
    'Contenus, référencement naturel, newsletters',
    ARRAY['responsable marketing', 'directeur marketing', 'directrice marketing', 'content manager',
          'responsable contenu', 'responsable communication', 'fondateur', 'fondatrice', 'gérant', 'gérante'],
    '{
      "countries": ["FR"],
      "size_categories": {"preferred": ["tpe", "pme"], "accepted": ["solo"]},
      "remote": "preferred"
    }'::jsonb,
    2
  ),
  (
    'other',
    'Autre métier',
    'Configuration générique, à personnaliser',
    ARRAY['fondateur', 'fondatrice', 'gérant', 'gérante', 'directeur général', 'directrice générale', 'ceo'],
    '{"countries": ["FR"]}'::jsonb,
    99
  );

INSERT INTO profession_signals (profession_key, signal_type, default_weight) VALUES
  ('web_developer',  'job_posting_dev',       30),
  ('web_developer',  'funding_round',         20),
  ('web_developer',  'slow_website',          15),
  ('web_developer',  'outdated_website',      15),
  ('web_developer',  'tech_stack_match',      10),
  ('web_developer',  'recently_created',      10),
  ('web_developer',  'headcount_growth',      10),

  ('designer',       'job_posting_design',    30),
  ('designer',       'outdated_website',      25),
  ('designer',       'recently_created',      20),
  ('designer',       'funding_round',         20),
  ('designer',       'job_posting_marketing', 10),

  ('copywriter_seo', 'inactive_blog',         25),
  ('copywriter_seo', 'job_posting_marketing', 25),
  ('copywriter_seo', 'recently_created',      10),
  ('copywriter_seo', 'slow_website',          10),
  ('copywriter_seo', 'no_website',            10),

  ('other',          'recently_created',      20),
  ('other',          'headcount_growth',      15),
  ('other',          'funding_round',         15);

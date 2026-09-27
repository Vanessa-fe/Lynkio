-- =====================================================================
-- SUPPRESSION DE L'ANCIEN MODÈLE (« contract »)
-- Le CRM est désormais centré sur les entreprises (00010) : les contacts
-- particuliers, rendez-vous, paiements et agences n'ont plus d'écran ni de
-- code. Leurs tables, fonctions et colonnes sont supprimées.
-- IRRÉVERSIBLE : les données de ces tables sont perdues (validé le 27/09/2026).
-- À appliquer APRÈS la mise en ligne du code qui ne les utilise plus.
-- =====================================================================

-- 1. Relances : on ne garde que le lien vers une entreprise.
--    Les relances encore rattachées à un contact ou une agence sont supprimées
--    (elles l'auraient été de toute façon, par cascade, avec leur cible).
DELETE FROM reminders WHERE contact_id IS NOT NULL OR agency_id IS NOT NULL;

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_single_target_check;
DROP INDEX IF EXISTS idx_reminders_contact_id;
DROP INDEX IF EXISTS idx_reminders_agency_id;
ALTER TABLE reminders
  DROP COLUMN contact_id,
  DROP COLUMN agency_id;

-- 2. Ancien modèle « contacts » (enfants d'abord)
DROP TABLE payments;
DROP TABLE appointments;
DROP TABLE interactions;
DROP TABLE contact_channels;
DROP TABLE contacts;
DROP TABLE contact_statuses;
DROP TABLE contact_sources;

-- 3. Ancien modèle « agences »
DROP TABLE agency_interactions;
DROP TABLE agencies;
DROP TABLE agency_statuses;
DROP TABLE agency_sources;

-- 4. Fonctions qui ne servaient qu'à ces tables (leurs déclencheurs sont partis avec elles)
DROP FUNCTION update_contact_last_interaction();
DROP FUNCTION update_agency_last_interaction();
DROP FUNCTION check_deposit_amount();
DROP FUNCTION initialize_user_defaults(UUID);

-- 5. Profil : le type d'activité est remplacé par le métier (profession_key)
ALTER TABLE user_profiles DROP COLUMN business_type;

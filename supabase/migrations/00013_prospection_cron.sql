-- =====================================================================
-- DÉCLENCHEMENT AUTOMATIQUE DE SOPHIE
-- Toutes les heures, pg_cron appelle la fonction prospection-run en mode
-- « scheduled ». La fonction ne traite que les plannings arrivés à échéance
-- (claim_due_prospection_runs) : les réglages de chaque utilisateur restent
-- des données, aucun job n'est créé par utilisateur.
--
-- Pas de secret ici : l'URL du projet est publique, et la fonction n'accepte
-- de travailler en mode planifié que sur ce qui est dû (un appel en trop ne
-- déclenche rien de plus). Les plannings étant à l'heure pile, le job tourne
-- à la minute 0.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- cron.schedule remplace le job s'il existe déjà sous ce nom
SELECT cron.schedule(
  'sophie-prospection',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kifzcqxasqpcstujihqt.supabase.co/functions/v1/prospection-run',
    body := '{"mode": "scheduled"}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

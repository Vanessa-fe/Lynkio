-- =====================================================================
-- LES RELANCES DEVIENNENT DES ACTIVITÉS (lot 1.8c de la refonte)
-- Décision du 17/11/2026 : une relance est un envoi réel confirmé, gardé
-- dans l'historique et compté. Rien à saisir : elle se déduit des échanges
-- déjà notés (« Marquer comme envoyé », « Noter », séquences LinkedIn,
-- import d'un outil LinkedIn), et reste juste si un échange est supprimé.
--
-- Relance = envoi qui suit un envoi resté sans réponse, à la même personne
-- (ou sur la même fiche quand l'échange n'est rattaché à personne).
-- Après une réponse ou un rendez-vous, le compte repart de zéro : écrire
-- après une réponse, c'est poursuivre la conversation, pas relancer.
--
-- follow_up_number : 0 = premier envoi (ou envoi après une réponse),
-- 1 = première relance, 2 = deuxième relance…
-- L'étape « Relancé » des comptes existants et son avancement automatique
-- ne changent pas.
-- =====================================================================

CREATE VIEW exchange_follow_ups WITH (security_invoker = true) AS
WITH real_exchanges AS (
  SELECT i.id, i.user_id, i.company_id, i.contact_id, i.occurred_at, i.created_at, i.direction,
         (i.direction = 'incoming' OR i.type = 'meeting') AS is_reply
    FROM company_interactions i
   WHERE i.status = 'done'
     AND i.type NOT IN ('note', 'system_event')
     AND (i.direction IS NOT NULL OR i.type = 'meeting')
),
conversations AS (
  SELECT e.*,
         -- Nombre de réponses reçues avant cet échange : chaque réponse ouvre un nouveau tour
         count(*) FILTER (WHERE e.is_reply) OVER (
           PARTITION BY e.company_id, e.contact_id
           ORDER BY e.occurred_at, e.created_at, e.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS replies_before
    FROM real_exchanges e
)
SELECT c.id AS interaction_id,
       c.user_id,
       c.company_id,
       c.contact_id,
       c.occurred_at,
       (row_number() OVER (
          PARTITION BY c.company_id, c.contact_id, c.replies_before
          ORDER BY c.occurred_at, c.created_at, c.id
        ) - 1)::integer AS follow_up_number
  FROM conversations c
 WHERE NOT c.is_reply
   AND c.direction = 'outgoing';

COMMENT ON VIEW exchange_follow_ups IS
  'Rang de chaque envoi réel depuis la dernière réponse (par personne, ou par fiche sans personne) : 0 = premier envoi, 1 = première relance, 2 = deuxième relance… Lue avec les droits de l''utilisateur (security_invoker)';

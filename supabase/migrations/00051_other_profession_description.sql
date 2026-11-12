-- « Autre métier » ne parle plus de mots-clés (offres d'emploi arrêtées le 13/11/2026) :
-- la première recherche propose alors tous les secteurs.
UPDATE professions
   SET description = 'Formation, RH, conseil… : vous choisissez vos secteurs parmi tous ceux proposés'
 WHERE key = 'other';

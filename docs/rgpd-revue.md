# Revue RGPD — prospection data-driven

_Revue du 13 novembre 2026 (ticket Trello « [P2] Prévoir conformité, rétention et sécurité pour la prospection data-driven »). À relire à chaque nouvelle source de données ou nouveau prestataire._

## 1. Rôles

| Données | Responsable du traitement | Rôle de Filonea |
|---|---|---|
| Compte de l'utilisatrice / l'utilisateur (e-mail, profil, réglages, abonnement) | Filonea (Vanessa, EI) | Responsable |
| Prospects (entreprises, dirigeants, contacts, échanges, notes) | L'utilisateur | **Sous-traitant** (art. 28) |
| Mesure d'audience (PostHog) | Filonea | Responsable |

## 2. Cartographie des données

| Catégorie | Personnelle ? | Origine | Où (table) | Base légale | Conservation |
|---|---|---|---|---|---|
| E-mail, mot de passe (haché) | Oui | Utilisateur | `auth.users` | Contrat | Durée du compte |
| Profil, présentation, signature | Oui | Utilisateur | `user_profiles` | Contrat | Durée du compte |
| Clés BYOK (OpenAI, Claude, Gemini, Hunter) | Secret | Utilisateur | `vault.secrets` (chiffré) + `user_api_keys` (4 derniers caractères) | Contrat | Jusqu'à suppression de la clé ou du compte |
| Abonnement | Oui (lié au compte) | Stripe | `billing` | Contrat / obligation légale | Durée du compte ; factures 10 ans chez Stripe |
| Entreprise (raison sociale, SIREN, NAF, ville, finances) | **Non** (personne morale) — sauf entreprise individuelle | Registre officiel, BODACC, BOAMP, France Travail, site web | `companies` | Intérêt légitime de l'utilisateur | **Configurable** (voir §4) |
| Dirigeant (nom, prénom, fonction) | Oui | Registre officiel (public) | `company_contacts` | Intérêt légitime (B2B) | Suit l'entreprise |
| Contact (e-mail pro, téléphone, LinkedIn) | Oui | Hunter (clé de l'utilisateur), saisie, post LinkedIn | `company_contacts` | Intérêt légitime (B2B) | Suit l'entreprise |
| Opposition (« ne plus contacter ») | Oui | Utilisateur | `company_contacts.opted_out_at` | Obligation (respect de l'opposition) | Gardée tant que l'entreprise existe ; jamais effacée par le nettoyage automatique |
| Échanges, notes, rappels, listes | Oui | Utilisateur | `company_interactions`, `reminders`, `prospect_lists`… | Intérêt légitime | Suit l'entreprise |
| Posts LinkedIn (auteur, texte, e-mail écrit dans le post) | Oui | Extension LinkedIn | `linkedin_posts` | Intérêt légitime | **Configurable** 7–90 jours (30 par défaut) si non retenu |
| Signaux d'achat | Non (faits sur l'entreprise) | Sources publiques | `company_signals` | Intérêt légitime | Purge par type (`signal_types.retention_days`) |
| Journal d'accès | Oui (lié au compte) | Filonea | `data_access_log` | Intérêt légitime (sécurité) / obligation de sécurité | 12 mois |
| Mesure d'audience | Pseudonyme + e-mail (identify) | Navigateur, serveur | PostHog EU | Consentement (cookie) / intérêt légitime (événements serveur sans cookie) | Réglage PostHog |

## 3. Information et opposition

- **Information des prospects (art. 14)** : les données sont collectées indirectement. L'utilisateur (responsable) doit informer la personne au premier contact : origine des coordonnées, finalité, droit d'opposition. Ajouté dans la politique de confidentialité et les CGU (§7).
- **Opposition** : bouton « ne plus contacter » sur la fiche (Sophie ne propose plus de message), contact exclu des exports CSV et Waalaxy, adresse de contact publique pour toute personne concernée.
- **Accès / portabilité** : nouvel **export complet JSON** (Paramètres > Mon compte) — toutes les tables du compte, sans secret ni identifiant Stripe interne. L'export CSV des entreprises reste.
- **Effacement** : suppression du compte (fonction `delete-account`, résiliation Stripe puis suppression en cascade, clé retirée du coffre, contact Brevo retiré).

## 4. Conservation (nouveau)

Table `data_retention_settings`, réglable dans Paramètres > Mon compte :

- **Prospects sans suite** : 6, 12, 24 ou 36 mois (36 par défaut, recommandation CNIL : 3 ans après le dernier contact). Une fiche est « sans suite » si rien ne s'est passé depuis la durée choisie : ni ajout/collecte, ni échange, ni signal. **Toujours gardées** : clients (étape gagnée), fiches avec un rappel non terminé, fiches dont un contact s'est opposé.
- **Effacement automatique : désactivé par défaut.** Rien n'est effacé tant que l'utilisateur ne l'a pas activé. Aperçu chiffré avant d'activer, bouton « Nettoyer maintenant » avec confirmation.
- **Posts LinkedIn non retenus** : 7 à 90 jours (30 par défaut = comportement d'avant). La tâche `linkedin-posts-retention` est remplacée par `data-retention` (chaque nuit, 3 h 15 UTC), qui gère aussi le journal (12 mois).
- Déjà en place : signaux purgés par type (`signals-retention`), compteurs anti-abus 2 jours.

## 5. Sécurité

| Point | État |
|---|---|
| RLS | Active sur **toutes** les tables `public` (vérifié en direct le 13/11/2026) ; politiques `auth.uid() = user_id` ; tables de référence en lecture seule ; vue `contact_outreach` en `security_invoker` |
| Clés BYOK | Chiffrées dans Supabase Vault ; jamais renvoyées au navigateur ; `read_user_api_key` réservée au `service_role` ; vérification limitée à 10 essais/heure |
| Fonctions `SECURITY DEFINER` | `search_path = ''`, droits retirés à `anon` ; celles appelables par l'utilisateur agissent sur `auth.uid()` seulement (avertissements Supabase attendus) |
| Secrets serveur | Variables d'environnement Netlify / Supabase, jamais dans le dépôt |
| Journaux serveur | Messages d'erreur techniques, pas de contenu de prospect ; PostHog : compteurs et noms de service seulement |
| Journal d'accès | **Nouveau** : exports, clés enregistrées/supprimées, réglages et nettoyages ; ajout seul, lisible par son propriétaire, inscrit par la base (déclencheurs) |
| Mots de passe divulgués | ⚠️ Protection « Leaked password protection » désactivée dans Supabase Auth (à activer dans le tableau de bord, offre Pro) |

## 6. Prestataires et contrats

| Prestataire | Données | Lieu | Garantie |
|---|---|---|---|
| Supabase | Tout | Londres (UK, adéquation) | DPA Supabase |
| Netlify | Trafic du site | États-Unis | Clauses contractuelles types / DPF |
| Stripe | Paiement | UE / États-Unis | DPA Stripe |
| Resend | E-mails de compte | États-Unis | DPA Resend |
| Brevo | E-mails d'information | France | DPA Brevo |
| PostHog | Audience | UE (Francfort) | DPA PostHog |
| OpenAI / Anthropic / Google (BYOK) | Fiche entreprise, prénom/poste du contact, présentation | Selon le fournisseur | **Contrat entre l'utilisateur et le fournisseur** (sa clé, ses conditions) ; les API de ces fournisseurs n'entraînent pas leurs modèles sur ces données par défaut |
| Hunter (BYOK) | Domaine, nom du dirigeant | France | Contrat de l'utilisateur avec Hunter |

À faire côté administratif (hors code) : signer / archiver les DPA en ligne de chaque prestataire (Supabase, Netlify, Stripe, Resend, Brevo, PostHog) et tenir le registre des traitements (ce document peut en servir de base).

## 7. Tests

`supabase/tests/rgpd_isolation_retention.sql` — transaction annulée à la fin, deux comptes fictifs :

- **Isolation** : un compte ne voit, ne modifie, n'efface ni ne crée rien chez un autre (entreprises, contacts, posts, journal, réglages, candidats au nettoyage) ; clé déchiffrée inaccessible depuis le site.
- **Journal** : écriture directe et faux nettoyage refusés ; enregistrement de clé et changement de réglage journalisés automatiquement ; aucun nom de prospect dans le journal.
- **Conservation** : aperçu exact ; rien d'effacé tant que le nettoyage est désactivé ; seule la fiche sans suite part (client, opposition, échange récent, fiche récente gardés) ; tâche de nuit sans effet sur un compte non volontaire ; durée des posts respectée par compte.
- **Suppression** : après suppression du compte, plus aucune ligne du compte (9 tables vérifiées) ni sa clé dans le coffre ; l'autre compte est intact.

Lancer : `supabase db query --linked -f supabase/tests/rgpd_isolation_retention.sql` → « RGPD : tous les tests passent ».

## 8. Écarts restants (suivi)

1. **PostHog** : la suppression du compte n'efface pas la personne PostHog (identifiant + e-mail). Il faut une clé personnelle PostHog (droit `person:write`) pour l'automatiser, ou une suppression manuelle sur demande.
2. **Leaked password protection** Supabase à activer.
3. **Mention d'information dans les messages** : Sophie pourrait proposer une phrase courte d'origine des coordonnées + opposition dans le premier message.
4. **`pipeline_runs` et `sophie_notifications`** sans durée de conservation (données techniques, sans donnée de prospect pour la première ; titres d'entreprise pour la seconde) : à borner (par ex. 12 mois) quand la page résultats n'en dépendra plus.

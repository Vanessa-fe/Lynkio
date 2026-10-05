# Avancement du projet

Point au **5 octobre 2026**. Le détail technique de chaque étape (tables, règles, choix) est dans
[refonte-prospection.md](refonte-prospection.md) ; ce document-ci dit seulement où on en est.

## Le but

Un outil de prospection B2B pour freelances. Sophie, l'agente automatique, repère les entreprises qui
ont probablement besoin d'un freelance (signaux d'achat), les note selon le client idéal, puis
prépare les messages. Premier métier : développeuse web.

Site en ligne : https://lynkio.netlify.app (mis à jour à chaque fusion dans `main`).

## Ce qui est fait

| Domaine | Détail |
|---|---|
| Socle | Next.js 16, React 19, Node 22 ; faille CVE-2025-29927 corrigée ; sécurité de la base renforcée (00009) |
| Modèle prospection | Entreprises, contacts d'entreprise, signaux, échanges, qualifications, client idéal (00010) |
| Métier | Lancement avec « développeuse web » seulement, choisi à l'onboarding (00011) |
| Entreprises | Liste, fiche, formulaire, étapes du pipeline, analyse du site (stack), recherche de contact Hunter |
| Sophie | Onglet Prospection : planning, départements, lancement manuel, historique ; passage automatique toutes les heures (00012, 00013) |
| Sources | Offres France Travail (source principale), sociétés tout juste créées BODACC (option, désactivée) (00014) |
| Offres | Missions freelance gardées ; offres anonymes à identifier avec leur lien (00015) |
| Score | Règles `rules-v1` sur 100, calculées par la base, « Pourquoi ce score » sur la fiche (00016) |
| Stack technique | Signal « stack compatible » selon les technologies du client idéal (00017) |
| Paramètres | Client idéal, étapes du pipeline, sources |
| Tableau de bord | Pistes en cours, nouveautés, relances du jour et en retard, meilleures opportunités, dernière recherche de Sophie |
| Relances | Rattachées à une entreprise, raccourcis de date |
| Import / export | CSV des entreprises avec aperçu, doublons, modèle à télécharger |
| Ancien modèle | Contacts particuliers, rendez-vous, paiements et agences supprimés (code et base, 00018, 27/09) |
| Site web | Bouton « Rechercher le site » sur les fiches qui n'en ont pas |
| Messages (01/10) | « Préparer un message » sur la fiche : Sophie rédige un premier e-mail ou message LinkedIn à partir des signaux, du site et de votre présentation ; le code vérifie (lien inconnu, champ à compléter, prix, longueur, client confidentiel) et ajoute la signature. Brouillon à copier puis « Marquer comme envoyé ». Réglages dans Paramètres, Messages de Sophie (00022, fonction `draft-message`) |
| Ciblage (28/09) | Client idéal revu : TPE / PME en direct, 100 % à distance, projets complets. Signal « Recrute pour le web ou le digital » (00019) ; intermédiaires, ESN et régie repérés dans le texte des annonces |
| Suivi commercial (05/10) | « Prochaine action » et « Montant estimé » sur chaque entreprise, modifiables sur la fiche ; colonne dans la liste, montant par étape sur le tableau de bord, colonnes de l'import / export CSV (00023). Remplace la base Notion « Prospection » |
| Personnes (05/10) | Une fiche peut être une personne seule (indépendant, ou entreprise inconnue) avec étape, échanges, relances et messages de Sophie ; page Personnes ; « Ajouter une personne » seule ou avec son entreprise (retrouvée par son nom) ; « Rattacher à une entreprise » déplace tout sur la fiche de l'entreprise ; import CSV de personnes (00024) |
| Listes et statuts (05/10) | Listes de personnes (page Personnes : cocher, « Ajouter à une liste », export Waalaxy d'une liste). Statut de chaque personne déduit de ses échanges (À contacter, Contacté, Relancé, A répondu, Ne pas contacter) ; bouton « Noter » pour un envoi ou une réponse en un clic ; l'étape de la fiche avance toute seule, vers l'avant seulement (00025) |
| Fenêtre d'import (05/10) | « Importer des prospects » sur la page Personnes : profil LinkedIn, CSV, saisie d'une personne ou d'une entreprise, recherches de Sophie. Bouton « + Lynkio » à glisser dans les favoris : sur un profil LinkedIn, ouvre « Ajouter une personne » pré-rempli (source LinkedIn, doublon signalé). Personne ajoutée ou import CSV rangés directement dans une liste |

## Ce qu'il reste à faire

**Nouveau cap (05/10) : un CRM complet jusqu'au client signé**, pour ne plus jongler entre Lynkio,
Notion et Waalaxy. Les projets, devis et factures restent hors de Lynkio.

- **LinkedIn** : aller-retour avec Waalaxy (à l'import, regrouper les personnes d'une même entreprise
  au lieu d'écarter les suivantes comme doublons), puis module d'envoi prudent (profils choisis, quotas bas)
  avant la fin de l'essai Waalaxy.

Suite de la prospection, par ordre de priorité proposé :

1. **Sites web des entreprises** (étape 2 du nouveau ciblage), puis **analyse du site** : lent
   (PageSpeed), daté (étape 3). Agences web en source secondaire (étape 5).
   **Sites web des entreprises.** France Travail donne rarement le site ; sans lui, pas d'analyse de
   stack ni de recherche Hunter automatique. Pistes : site présent dans l'offre, déduction depuis le
   nom avec vérification, saisie manuelle.
2. **Hunter automatique**, seulement sur les entreprises bien notées (quota gratuit limité).
3. **Qualification par IA**, en complément des règles, sur les entreprises déjà filtrées.
4. **Onglet Références** : tes missions passées, que Sophie cite déjà dans les messages si elles
   existent (la table existe, pas encore l'écran).
5. **Relances préparées par Sophie** : un second message qui tient compte du premier.
6. **Autres métiers** : ajouter une ligne dans `professions`, sans déploiement.

## Petits chantiers

- CLI Supabase 1.x dans `package.json` : faille connue, passer à la version actuelle.
- Alerte Supabase sur la fonction `rls_auto_enable`.
- Règles RLS des relances : écrire `(select auth.uid())` comme sur les nouvelles tables (plus rapide).

## À faire de ton côté

- Régler Sophie dans l'onglet Prospection sur ton compte (activer, départements, jours, heure).
- Vérifier que `HUNTER_API_KEY` est bien déclarée dans les variables d'environnement Netlify.
- Activer la protection contre les mots de passe divulgués (Supabase, Authentication).
- Faire l'onboarding de ton compte principal.

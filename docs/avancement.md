# Avancement du projet

Point au **27 septembre 2026**. Le détail technique de chaque étape (tables, règles, choix) est dans
[refonte-prospection.md](refonte-prospection.md) ; ce document-ci dit seulement où on en est.

## Le but

Un outil de prospection B2B pour freelances. Sophie, l'agente automatique, repère les entreprises qui
ont probablement besoin d'un freelance (signaux d'achat), les note selon le client idéal, puis
préparera les messages. Premier métier : développeuse web.

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

## En cours : suppression de l'ancien modèle (étape 4)

Branche `feat/remove-legacy-model`, poussée et testée, **pas encore en ligne**.

1. ⏳ Fusionner le code dans `main` (le site en ligne n'utilise plus les anciennes tables).
2. ⏳ Appliquer la migration 00018 : **irréversible**, attend ton « oui ». Supprime les contacts
   particuliers, rendez-vous, paiements et agences (81 contacts de test sur contactsolynk, 1 agence
   et sa relance).
3. ⏳ Régénérer les types de la base.

## Ce qu'il reste à faire

Par ordre de priorité proposé :

1. **Sites web des entreprises.** France Travail donne rarement le site ; sans lui, pas d'analyse de
   stack ni de recherche Hunter automatique. Pistes : site présent dans l'offre, déduction depuis le
   nom avec vérification, saisie manuelle.
2. **Hunter automatique**, seulement sur les entreprises bien notées (quota gratuit limité).
3. **Qualification par IA**, en complément des règles, sur les entreprises déjà filtrées.
4. **Préparation des messages** par Sophie, à partir du signal et de tes références.
5. **Onglet Références** : tes missions passées, citées dans les messages (la table existe, pas encore
   l'écran).
6. **Autres métiers** : ajouter une ligne dans `professions`, sans déploiement.

## Petits chantiers

- CLI Supabase 1.x dans `package.json` : faille connue, passer à la version actuelle.
- Alerte Supabase sur la fonction `rls_auto_enable`.
- Règles RLS des relances : écrire `(select auth.uid())` comme sur les nouvelles tables (plus rapide).
- Fichiers `TASKS.md`, `SESSION-NOTES.md`, `DEMAIN.md` à la racine : datent d'août et décrivent
  l'ancien modèle, à supprimer ou archiver.

## À faire de ton côté

- Activer la protection contre les mots de passe divulgués (Supabase, Authentication).
- Faire l'onboarding de ton compte principal.

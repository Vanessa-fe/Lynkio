# Refonte UX et Sophie copilote — Audit de l'existant (phase 0)

Audit du 17 novembre 2026, fait sur le code de `main` (commit `36426bc`). Rien n'a été modifié.
Les chemins de fichiers renvoient au code réel ; « à confirmer » signale ce qui demande une reproduction.

**Mise à jour du 17/11 (après arbitrages)** : les décisions de Vanessa sont dans la section 0 ; les sections 3,
4.2, 7, 8 et 10 en tiennent compte.

---

## 0. Décisions validées le 17/11 et ce qu'elles changent

| # | Décision | Conséquence technique |
|---|---|---|
| 1 | Vouvoiement partout, Sophie comprise | Aucun texte existant à réécrire pour le ton ; consigne « vous » dans les instructions de Sophie |
| 2 | Étapes personnalisables conservées ; 6 étapes = défaut des **nouveaux** comptes seulement ; aucun pipeline existant écrasé | Sophie comprend une étape par sa **nature** et son **rôle**, jamais par son nom (§4.2-A) |
| 3 | « Relancé » retiré des défauts à terme ; une relance = un envoi réel confirmé, compté et gardé dans l'historique ; compatibilité avec l'existant | Relance **déduite des échanges** (aucune donnée nouvelle à saisir) ; l'automatisme actuel reste actif pour les pipelines qui ont encore l'étape (§4.2-C) |
| 4 | Les entreprises découvertes restent dans la liste, hors du pipeline actif ; l'utilisateur décide de commencer ; aucune perte | Nouvelle colonne **ajoutée** « en démarche depuis », sans toucher aux étapes existantes (§4.2-B) |
| 5 | Sophie reste l'identité globale ; recherche classique sans clé ; conversation et analyses IA avec clé ; distinguer sources classiques / analyses IA / hypothèses | Provenance enregistrée par entreprise et affichée par badge ; Sophie présente sans IA ce qui vient de règles (§4.3) |

### Mesure sur la base de production (17/11, lecture seule, chiffres agrégés)

| Mesure | Valeur |
|---|---|
| Comptes avec un pipeline | 4 |
| Pipelines personnalisés (nom changé, étape ajoutée ou supprimée) | **0** |
| Comptes dont l'étape d'arrivée n'est pas « À qualifier » | 0 |
| Comptes qui ont l'étape « Relancé » (rôle automatique) | 4 |
| Entreprises | 344 |
| … dans l'étape d'arrivée | **309**, dont **0** avec un échange noté |
| … dans « Relancé » | 1 |
| … sans étape | 0 |

Le risque est donc faible aujourd'hui, mais la migration est écrite pour des pipelines personnalisés : de futurs
comptes en auront.

---

## 1. Ce qui existe déjà (audit)

### 1.1 Socle

| Brique | État | Conséquence pour la refonte |
|---|---|---|
| Next.js 16, React 19, Tailwind, composants Radix (`src/components/ui`) | En place | On réutilise tout, aucune nouvelle librairie d'interface nécessaire |
| Mise en page connectée | `src/app/(dashboard)/layout.tsx` : barre latérale fixe (`md:pl-64`), barre du bas sur mobile | Ce layout ne se recharge pas entre les pages : **c'est l'endroit idéal pour monter le panneau Sophie** (la conversation survit à la navigation sans rien stocker) |
| Hébergement Netlify | Une action serveur est coupée au bout d'une dizaine de secondes (commentaire de `supabase/functions/draft-message/index.ts`) | **La conversation avec Sophie doit passer par une Edge Function Supabase appelée depuis le navigateur**, comme la rédaction de messages aujourd'hui, pas par une action serveur |
| Navigation | 8 entrées (`src/components/layout/nav-items.ts`) : Tableau de bord, Prospection, Pipeline commercial, Entreprises, Personnes, Listes, Relances, Paramètres. Hors menu : `/results` (entonnoir), `/notifications`, `/ideas`, `/import-export`, `/people/linkedin`, `/prospection/boamp` | Sur mobile, l'onglet Prospection s'appelle déjà « Sophie » |

### 1.2 Intelligence artificielle

Tout passe par **`supabase/functions/_shared/ai.ts`** :

- `loadAiAccess()` : trouve la clé de l'utilisateur (fournisseur préféré d'abord), la déchiffre côté serveur depuis Supabase Vault (`read_user_api_key`, service_role). La clé ne va jamais au navigateur.
- `generateJson()` : **un seul appel, réponse au format JSON strict**, recherche web en option, pour OpenAI (API Responses), Gemini et Anthropic (SDK officiel).
- Messages d'erreur clairs déjà écrits : clé refusée, crédit épuisé, facturation Google, trop de demandes, modèle inconnu, service indisponible, délai dépassé.

**Ce qui manque pour une conversation** : pas d'échange en plusieurs tours, pas d'appel d'outils (« tool calling »), pas de réponse progressive (streaming). C'est la plus grosse brique technique à ajouter.

Fonctions IA existantes (toutes avec la clé de l'utilisateur, toutes à la demande) :

| Fonction | Ce qu'elle fait | Réutilisable par Sophie |
|---|---|---|
| `draft-message` | Premier e-mail ou message LinkedIn (+ 2 relances LinkedIn), vérifié par le code (`checks.ts` : lien inconnu, prix, longueur, client confidentiel) puis signé. N'enregistre rien | Oui, directement : c'est l'outil `generate_outreach_draft` |
| `strategy-assistant` | Conversation guidée (5 questions) → brouillon de recherche (secteurs, tailles, zone). N'enregistre rien ; protection contre les consignes cachées (données entre balises, listes fermées, refiltrage) | Oui : base de `prepare_prospect_search`, et **modèle de sécurité à généraliser** |
| `signal-advisor` | Recommande des signaux d'opportunité selon l'offre | Plus tard (réglages) |
| `company-deep-dive` | « Approfondir avec Sophie » : recherche web sur une entreprise, en arrière-plan, cache 30 jours, 20 par 24 h | Oui : Sophie peut proposer de le lancer (avec accord) et lire son résultat |
| `prospection-run` (source `tech_users`) | Recherche d'entreprises par technologie, par IA, avec vérification du site | Indirectement |
| `linkedin-posts` | Retirée de l'interface le 10/11 | Non |

### 1.3 Recherche d'entreprises

- Moteur : `supabase/functions/prospection-run/runner.ts`. Sources : **recherches enregistrées dans le registre officiel (`profile_search`, sans IA)**, technologie (`tech_users`, avec IA), créations BODACC ; France Travail coupé depuis le 13/11.
- Recherches enregistrées : table `prospect_strategies`, assistant en 3 étapes sans IA (`strategy-dialog.tsx`) ou guidé par l'IA (`strategy-assistant-dialog.tsx`).
- Lancement manuel : `prospection-status.tsx` affiche « Sophie est partie chercher — les résultats arrivent dans quelques instants », **puis plus rien** : aucune confirmation de fin.
- Un passage dont une source échoue mais une autre réussit est marqué `succeeded` (`runner.ts`, l. 151-160) : **un succès partiel est affiché comme un succès complet**.

### 1.4 Score et explications (sans IA)

- Score calculé par la base (règles v2, signaux prouvés, critères souples : migrations 00055 à 00067), résultat dans les qualifications.
- `CompanyScoreCard` (« Pourquoi ce score »), `CompanyWhyCard` (« Pourquoi cette entreprise » : faits du registre avec source et date, signaux observés ou non, inconnues), `src/lib/signal-explanation.ts` (constat / piste / prestation, sans IA).

C'est exactement ce que demande le §5.2 : **Sophie peut expliquer un score sans inventer, en relisant ces données.** Une bonne partie peut même s'afficher sans appel IA.

### 1.5 Suivi commercial (CRM)

| Élément | Où | Remarque |
|---|---|---|
| Étapes | `pipeline_stages`, **propres à chaque utilisateur et modifiables** (Paramètres > Pipeline) | 11 étapes par défaut (00052) : À qualifier, À contacter, Contacté, Relancé, En discussion, Rendez-vous, Proposition envoyée, Gagné, Perdu, Sans suite, Hors cible |
| Nature d'une étape | `kind` : `open`, `won`, `lost`, `excluded` | Sert aux statistiques et au taux de réussite |
| Rôle d'une étape | `role` : `to_contact`, `contacted`, `followed_up`, `in_discussion`, `meeting` | **Un trigger fait avancer la fiche toute seule** quand on note un échange (`advance_stage_on_exchange`) : 2ᵉ envoi → « Relancé » |
| Historique des étapes | `company_stage_events` (00047), écrit par la base, garde le **nom** de l'étape | Une étape supprimée n'efface pas l'historique : bonne nouvelle pour la migration |
| Statut d'une personne | Vue `contact_outreach` : À contacter, Contacté, Relancé, A répondu, Ne pas contacter — **déduit des échanges**, jamais saisi | Déjà distinct de l'étape de l'entreprise |
| Échanges | `company_interactions` (type, sens, date, statut) | Base de la future chronologie et de l'outil « noter une activité » |
| Relances | `reminders` (entreprise, échéance, terminée le) | Base de l'outil « programmer une relance » |
| Listes | `prospect_lists`, `prospect_list_members` | |
| Entonnoir | `src/lib/funnel.ts`, page `/results` | « Qualifiées » = sorties de « À qualifier » ; « clients gagnés » = étape 6 |
| Arrivée d'une entreprise | Toute entreprise trouvée reçoit l'étape par défaut (« À qualifier ») : `prospection-run/store.ts` l. 115 | Aujourd'hui **tout ce qui est découvert est déjà dans le pipeline** |

Environ **25 fichiers** lisent les étapes, leur nature ou leur rôle (tableau de bord, Kanban, liste, entonnoir, import CSV, import Waalaxy, envoi LinkedIn, formulaires…).

### 1.6 Préférences, sécurité, journal

- `sophie_preferences` : fréquence des alertes e-mail (pas encore de réglage d'affichage).
- Filtres de la liste Entreprises gardés dans `sessionStorage` seulement (perdus d'une session à l'autre).
- `rate_limits` (00035), `data_access_log` et `data_retention_settings` (00061), RLS sur toutes les tables, test d'isolation `supabase/tests/rgpd_isolation_retention.sql`.
- Aucun outil d'affichage Markdown dans le projet. Aucune table de conversation.

---

## 2. Bugs et points déjà identifiés : ce que dit le code

| # | Point | Constat dans le code | Effort |
|---|---|---|---|
| 1 | « Une erreur est survenue » à la connexion / inscription alors que le tableau de bord s'ouvre | L'action `login` (`src/lib/actions/auth.ts`) finit par `redirect()`. Le formulaire l'appelle dans un `try/catch` (`login-form.tsx` l. 47-56) qui affiche « Une erreur inattendue est survenue » à la moindre exception. Cause **probable** : l'interruption de l'appel par la redirection tombe dans ce `catch`. Même schéma dans `signup-form.tsx` et `onboarding-form.tsx`. **À confirmer par reproduction** | Petit |
| 2 | « Où se trouve leur siège ? » | `strategy-dialog.tsx` l. 299 et `onboarding-form.tsx` l. 285 | Très petit |
| 3 | Phrases techniques du tableau de bord | « Entreprises ni gagnées, ni perdues, ni hors cible » : `prospection-stats.tsx` l. 56 | Très petit |
| 4 | Provenance avec / sans IA | « Dont N trouvées par Sophie » compte `origin = 'detector'` (`prospection-dashboard.ts` l. 150), donc aussi le registre, **sans IA**. Même confusion dans « Sophie est partie chercher » | Petit |
| 5 | Fin de recherche | Aucune confirmation (voir §1.3) ; succès partiel affiché comme succès | Moyen |
| 6 | Colonnes Entreprises | « Site web » et « Stack » : `companies-list.tsx` l. 446-447 ; âge calculé par `companyAge(founded_on)` l. 467 | Petit |
| 7 | Promesses Sophie inexistantes | « Faites le tri avec Sophie » : `companies-list.tsx` l. 230 (aucune action derrière) | Très petit |
| 8 | Fusion Entreprises / Pipeline | Deux pages, deux requêtes différentes (200 fiches pour la liste, 1 000 pour le Kanban) ; le bouton « Vue tableau » mène au Kanban et « Vue liste » à la liste (libellés inversés par rapport au vocabulaire du cahier des charges) | Moyen |
| 9 | Préférence de vue | Rien n'est mémorisé | Petit |
| 10 | Parcours LinkedIn | `/people/linkedin` : retour **toujours** vers `/people` (lien en dur), sans la liste ni les filtres ; la sélection est enregistrée en base (séquences) puis la page montre **toute** la file, pas les personnes qu'on vient d'ajouter (`use-start-linkedin.ts`) | Moyen |
| 11 | Textes LinkedIn | Intro de la page et de la file à raccourcir | Très petit |
| 12 | Waalaxy | Cité dans 10 fichiers de l'appli connectée (listes, personnes, import, export) | Petit |
| 13 | Gagné / Perdu | Noms d'étapes stockés en base, par utilisateur | Voir §4.2 |
| 14 | Cohérence des statuts | Voir §3 et §4.2 | Gros |

---

## 3. Contradictions entre le cahier des charges et l'existant

Les points 1 à 5 sont **tranchés** (section 0) ; la solution retenue est indiquée.

1. **Tutoiement ou vouvoiement.** → Vouvoiement partout, Sophie comprise.
2. **Six étapes fixes, alors que les étapes sont personnalisables.** → Personnalisation gardée ; 6 étapes par défaut pour les nouveaux comptes ; Sophie s'appuie sur nature + rôle (§4.2-A).
3. **« Relancé » est une étape automatique.** → Retirée des défauts des nouveaux comptes ; gardée et toujours automatique chez les comptes existants ; la relance devient une activité déduite des envois réels ; statut de personne « Relancé » gardé (§4.2-C).
4. **« À qualifier » est l'étape d'arrivée de toute entreprise.** → Colonne additive « en démarche depuis » ; les découvertes restent dans la liste, hors du Kanban ; bouton « Commencer à prospecter » (§4.2-B).
5. **Sophie est aujourd'hui le nom du moteur de recherche.** → Sophie reste l'identité globale ; ce qui change, c'est que chaque résultat dit d'où il vient (source officielle, analyse IA, hypothèse) et que la conversation exige une clé (§4.3).
6. **Conversation impossible avec la brique IA actuelle.** `generateJson` ne sait faire qu'une réponse JSON en un appel. Il faut une nouvelle fonction de conversation (plusieurs tours, outils, réponse progressive) pour les 3 fournisseurs.
7. **Limite de Netlify.** Une réponse avec outils peut prendre 20 à 60 secondes : impossible en action serveur. Edge Function obligatoire (déjà la règle pour la rédaction).
8. **Gemini avec clé gratuite.** Seul `gemini-flash-lite-latest` répond (vérifié le 11/11). Sa capacité à appeler des outils de façon fiable est **à tester** avant de promettre les mêmes fonctions qu'OpenAI et Claude.
9. **Coût pour l'utilisateur.** Rien n'est à la charge de Filonéa (clés personnelles), mais le modèle conseillé pour Claude (`claude-opus-5-5`) coûte cher pour bavarder. Il faudra sans doute un modèle plus léger pour la conversation et un plafond réglable.
10. **Kanban de toutes les entreprises.** Si toutes les découvertes restent dans le Kanban, il devient illisible. La vue Kanban doit montrer seulement les entreprises « en démarche ».
11. **Waalaxy.** Le cahier des charges demande de ne plus le citer, mais l'export au format Waalaxy et l'import de son CSV sont de vraies fonctions. → Décidé le 17/11 : cité nulle part dans l'interface ; les fonctions restent, sous un nom générique.
12. **« Négociation » n'existe pas** comme étape aujourd'hui : il faut l'ajouter.

---

## 4. Changements de base de données

### 4.1 Sophie (nouvelles tables, aucune donnée existante touchée)

Toutes avec RLS `user_id = (select auth.uid())`, suppression en cascade avec le compte, prises en compte par la suppression de compte et la durée de conservation.

| Table | Contenu | Pourquoi |
|---|---|---|
| `sophie_conversations` | id, user_id, titre, titre donné par (auto / utilisateur), synthèse des anciens messages, créée / mise à jour le, supprimée le | Historique, reprise après reconnexion |
| `sophie_messages` | id, conversation, user_id, rôle (utilisateur / Sophie / résultat d'outil), texte, cartes affichées (JSON léger), **contexte (page + type + id de l'entité, jamais la fiche copiée)**, fournisseur, modèle, jetons, durée, code d'erreur, date | Affichage, mesure des coûts et des erreurs |
| `sophie_actions` | id, conversation, message, user_id, outil, arguments validés, statut (proposée / confirmée / refusée / exécutée / échouée), **clé d'idempotence unique**, résultat, dates | Confirmation avant action, journal, pas de double exécution |
| `sophie_suggestion_states` | user_id, clé de la suggestion, statut (écartée / faite), jusqu'au | Ne pas répéter une suggestion |
| `sophie_preferences` (existante, colonnes en plus) | ouverture automatique (oui/non), vue Entreprises (tableau / Kanban), plafond de messages par jour | Préférences serveur, pas seulement le navigateur |

Pas de stockage des consignes complètes envoyées à l'IA, ni des clés, ni de copies de fiches.

### 4.2 Statuts commerciaux (révisé après les décisions du 17/11)

Principe : **tout est additif**. Aucune étape existante n'est renommée, supprimée ou réordonnée, aucune
entreprise ne change d'étape pendant la migration. Les nouveautés s'ajoutent à côté.

#### A. Sophie comprend les étapes personnalisées (rôles étendus)

Aujourd'hui chaque étape a déjà une **nature** (`kind` : en cours, signée, perdue, hors cible) et, pour certaines,
un **rôle** (`role` : à contacter, contacté, relancé, en discussion, rendez-vous), qui survit au renommage.

- Ajouter les rôles `proposal` (proposition envoyée), `negotiation` (négociation) et, pour les étapes closes,
  `not_concluded` (non concrétisé / refus) et `no_follow_up` (sans suite). Un rôle reste **facultatif** et unique par compte.
- Rattrapage des comptes existants : rôle donné d'après le nom d'origine **seulement s'il est libre et sans ambiguïté**
  (même fonction que `default_stage_role`). Les 4 comptes actuels sont tous dans ce cas.
- Paramètres > Pipeline : un choix facultatif « Cette étape correspond à… » pour une étape personnalisée.
- Sophie lit, pour chaque étape : nature + rôle + position + nom affiché. Une étape sans rôle reste comprise
  (« étape en cours n° 3 sur 6 », « étape close : perdue »), sans deviner d'après le nom.
- Les statistiques (taux de réussite, entonnoir) continuent de se fonder sur la nature et le rôle, jamais sur le libellé.
  Les textes génériques de l'appli (« signées », « non concrétisées ») remplacent « gagnées / perdues » ; **les noms
  d'étapes choisis par l'utilisateur restent les siens**.

#### B. Découvertes et pipeline actif

Le modèle actuel range toute entreprise trouvée dans l'**étape d'arrivée** (`is_default`, réglable par
l'utilisateur, aujourd'hui « À qualifier » pour tous). C'est pour ça que le pipeline est encombré (309 sur 344).

- Ajouter `companies.engaged_at` (« en démarche depuis », vide = **découverte**). L'étape (`stage_id`) n'est pas touchée.
- Rattrapage, sans rien modifier d'autre : une entreprise est « en démarche » si elle a un échange réel noté,
  une séquence LinkedIn, ou une étape **différente** de l'étape d'arrivée (y compris signée ou perdue). Date retenue :
  premier échange, sinon premier changement d'étape (`company_stage_events`), sinon date d'ajout. « Hors cible »
  depuis l'arrivée reste une découverte écartée. Estimation sur la base : ~35 en démarche, ~309 découvertes.
- **Entrer dans le suivi** : bouton « Commencer à prospecter » (fiche, liste, Sophie après confirmation). Il remplit
  `engaged_at` et, si l'entreprise est encore dans l'étape d'arrivée, la place dans la première étape en cours suivante
  (rôle `to_contact` s'il existe). Le premier envoi réel confirmé fait de même automatiquement (c'est déjà un choix
  de l'utilisateur) : petit ajout au trigger `advance_stage_on_exchange`.
- **Sortir du suivi** : « Retirer du suivi » vide `engaged_at` sans effacer échanges ni historique.
- Chaque entrée / sortie est notée dans la chronologie (type d'échange `system_event`, déjà prévu et exclu des compteurs).
- Kanban et pipeline actif = entreprises en démarche. Liste Entreprises = tout, avec un filtre « Découvertes / En démarche / Terminées ».
- Inchangé : la recherche automatique et l'import continuent de mettre l'étape d'arrivée (aucun code de recherche à
  modifier), l'étape d'arrivée reste réglable, rien n'est perdu.
- Impacts à reprendre : entonnoir (« Qualifiées » = entrées dans le suivi ou écartées, au lieu de « sorties de
  À qualifier »), tableau de bord (« pistes en cours » = en démarche et étape en cours), meilleures opportunités
  (parmi les découvertes), import Waalaxy (une personne invitée ou contactée = en démarche), envoi LinkedIn (démarrer une
  séquence = en démarche).

#### C. Relances

- **Nouveaux comptes** : plus d'étape « Relancé » dans les défauts. Le trigger actuel ne fait déjà rien quand le rôle
  `followed_up` n'existe pas : la fiche reste en « Contacté ». Aucune modification nécessaire.
- **Comptes existants** : l'étape « Relancé » et son avancement automatique **restent actifs** tant que l'utilisateur
  ne la retire pas. Aujourd'hui, supprimer une étape fait passer ses fiches « Sans étape » (`deleteStage`,
  `pipeline-settings.ts`). À améliorer dans le même lot : demander vers quelle étape déplacer les fiches avant de supprimer.
- **La relance devient une activité, déduite des échanges** : tout envoi réel confirmé qui suit un premier envoi
  (même personne, ou même fiche à défaut) est une relance n° 2, 3… Calcul dans une vue, sans nouvelle donnée : il reste
  juste si un échange est supprimé. Tous les envois réels créent déjà un échange : « Marquer comme envoyé », « Noter »,
  séquences LinkedIn (migrations 00027 à 00030), import Waalaxy.
- Compteur conservé : par personne (`contact_outreach.sent_count`, déjà là) et par entreprise ; libellé « Relance n° 2 »
  dans la chronologie ; statut de personne « Relancé » conservé (il est déduit des échanges, ce n'est pas une étape).
- À la confirmation d'une relance, Sophie peut proposer de clore la relance prévue du jour et d'en programmer la suivante
  (après accord, phase 4).

#### D. Défauts des nouveaux comptes

`ensure_default_settings` (00052) créera : À contacter (étape d'arrivée), Contacté, En discussion, Rendez-vous,
Proposition envoyée, Négociation, puis les résultats Signé (libellé à confirmer), Non concrétisé, Sans suite, Hors cible,
tous avec leur rôle. « À qualifier » disparaît des défauts : la notion « découverte » le remplace.

#### E. Plus tard, sur demande seulement

Un assistant « Simplifier mon pipeline » dans Paramètres pourra proposer aux comptes existants (aperçu avant / après,
rien sans clic) : retirer « À qualifier » et « Relancé », ajouter « Négociation », renommer « Gagné » / « Perdu ».
Jamais exécuté automatiquement.

Avant chaque migration : comptage par étape et par statut avant / après dans une transaction annulée.

### 4.3 Provenance : sources classiques, analyses IA, hypothèses

Aujourd'hui une entreprise trouvée n'a que `origin = 'detector'` : on ne sait pas quelle source l'a trouvée, ni quel passage.

- Ajouter `companies.discovered_by` (`registry` / `tech_ai` / `bodacc` / `job_postings`) et `companies.pipeline_run_id`.
  Rattrapage : `strategy_id` rempli → registre ; sinon d'après la source du passage quand elle est connue ; sinon « inconnue ».
  `pipeline_run_id` sert aussi au bouton « Voir les entreprises » de la fin de recherche (lot 1.3).
- Trois badges partout (liste, fiche, cartes de Sophie) : **Source officielle** (registre, BODACC, avec date),
  **Analyse IA** (recherche par technologie, « Approfondir avec Sophie », textes générés), **Hypothèse** (les « pistes » de
  `signal-explanation.ts`, ce que Sophie suppose).
- Sophie sans clé : elle présente les résultats et propose des actions issues de **règles**, signalées comme telles ; aucune
  phrase générée n'est affichée comme si elle venait de l'IA.

---

## 5. Fonctions existantes à brancher sur Sophie

| Outil Sophie | Service existant appelé | Effet de bord | Clé IA nécessaire pour l'outil lui-même |
|---|---|---|---|
| `get_company_context` | `getCompanyById`, `getCompanyContacts`, `getCompanySignals`, `getLatestQualification`, `getLatestDeepAnalysis`, `getCompanyInteractions` (`src/lib/queries/companies.ts`) | Non | Non |
| `explain_score` | Qualification + `signal-explanation.ts` + données de `CompanyWhyCard` | Non | Non |
| `get_pending_actions` | Requêtes du tableau de bord (`prospection-dashboard.ts`) et des relances (`queries/reminders.ts`) | Non | Non |
| `get_search_context` | `prospect_strategies`, `pipeline_runs` | Non | Non |
| `prepare_prospect_search` | Logique et listes fermées de `strategy-assistant`, validation zod de `createStrategy` | Non (brouillon) | — |
| `generate_outreach_draft` | `draft-message/writer.ts` + `checks.ts` | Non (brouillon) | — |
| `launch_search` (phase 4) | Lancement manuel existant (plafond quotidien 00057) | Oui, après confirmation | Non (sauf source technologie) |
| `log_activity` (phase 4) | Actions `company-interactions.ts` (le trigger fait avancer l'étape) | Oui, après récapitulatif | Non |
| `create_reminder` (phase 4) | `actions/reminders.ts` | Oui, après confirmation | Non |
| `change_stage` (phase 4) | Action de `company-stage-select.tsx` | Oui, après confirmation | Non |
| `suggest_priorities` | Logique « Meilleures opportunités » du tableau de bord + `prospect-recommendations.ts` | Non | Non |

Tous les outils de lecture fonctionnent **avec le jeton de l'utilisateur** (RLS) : Sophie ne peut voir que ses données.

---

## 6. Navigation et composants proposés

### 6.1 Menu (6 entrées au lieu de 8)

| Entrée | Contenu |
|---|---|
| Accueil | Accueil de Sophie, actions du jour, nouvelles entreprises, 3 indicateurs utiles |
| Prospection | « Décrire ma recherche à Sophie » / « Recherche par critères », recherches enregistrées (liste compacte), historique et marchés publics en sections secondaires |
| Entreprises | Vue Tableau (découvertes + suivi) ou Kanban (en démarche seulement), choix mémorisé ; remplace « Pipeline commercial » (`/pipeline` redirige) |
| Contacts | Personnes + onglet Listes ; envoi LinkedIn en sous-page |
| Suivi | Relances : aujourd'hui, en retard, à venir, terminées |
| Paramètres | inchangé ; Résultats (entonnoir), Boîte à idées, Notifications en accès secondaire |

Bouton « Sophie » toujours visible (en haut à droite sur ordinateur, dans la barre du bas sur mobile).

### 6.2 Composants

Tous dans `src/components/sophie/`, montés une seule fois dans `(dashboard)/layout.tsx` :

- `SophieProvider` : conversation en cours, ouverture, contexte de la page.
- `useSophieContext({ type: 'company', id })` : chaque page déclare **seulement l'identifiant** de ce qu'elle montre ; le serveur recharge les données.
- `SophiePanel` : colonne à droite (380-400 px) sur grand écran, l'espace principal se décale ; panneau superposé sous 1 280 px ; plein écran sur mobile (fenêtre Radix déjà présente).
- `SophieMessages`, `SophieComposer` (Entrée / Maj + Entrée, désactivé et expliqué sans clé).
- `SophieCards` : entreprise, recherche proposée, brouillon, récapitulatif d'activité, relance.
- `SophieConfirm` : « Confirmer / Modifier / Annuler » pour toute action.
- Côté serveur : Edge Function `sophie-chat` + nouvelle fonction `chat()` dans `_shared/ai.ts`.

**Garde-fou anti-mélange** : chaque message garde l'entité de son contexte ; si l'utilisateur a changé de fiche pendant la réponse, la carte affiche « À propos de *Entreprise A* » au lieu de s'appliquer à la fiche ouverte.

---

## 7. Plan technique par phase

Chaque lot = une PR, testée puis vérifiée en ligne.

### Phase 1 — Corrections et simplification

| Lot | Contenu | Taille |
|---|---|---|
| Lot | Contenu | Taille | Effet sur les comptes existants |
|---|---|---|---|
| 1.1 | Textes : « Où chercher ? », phrase du tableau de bord, « Faites le tri avec Sophie », Waalaxy retiré de toute l'interface (bouton : « Export CSV pour automatisation LinkedIn »), textes LinkedIn, « gagnées / perdues » génériques → « signées / non concrétisées » (pas les noms d'étapes) | S | Textes seulement |
| 1.2 | Bug du message d'erreur à la connexion / inscription / onboarding (reproduire, corriger, tester) | S | Aucun |
| 1.3 | **Provenance** (`discovered_by`, `pipeline_run_id`, badges, §4.3) + **fin de recherche** : fenêtre « N entreprises ajoutées (dont X nouvelles) », cas aucun résultat / partiel / échec, « Voir les entreprises » de ce passage ; statut « partiel » | M | Colonnes ajoutées, rattrapage ; les anciennes fiches sans source connue affichent « source non enregistrée » |
| 1.4 | Parcours LinkedIn : origine conservée (`?from=list&id=…`), retour au bon endroit avec filtres, personnes qu'on vient d'ajouter mises en avant | M | Aucun |
| 1.5 | Tableau de bord simplifié | M | Aucune donnée touchée |
| 1.6 | Tableau Entreprises : colonnes, âge en colonne, tri par ancienneté, valeurs inconnues claires | S | Aucun |
| 1.7 | Fiche entreprise : en-tête, « Pourquoi » fusionné, sections repliables, chronologie unique | M | Aucun |
| 1.8a | **Rôles d'étapes étendus** (§4.2-A) : nouveaux rôles, rattrapage par nom quand c'est sûr, choix « Cette étape correspond à… » dans Paramètres | S | Invisible ; rôles ajoutés aux 4 comptes |
| 1.8b | **Découvertes / en démarche** (§4.2-B) : `engaged_at`, rattrapage, « Commencer à prospecter » / « Retirer du suivi », trigger au premier envoi, filtres, entonnoir et tableau de bord recalculés | L | ~309 fiches deviennent « découvertes » (étape inchangée), ~35 restent dans le pipeline actif |
| 1.8c | **Relances = activité** (§4.2-C) : vue de rang des envois, « Relance n° 2 » dans la chronologie, compteur par entreprise ; suppression d'étape avec choix de l'étape de destination | M | « Relancé » reste active chez eux ; rien ne bouge |
| 1.8d | **Nouveaux défauts** (§4.2-D) : 6 étapes + résultats, sans « À qualifier » ni « Relancé » | S | Aucun (nouveaux comptes seulement) |
| 1.9 | Fusion Entreprises / Kanban, vue mémorisée ; Kanban = en démarche (dépend de 1.8b) | M | `/pipeline` redirige vers la vue Kanban |
| 1.10 | Contacts + Listes, page Suivi | M | Aucun |
| 1.11 | (plus tard, sur demande) Assistant « Simplifier mon pipeline » (§4.2-E) | M | Seulement si l'utilisateur le lance |

Ordre : 1.1 → 1.2 → 1.3 → 1.4 → 1.8a → 1.8b → 1.8c → 1.8d → 1.9, puis 1.5, 1.6, 1.7, 1.10 (le tableau de bord et la
fiche se simplifient mieux une fois la notion « en démarche » disponible).

### Phase 2 — Sophie converse

2.1 Tables et RLS (§4.1) · 2.2 fonction `chat()` pour les 3 fournisseurs avec réponse progressive, Edge Function `sophie-chat` (authentification, limite de débit, fenêtre de 20 messages + synthèse, enregistrement ; consignes de Sophie : vouvoiement, chaleureuse, n'invente rien, distingue fait / hypothèse) · 2.3 panneau, ouverture automatique (une fois par session, respect de la fermeture, préférence), mobile · 2.4 contexte de page · 2.5 **Sophie sans clé** : le panneau s'ouvre quand même avec un accueil et des suggestions issues de règles (relances du jour, nouvelles découvertes, dernière recherche), badge « Règle Filonéa » ; le champ de saisie explique en une phrase qu'une clé est nécessaire pour discuter, avec le lien vers Paramètres > Vos clés · 2.6 erreurs (réutilise les messages de `_shared/ai.ts`).

Sophie sait lire les étapes personnalisées dès la phase 2 grâce au lot 1.8a : le contexte qu'elle reçoit contient
nature + rôle + position, le nom n'est qu'un libellé à afficher.

### Phase 3 — Sophie consulte et prépare

Outils de lecture (§5), explication du score, recherche préparée (carte modifiable → assistant existant), brouillon de message (carte éditable, copier, « Marquer comme envoyé » existant). Au plus 4 appels d'outils par réponse.

### Phase 4 — Sophie agit (avec confirmation)

Noter une activité, programmer une relance, changer une étape, **commencer à prospecter une entreprise**, lancer une recherche ; table `sophie_actions`, clé d'idempotence, contexte rafraîchi après chaque action. Un envoi n'est noté (et ne devient une relance) que sur confirmation explicite « Oui, je l'ai envoyé » ; Sophie ne propose une étape que parmi celles du compte, désignée par son rôle quand il existe.

### Phase 5 — Sophie proactive

Suggestions par règles (sans IA) : relance du jour, dirigeant pas encore contacté, nouvelles entreprises ; « Ignorer » mémorisé ; récapitulatif d'accueil ; préférences ; mesure d'utilité (événements PostHog : suggestion vue / suivie / écartée).

### Complexité relative

| Phase | Complexité | Pourquoi |
|---|---|---|
| 1 | **Grande** (dont 1.8b : grande) | Beaucoup de petits lots sûrs ; la migration devient additive, donc moins risquée, mais 1.8b touche ~10 écrans et requêtes |
| 2 | **Grande** | Nouvelle brique IA × 3 fournisseurs, réponse progressive, persistance, panneau responsive |
| 3 | **Grande** | Outils, validation, cartes, anti-mélange de contexte |
| 4 | Moyenne | Les services existent ; le travail est la confirmation et l'idempotence |
| 5 | Moyenne | Règles déterministes, peu d'IA |

---

## 8. Risques de régression

| Risque | Où | Parade |
|---|---|---|
| Rattrapage « en démarche » qui classe mal une fiche | Lot 1.8b | Règle écrite et testée ; liste des fiches classées « en démarche » montrée avant d'appliquer ; « Retirer du suivi » / « Commencer à prospecter » pour corriger d'un clic ; aucune étape modifiée |
| Une découverte « disparaît » aux yeux de l'utilisateur | Kanban, tableau de bord | Elle reste dans la liste Entreprises ; filtre « Découvertes » ; message une fois après la mise à jour |
| Écrans qui comptent encore « À qualifier » comme pipeline | Tableau de bord, entonnoir, meilleures opportunités, filtres de la liste | Inventaire des ~25 fichiers qui lisent les étapes, chacun relu dans le lot 1.8b |
| Avancement automatique cassé | Trigger `advance_stage_on_exchange` | Comportement inchangé pour les pipelines avec « Relancé » ; tests avec et sans l'étape ; ajout seulement de `engaged_at` au premier envoi |
| Rôle mal deviné sur une étape personnalisée | Lot 1.8a | Rôle donné seulement si le nom correspond exactement et que le rôle est libre ; sinon laissé vide |
| Import Waalaxy, envoi LinkedIn, import CSV | Lots 1.8b, 1.8c | Chacun met `engaged_at` au bon moment ; « pas intéressé » continue d'aller vers l'étape perdue du compte (par nature) |
| Statut de personne modifié par erreur | Vue `contact_outreach` | Non modifiée ; la relance par entreprise est une vue à part |
| Badge de provenance faux | Lot 1.3 | « Source non enregistrée » plutôt qu'une supposition pour les anciennes fiches |
| Réponse sur la mauvaise entreprise | Panneau | Contexte attaché à chaque message, avertissement si la page a changé |
| Consignes cachées dans les données (nom, site, pages web) | Outils de lecture | Données entre balises, outils en liste fermée, arguments validés par zod, actions toujours confirmées |
| Coûts qui s'emballent | Boucle d'outils | 4 outils max par réponse, plafond quotidien, aucun appel au changement de page |
| Délai Netlify | Conversation | Edge Function uniquement |
| Panneau qui casse les tableaux ou le glisser-déposer du Kanban | Layout | Superposition sous 1 280 px, tests à 375 / 768 / 1 280 / 1 440 px |
| Fuite entre comptes | Nouvelles tables | RLS + extension du test `rgpd_isolation_retention.sql` |
| Gemini gratuit incapable d'appeler des outils | Phase 3 | Test réel avant ; sinon conversation simple sans outils pour ce cas, dit clairement |

---

## 9. Tests à prévoir

- **Migrations 1.8** (dans une transaction annulée, sur la base) : nombre de fiches par étape identique avant / après ; nombre d'échanges, d'événements d'étape et de relances identique ; répartition découvertes / en démarche conforme à la règle ; un pipeline personnalisé fictif (étapes renommées, sans « Relancé », étape ajoutée) traité sans erreur.
- **Automatiques** (`npm run check`, dossier `src/lib/__checks__`) : lecture d'une étape par nature + rôle (avec et sans rôle), rang des relances (y compris après suppression d'un échange), entonnoir après migration, validation des arguments de chaque outil, clé d'idempotence, traduction des erreurs par fournisseur, règles de suggestions.
- **Base** : extension de `supabase/tests/rgpd_isolation_retention.sql` aux tables Sophie (un compte ne lit jamais la conversation d'un autre ; suppression de compte = tout effacé).
- **Parcours dans le navigateur** (compte « Compte Test ») : connexion sans faux message d'erreur, recherche manuelle jusqu'à la fenêtre de fin, LinkedIn depuis une liste puis retour, panneau ouvert / fermé / gardé en naviguant / repris après reconnexion, ouverture automatique une seule fois, mode sans clé, mobile 375 px, navigation au clavier.
- **Test réel sur ton compte avec tes clés** pour chaque fournisseur avant de dire « terminé ».

---

## 10. Décisions

**Toutes tranchées le 17/11.** Plus aucune décision produit ne bloque le développement.

Arbitrages principaux (section 0) : vouvoiement, étapes personnalisables, « Relancé », « À qualifier », Sophie et la
recherche sans IA.

Décisions complémentaires :

| # | Sujet | Décision | Où ça s'applique |
|---|---|---|---|
| 1 | Résultat positif (défauts des nouveaux comptes) | **« Signé »** | Lot 1.8d |
| 2 | Entreprise ajoutée à la main (formulaire, profil LinkedIn) | **En démarche tout de suite**, case décochable pour la garder en découverte | Lot 1.8b |
| 3 | Import CSV | **En démarche seulement si le fichier indique une étape autre que l'arrivée, ou des échanges** ; sinon découverte | Lot 1.8b |
| 4 | Rattrapage « en démarche » sur la base réelle | **La liste des fiches classées « en démarche » et la règle sont montrées à Vanessa avant d'appliquer** | Lot 1.8b |
| 5 | Relance confirmée | **Sophie propose** de clore la relance prévue et d'en programmer une autre ; **jamais automatique** | Phase 4 |
| 6 | Assistant « Simplifier mon pipeline » | **Oui, plus tard** (après la phase 2), essayé d'abord sur le compte de Vanessa | Lot 1.11 |
| 7 | Waalaxy | **Cité nulle part dans l'interface.** Le bouton devient « Export CSV pour automatisation LinkedIn » ; l'import reconnaît toujours ce format sans le nommer ; les adresses internes (`/api/export/waalaxy`) et le code gardent leur nom technique | Lot 1.1 |
| 8 | Affichage des réponses de Sophie | **Librairie `react-markdown`**, sans HTML brut, liens externes en `rel="noopener noreferrer"`, images désactivées | Phase 2 |
| 9 | Modèle et plafond de la conversation | **Modèle léger par fournisseur pour discuter** (le modèle choisi reste celui de la rédaction), **plafond de 100 messages par jour**, réglable | Phase 2 |
| 10 | Conservation des conversations | **12 mois**, réglable dans la page de conservation des données ; suppression manuelle possible | Phase 2 |
| 11 | Espace « Suivi » | **Relances seulement** (aujourd'hui, en retard, à venir, terminées) ; le Kanban reste dans Entreprises | Lot 1.10 |
| 12 | Listes | **Onglet de la page Contacts** | Lot 1.10 |
| 13 | Marchés publics | **Section repliable de Prospection** | Lot 1.5 / Prospection |
| 14 | Ordre | **Celui de la section 7** : corrections 1.1 à 1.4, statuts 1.8a à 1.8d, fusion 1.9, simplifications, puis phase 2 | — |

Point à vérifier au moment de la phase 2 (pas une décision produit) : les noms exacts des modèles légers de chaque
fournisseur, et le fait que celui de Gemini gratuit sait appeler des outils.

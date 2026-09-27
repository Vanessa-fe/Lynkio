# Refonte : outil de prospection multi-métiers

> Résumé de l'avancement et de ce qu'il reste à faire : [avancement.md](avancement.md).

## Objectif

Transformer Prospect CRM en outil de prospection B2B pour freelances, quel que soit leur métier.
Le module contacts B2C (rendez-vous, paiements, niveau de risque) sort du produit.
Les agences deviennent un ICP parmi d'autres, et non plus un pipeline à part.

## Principes

- **Le métier est de la configuration, pas du code.** Un métier = une ligne dans `professions`
  (postes à cibler, ICP par défaut) + ses lignes dans `profession_signals` (signaux utiles et poids).
  Ajouter un métier ne demande aucun déploiement.
- **Faits et événements sont séparés.** La stack ou la taille d'une entreprise sont des faits (colonnes
  de `companies`). « Elle recrute », « son site est lent » sont des événements datés qui expirent
  (`company_signals`).
- **La base garantit l'intégrité, pas seulement le code.** Dédoublonnage (SIREN, domaine, e-mail),
  version d'ICP et score sont assurés par des contraintes et des triggers. Toute future voie d'accès
  (cron, import, autre app) en bénéficie automatiquement.
- **Clés étrangères composites `(parent_id, user_id)`.** La RLS vérifie que la ligne insérée porte
  bien ton `user_id`, mais pas que l'entreprise visée t'appartient. La clé composite comble ce trou :
  impossible d'accrocher un signal ou un contact à l'entreprise d'un autre utilisateur.
- **Expand / contract.** On ajoute le nouveau modèle à côté de l'ancien (expand), on bascule le code,
  puis on supprime l'ancien (contract). L'application fonctionne à chaque étape.

## Modèle de données (00010)

| Table | Rôle |
|---|---|
| `signal_types` | Registre des signaux (un type = un détecteur dans le code), avec durée de validité par défaut |
| `professions` | Métiers : postes des décideurs, ICP par défaut |
| `profession_signals` | Signaux pertinents par métier et poids par défaut |
| `icp_profiles` | ICP de l'utilisateur (plusieurs possibles), version incrémentée automatiquement |
| `pipeline_stages` | Étapes du pipeline, avec une nature (`open`, `won`, `lost`, `excluded`) pour les stats |
| `lead_sources` | Origines des prospects |
| `portfolio_references` | Missions passées, citées dans les messages (nom du client masqué si non public) |
| `companies` | Entreprises prospectées ; domaine normalisé et score maintenus par la base |
| `company_contacts` | Personnes à contacter, avec les champs RGPD (source, date de collecte, opposition) |
| `company_signals` | Signaux détectés, avec preuve et expiration |
| `company_qualifications` | Historique immuable des scores, lié à la version de l'ICP |
| `company_interactions` | Échanges (e-mail, LinkedIn, appel, note), y compris les brouillons |

Les catalogues (`signal_types`, `professions`, `profession_signals`) sont en lecture seule pour les
utilisateurs : seules les migrations et le service role peuvent les modifier.

## Étapes

### Étape 0 : régulariser l'historique des migrations

Les migrations 00005 à 00008 ont été exécutées dans l'éditeur SQL du dashboard : les tables existent,
mais Supabase ne les a pas enregistrées. Sans correction, `db push` tenterait de les rejouer et
échouerait (« relation already exists »).

```bash
npx supabase@latest link --project-ref kifzcqxasqpcstujihqt
npx supabase@latest migration list        # 00005 à 00008 apparaissent en local seulement
npx supabase@latest migration repair --status applied 00005 00006 00007 00008
npx supabase@latest migration list        # tout doit être aligné
```

Règle pour la suite : plus aucune modification de schéma dans l'éditeur SQL, uniquement des fichiers
de migration.

### Étape 1 : sécurité (00009), à appliquer tout de suite

Indépendante de la refonte, sans impact sur l'application actuelle.

- `initialize_user_defaults` était appelable **sans être connecté** avec n'importe quel `target_user_id`
  (fonction `SECURITY DEFINER` exposée via `/rest/v1/rpc/...`). Elle refuse désormais tout autre compte
  que celui de l'utilisateur connecté, et n'est plus accessible au rôle `anon`.
- Suppression de la politique `WITH CHECK (true)` sur `user_profiles`, qui permettait de créer un
  profil pour un autre identifiant. Le trigger d'inscription n'en a pas besoin.
- `handle_new_user` n'est plus appelable en direct.
- `search_path` figé sur les fonctions existantes.

À faire aussi dans le dashboard : Authentication → activer la protection contre les mots de passe
compromis (alerte du Security Advisor).

```bash
npx supabase@latest db push
```

### Étape 2 : nouveau modèle (00010)

```bash
npx supabase@latest db push
npm run supabase:generate-types
```

Rien ne change pour l'application actuelle : les nouvelles tables sont vides et non utilisées.

### Étape 2 bis : un seul métier au lancement (00011)

On valide le produit avec les développeur·ses web avant d'ouvrir les autres métiers :
`professions.is_active` passe à `FALSE` pour tous les autres. Ils restent en base avec leurs signaux
et leurs critères d'ICP ; pour en rouvrir un, il suffit de repasser `is_active` à `TRUE`.
Tant qu'un seul métier est actif, l'onboarding le présélectionne.

### Étape 3 : basculer l'application

Dans cet ordre, une branche Git par point :

1. ✅ **Onboarding** : choix du métier (`user_profiles.profession_key`), puis appel de
   `initialize_prospection_defaults()` (sans paramètre, sécurisée par la RLS).
2. ✅ **Module Entreprises** : reprendre les composants `agencies/*` (liste, fiche, formulaire, timeline)
   sur `companies`, `company_contacts` et `company_interactions`. Nouvelle navigation (voir plus bas) :
   Contacts, Agences, Rendez-vous, Paiements et Import / export sortent du menu, leurs pages restent
   accessibles jusqu'à l'étape 4. Les routes `/api/agencies/detect-stack` et `find-contact` sont
   réutilisées telles quelles par les écrans Entreprises.
3. ✅ **Détecteurs existants** (00017), routes déplacées sous `/api/companies/` (les anciennes adresses
   `/api/agencies/*` renvoient vers elles jusqu'à la suppression de l'ancien modèle) :
   - analyse de site : logique dans `src/lib/detectors/stack.ts`. Redirections suivies à la main et
     revérifiées une à une (un site public ne peut plus rediriger l'analyse vers une adresse interne),
     protocoles autres que http(s) refusés. Bouton « Analyser le site » sur la fiche ;
   - signal `tech_stack_match` créé, mis à jour ou retiré **par la base** (`sync_tech_stack_signal`)
     dès que `companies.detected_stack` change ou que les technologies de l'ICP changent
     (`criteria.tech_stack`, Next.js et React par défaut, réglable dans « Client idéal ») ;
   - Hunter : postes à cibler lus dans `professions.target_roles` (+ équivalents anglais), badge
     « Poste visé » ;
   - correctif du score (00016) : un changement de score pouvait être ignoré quand plusieurs calculs
     avaient lieu dans la même transaction (même `NOW()`).
4. ✅ **Paramètres** : page « Étapes et sources » (`/settings/pipeline`) sur `pipeline_stages` /
   `lead_sources` : ajout, modification (nom, couleur, nature), ordre, étape d'arrivée des nouvelles
   entreprises (forcément « en cours »), suppression avec le nombre d'entreprises concernées (elles
   passent « Sans étape » / sans source). « Détection automatique » est protégée : Sophie la retrouve
   par son nom. Les quatre anciennes cartes (statuts et sources des contacts et des agences) ont
   quitté la page Paramètres ; leurs écrans restent accessibles par leur adresse jusqu'à l'étape 4.
   ✅ Écran « Client idéal » (`/settings/icp`) : tailles (idéale / acceptée / hors cible), points de
   chaque signal (seuls les écarts avec les valeurs du métier sont enregistrés dans `signal_weights`),
   mots-clés exclus. Les critères non gérés par l'écran (pays, télétravail) sont conservés.
   L'enregistrement incrémente la version de l'ICP et la base recalcule tous les scores.
5. ✅ **Tableau de bord et relances** sur le nouveau modèle :
   - relances rattachées à une entreprise (`reminders.company_id`) : bloc « Relances » sur la fiche,
     entreprise proposée à la saisie sur la page Relances, raccourcis de date (demain, 3 jours,
     1 semaine, 2 semaines, à 9 h). Les anciennes relances (contacts, agences) restent affichées ;
   - tableau de bord : pistes en cours, nouvelles de la semaine (dont Sophie), relances en retard,
     taux de réussite (gagnées / tranchées), « À faire aujourd'hui », meilleures opportunités
     (en cours, jamais contactées, par score), pipeline par étape, dernière recherche de Sophie.
6. ✅ **Import / export** des entreprises (`/import-export`, bouton sur la liste des entreprises) :
   - import CSV (« ; » ou « , », 1 000 lignes au plus) : intitulés courants reconnus (Entreprise,
     Société, SIRET, E-mail…), SIRET ramené au SIREN, un contact facultatif par ligne ;
   - aperçu avant import : lignes prêtes, doublons (SIREN, domaine du site ou nom, déjà suivis ou
     répétés dans le fichier) et erreurs, avec leur motif. L'import refait l'analyse côté serveur ;
   - entreprises créées avec l'origine « import », dans l'étape par défaut, score calculé par la base ;
     contacts avec `data_source = 'import'`, sans doublon d'e-mail ;
   - export CSV pour Excel (« ; », BOM UTF-8, cellules protégées contre l'injection de formules) :
     étape, score, signaux en cours, contact principal (jamais un contact opposé à la prospection).
     Un fichier exporté se réimporte tel quel ; un modèle avec une ligne d'exemple est téléchargeable.
   L'ancien import / export des contacts n'est plus accessible ; son code part à l'étape 4.

### Étape 4 : supprimer l'ancien modèle (00018, « contract ») ✅

Une fois plus aucun code ne référence les anciennes tables : suppression de `contacts`,
`contact_*`, `interactions`, `appointments`, `payments`, `agencies`, `agency_*`,
`initialize_user_defaults`, des colonnes `reminders.contact_id` / `reminders.agency_id`
et de `user_profiles.business_type`, puis du code associé.

Validée le 27/09. Ordre de mise en ligne, pour ne jamais casser la production :
1. ✅ **Code** : pages, composants, actions, requêtes et routes de l'ancien modèle supprimés
   (contacts, agences, rendez-vous, paiements, anciens paramètres, ancien import / export) ;
   relances réduites aux entreprises ; l'onboarding n'appelle plus `initialize_user_defaults` ;
   dépendance `recharts` retirée. À mettre en ligne **avant** la migration.
2. ✅ **Migration 00018** (`00018_drop_legacy_model.sql`), testée dans une transaction annulée :
   supprime aussi les 81 contacts de test de contactsolynk, 1 agence et la relance ouverte qui lui
   était rattachée. `DROP TABLE` sans `CASCADE` : une dépendance oubliée ferait échouer la
   migration au lieu de supprimer autre chose en silence.
3. ✅ `database.generated.ts` régénéré.
   Appliquée le 27/09 : il reste 17 tables, toutes du nouveau modèle.

### Étape 5 : le pipeline automatique (« Sophie »)

1. ✅ **Onglet Prospection v1** : état (« prochaine prospection : lundi 28 septembre à 9h »), bouton
   « Lancer maintenant », planning (jours cochés + heure), départements, secteurs ignorés, nombre
   maximum d'entreprises par passage, historique des passages avec les raisons d'exclusion.
2. ✅ **Détecteur « entreprises qui recrutent » (source principale, 00014)** : offres d'emploi France
   Travail pour les métiers liés au métier de l'utilisateur (`profession_signals` → codes ROME 4.0 :
   M1855 développeur web, M1861 logiciel/application, M1805 informatique), dans ses départements. Chaque offre devient un signal `job_posting_dev`
   (intitulé, contrat, lieu, lien). Entreprise déjà suivie : le signal s'ajoute à sa fiche (elle
   recrute à nouveau) ; sinon elle est créée, avec son site quand l'offre le donne, et complétée par
   sa fiche officielle (SIREN, ancienneté, taille, dirigeants) retrouvée par nom exact dans le
   département : mieux vaut pas de fiche qu'une fiche d'une autre entreprise.
   Écartés : offres sans nom d'entreprise, cabinets de recrutement et intérim (NAF 78), plateformes
   freelance et cabinets connus (liste dans `rules.ts`), missions d'intérim, secteurs ignorés,
   mots-clés exclus. Premier essai réel (Rhône, 27/09) : 42 offres, fiche officielle retrouvée pour
   3 entreprises sur 5. Les offres sont lues des plus récentes aux plus
   anciennes depuis le passage précédent (`job_postings_cursor`).
   **Décision (27/09)** : l'ancienneté d'une entreprise est une information affichée (fiche et liste),
   pas un critère de sélection : une société qui vient de se créer a rarement le budget d'un freelance.
3. ✅ **Détecteur « sociétés tout juste créées » (en option, désactivé par défaut)** : le BODACC liste
   les immatriculations ; l'API Recherche d'entreprises complète (NAF, effectif, dirigeants).
   Écartés : entrepreneurs individuels, sociétés civiles (SCI…), secteurs ignorés, données non
   diffusibles, mots-clés exclus, entreprises déjà connues. Lu des plus récentes aux plus anciennes
   jusqu'à la date du passage précédent (`bodacc_cursor`).
   Les sources partagent le quota d'entreprises du passage, la plus utile en premier ; une source en
   panne n'empêche pas les autres (le passage n'échoue que si toutes échouent).
4. ✅ **Missions freelance et offres anonymes (00015)** : une offre ouverte aux indépendants (contrat
   freelance, intitulé, plateforme de mise en relation) devient un signal `freelance_mission` (poids 40).
   Les plateformes ne sont plus écartées. Les offres sans nom d'entreprise, et celles des cabinets de
   recrutement qui cachent leur client, sont gardées dans `unidentified_job_offers` : l'onglet
   Prospection les liste avec leur lien, « Rattacher » (l'offre devient un signal sur l'entreprise) ou
   « Ignorer ». Écartés : intérim, alternance.
5. ✅ **Scoring par règles `rules-v1` (00016)**, calculé par la base (`compute_company_score`,
   `score_company`) et recalculé automatiquement à chaque changement de signal, de contact, de fiche
   ou d'ICP ; un job quotidien (`rescore-expired-signals`, 3 h 30) tient compte des signaux expirés.
   Barème sur 100 :
   - signaux valides, poids du métier ou surcharge de l'ICP (`signal_weights`) ; +5 par signal
     supplémentaire du même type, au plus +10 ;
   - fraîcheur : dernier signal de moins de 7 jours +10, de moins d'un mois +5 ;
   - taille : préférée par l'ICP +15, acceptée +8 ;
   - joignabilité : décideur identifié +5, e-mail +5, site connu +5 ;
   - éliminatoires (score 0) : pays hors cible, mot-clé exclu.
   Chaque calcul qui change le résultat est gardé dans `company_qualifications` avec ses raisons,
   affichées sur la fiche (« Pourquoi ce score »).
6. Qualification par IA en complément, sur les entreprises déjà filtrées par les règles.
7. Hunter.io en dernier, uniquement sur les entreprises qualifiées (quota gratuit limité),
   à partir du nom du dirigeant fourni par l'API Recherche d'entreprises.

**Exécution** (migrations 00012 et 00013, fonction `supabase/functions/prospection-run`) :
- `prospection_settings` : le planning et les critères de chaque utilisateur. `next_run_at` est
  calculé par la base dans le fuseau de l'utilisateur (9 h reste 9 h au changement d'heure).
- `pipeline_runs` : le journal des passages, en lecture seule pour l'utilisateur ; la base garantit
  un seul passage en cours à la fois.
- Un job `pg_cron` (`sophie-prospection`, toutes les heures à la minute 0) appelle la fonction en
  mode `scheduled` ; `claim_due_prospection_runs()` réserve atomiquement les plannings échus.
- « Lancer maintenant » appelle la même fonction en mode `manual` avec le jeton de l'utilisateur.
- La fonction répond tout de suite (202) et travaille en arrière-plan (`EdgeRuntime.waitUntil`) :
  l'hébergement Netlify coupe une action serveur au bout d'une dizaine de secondes.
- Déploiement : `npx supabase@latest functions deploy prospection-run --use-api`.
- Suspendre toutes les prospections automatiques : `select cron.unschedule('sophie-prospection');`
- Clés France Travail : dans `.env.local` pour le développement, et dans les secrets Supabase pour
  la fonction : `npx supabase@latest secrets set FRANCE_TRAVAIL_CLIENT_ID=… FRANCE_TRAVAIL_CLIENT_SECRET=…`
  (la fonction les relit à chaque démarrage, pas besoin de la redéployer).

**Point ouvert** : aucune API gouvernementale ne donne le site web de l'entreprise, indispensable
pour Hunter, la détection de stack et PageSpeed. Pistes : site présent dans certaines offres
France Travail, déduction à partir du nom avec vérification, saisie manuelle sur les retenues.

## Navigation cible

| Onglet | Rôle |
|---|---|
| Tableau de bord | Ce qui s'est passé depuis la dernière visite, relances du jour |
| Prospection | ✅ Régler Sophie : sources, zone, planning, lancement, historique (étape 5) |
| Entreprises | Le pipeline : ce que Sophie trouve arrive dans « À qualifier » |
| Relances | Inchangé |
| Références | Missions passées, citées dans les messages |
| Paramètres | Profil, ICP, étapes du pipeline, sources |

## Avant la refonte : passer à Next.js 16

`package.json` fixe `next` en **14.1.0**, touchée par la faille CVE-2025-29927 (un en-tête HTTP forgé
permet de sauter le middleware, qui gère l'authentification ici). Plutôt qu'un simple correctif en 14.2.x,
on passe directement à la dernière version (16.3.x) : une seule migration au lieu de deux.

À faire sur une branche dédiée, **avant** la refonte, pour qu'un bug ait une seule cause possible :

```bash
git switch -c chore/next-16
npx @next/codemod@canary upgrade latest          # next, react 19, middleware -> proxy, next lint -> eslint
npx @next/codemod@canary next-async-request-api . # params / searchParams asynchrones
npm install lucide-react@latest @types/react@latest @types/react-dom@latest
npm run typecheck && npm run build
```

Points à vérifier dans ce projet :

- `src/middleware.ts` devient `src/proxy.ts` (fonction `proxy`).
- `params` est une Promise dans `contacts/[id]`, `agencies/[id]` (pages et edit) : `const { id } = await params`.
- `createClient()` fait déjà `await cookies()` : rien à changer.
- `next lint` n'existe plus : script `lint` à remplacer par `eslint .` et `.eslintrc.json` par une config « flat ».
- React 19 : mettre à jour les dépendances qui déclarent React 18 comme maximum (lucide-react notamment).
- Tailwind reste en v3 : la v4 est une autre migration, à faire séparément.

## Tests réalisés

Les migrations 00001 à 00010 ont été rejouées sur un PostgreSQL vierge simulant les rôles Supabase
(`anon`, `authenticated`, propriétaire non superutilisateur). Vérifié :

- création du profil à l'inscription sans la politique supprimée ;
- initialisation idempotente, ICP pré-rempli depuis le métier ;
- dédoublonnage par domaine normalisé, SIREN, e-mail (insensible à la casse) et signal (upsert) ;
- expiration automatique des signaux ;
- version d'ICP incrémentée par la base (valeur envoyée par le client ignorée) ;
- score recopié sur l'entreprise, qualifications non modifiables ;
- brouillons ignorés pour la date de dernier échange ;
- isolation : un second utilisateur ne voit rien, ne peut ni se faire passer pour le premier
  ni rattacher un signal à son entreprise ; catalogues non modifiables ;
- `initialize_user_defaults` refusée pour le compte d'un autre et pour `anon` ;
- suppression d'une étape : l'entreprise est conservée, seule `stage_id` passe à NULL.

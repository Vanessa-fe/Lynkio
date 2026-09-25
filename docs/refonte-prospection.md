# Refonte : outil de prospection multi-métiers

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

1. **Onboarding** : choix du métier (`user_profiles.profession_key`), puis appel de
   `initialize_prospection_defaults()` (sans paramètre, sécurisée par la RLS).
2. **Module Entreprises** : reprendre les composants `agencies/*` (liste, fiche, formulaire, timeline)
   sur `companies`, `company_contacts` et `company_interactions`.
3. **Détecteurs existants** :
   - `detect-stack` écrit `companies.detected_stack` et, si la stack correspond, un signal `tech_stack_match`.
   - `find-contact` lit les postes à cibler dans `professions.target_roles` au lieu de `TECH_LEAD_KEYWORDS`.
4. **Paramètres** : étapes et sources sur `pipeline_stages` / `lead_sources` ; nouvel écran ICP.
5. **Import / export, tableau de bord, relances** sur le nouveau modèle.

### Étape 4 : supprimer l'ancien modèle (00012, « contract »)

Une fois plus aucun code ne référence les anciennes tables : suppression de `contacts`,
`contact_*`, `interactions`, `appointments`, `payments`, `agencies`, `agency_*`,
`initialize_user_defaults`, des colonnes `reminders.contact_id` / `reminders.agency_id`
et de `user_profiles.business_type`, puis du code associé.

### Étape 5 : le pipeline automatique (« Sophie »)

1. Premier détecteur : API Recherche d'entreprises → signal `recently_created`.
2. Scoring par règles (`model = 'rules-v1'`) à partir de l'ICP et des poids de signaux.
3. Qualification par IA en complément, sur les entreprises déjà filtrées par les règles.
4. Table `pipeline_runs` pour journaliser chaque exécution du cron.

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

# Lynkio

Outil de prospection B2B pour freelances. Sophie, l'agente automatique, repère les entreprises qui
ont probablement besoin d'un freelance (offres d'emploi, missions), les note selon le client idéal
et les range dans un pipeline. Premier métier pris en charge : développeuse web.

- Où en est le projet : [docs/avancement.md](docs/avancement.md)
- Choix techniques et détail des étapes : [docs/refonte-prospection.md](docs/refonte-prospection.md)

## Stack technique

- **Framework** : Next.js 16 (App Router), React 19, TypeScript strict
- **Styling** : Tailwind CSS 3, composants shadcn/ui, icônes Lucide
- **Base de données et authentification** : Supabase (PostgreSQL, RLS, pg_cron, Edge Functions)
- **Formulaires** : React Hook Form + Zod
- **Sources de données** : France Travail (offres d'emploi), BODACC et API Recherche d'entreprises,
  Hunter.io (contacts)

## Prérequis

- Node.js 22 (voir `.nvmrc`)
- Un projet Supabase

## Installation

```bash
git clone <repository-url>
cd prospect
npm install
cp .env.local.example .env.local
```

Compléter `.env.local` (ce fichier ne doit jamais être commité) :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
HUNTER_API_KEY=
FRANCE_TRAVAIL_CLIENT_ID=
FRANCE_TRAVAIL_CLIENT_SECRET=
```

Les clés France Travail servent aussi à la fonction `prospection-run` : elles se déclarent dans les
secrets Supabase (`npx supabase@latest secrets set ...`).

## Base de données

Les changements de schéma passent uniquement par des fichiers de migration (`supabase/migrations`),
jamais par l'éditeur SQL :

```bash
npx supabase@latest db push --dry-run   # voir ce qui sera appliqué
npx supabase@latest db push             # appliquer
npm run supabase:generate-types         # régénérer les types TypeScript
```

## Scripts

- `npm run dev` : serveur de développement
- `npm run build` : build de production
- `npm run lint` : ESLint
- `npm run typecheck` : vérification des types
- `npm run supabase:generate-types` : types TypeScript depuis Supabase

## Structure

```
prospect/
├── src/
│   ├── app/              # Pages et routes (App Router)
│   ├── components/       # Composants React
│   ├── lib/
│   │   ├── actions/      # Server Actions
│   │   ├── queries/      # Lecture des données
│   │   ├── validations/  # Schémas Zod
│   │   └── detectors/    # Analyse des sites (stack technique)
│   └── types/            # Types TypeScript (dont types générés)
├── supabase/
│   ├── migrations/       # Migrations SQL
│   └── functions/        # Edge Function de Sophie (prospection-run)
└── docs/                 # Plan et avancement
```

## Fonctionnalités

- **Prospection** : réglages de Sophie (planning, départements, sources), lancement manuel,
  historique des passages, offres anonymes à identifier.
- **Entreprises** : pipeline par étapes, fiche avec signaux d'achat, score expliqué, contacts,
  échanges, analyse du site, recherche de contact.
- **Relances** rattachées aux entreprises.
- **Tableau de bord** : pistes en cours, relances du jour, meilleures opportunités.
- **Paramètres** : profil, client idéal, étapes du pipeline, sources.
- **Import / export** CSV des entreprises.

## Sécurité

- Row Level Security sur toutes les tables, clés étrangères composites `(id, user_id)`.
- Validation Zod côté serveur, score et dédoublonnage garantis par la base.
- Protection SSRF pour l'analyse des sites, protection contre l'injection de formules dans les exports.

## Déploiement

Netlify déploie automatiquement la branche `main` (https://lynkio.netlify.app).

## Licence

Propriétaire - Tous droits réservés

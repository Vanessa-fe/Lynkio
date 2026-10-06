import {
  Bell,
  Briefcase,
  Building2,
  Code2,
  Globe,
  Landmark,
  Rocket,
  ScanSearch,
  Sparkles,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const navLinks = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#comment-ca-marche', label: 'Comment ça marche' },
  { href: '#fiabilite', label: 'Fiabilité' },
]

export const hero = {
  eyebrow: 'Pour les développeurs et développeuses web freelance',
  title: 'Trouvez les entreprises qui ont besoin de vous, *au bon moment.*',
  intro:
    'Sophie, votre assistante de prospection, repère les entreprises qui recrutent pour leur site, publient une mission ou utilisent votre technologie. Elle les note selon votre client idéal et prépare votre premier message.',
  reassurance: 'Sources publiques, sites vérifiés, messages relus par vous.',
}

/** Fiches d'exemple qui défilent dans la carte de Sophie (entreprises fictives, une par cible) */
export type ExampleSignal = { icon: LucideIcon; title: string; detail: string }
export type Example = {
  company: string
  meta: string
  segment: string
  segmentIcon: LucideIcon
  score: number
  signals: ExampleSignal[]
  badges: string[]
  message: string
}

export const examples: Example[] = [
  {
    company: 'Atelier Lumen',
    meta: 'Luminaires · Lyon',
    segment: 'TPE / PME',
    segmentIcon: Building2,
    score: 82,
    signals: [
      { icon: Zap, title: 'Recrute pour le web ou le digital', detail: '« Chargé·e de projet web » · il y a 2 jours' },
      { icon: Code2, title: 'Stack technique compatible', detail: 'Site fait avec Next.js' },
    ],
    badges: ['CA 1,8 M€', 'Budget confortable', 'Décideur identifié'],
    message:
      'Bonjour Claire, j’ai vu que vous recrutez un·e chargé·e de projet web pour faire évoluer votre boutique en ligne. En attendant le bon profil, je peux prendre en main un projet précis, à distance…',
  },
  {
    company: 'Studio Brume',
    meta: 'Agence web · Nantes',
    segment: 'Agence',
    segmentIcon: Users,
    score: 76,
    signals: [
      { icon: Users, title: 'Agence ou startup qui recrute un développeur', detail: '« Développeur·se React » · hier' },
      { icon: Code2, title: 'Stack technique compatible', detail: 'Projets en React et Node.js' },
    ],
    badges: ['12 salariés', 'Renfort possible', 'Contact trouvé'],
    message:
      'Bonjour Hugo, vous cherchez un·e développeur·se React. Le temps de recruter, je peux renforcer l’équipe sur un projet en cours, à distance et sans période d’adaptation…',
  },
  {
    company: 'Kalia',
    meta: 'Logiciel SaaS · Bordeaux',
    segment: 'Startup',
    segmentIcon: Rocket,
    score: 88,
    signals: [
      { icon: Sparkles, title: 'Mission ouverte aux freelances', detail: '« Refonte du tableau de bord » · il y a 3 jours' },
      { icon: Code2, title: 'Stack technique compatible', detail: 'Application en React' },
    ],
    badges: ['18 salariés', 'Renfort produit', 'Décideur identifié'],
    message:
      'Bonjour Inès, j’ai vu votre mission sur la refonte du tableau de bord de Kalia. Je travaille en React au quotidien et je peux démarrer rapidement ; voici comment je m’y prendrais…',
  },
]

/** Sources surveillées par Sophie (section radar) */
export const sources = [
  { icon: Briefcase, title: 'Offres d’emploi France Travail', text: 'Recrutements web et digital' },
  { icon: Sparkles, title: 'Missions freelance', text: 'Projets ouverts aux indépendants' },
  { icon: Landmark, title: 'Registre des entreprises', text: 'Sociétés tout juste créées' },
  { icon: Globe, title: 'Sites web analysés', text: 'La technologie vérifiée dans le code' },
]

/** Points du radar : angle en degrés (sens horaire depuis le haut), distance au centre (0 à 1) */
export const radarBlips = [
  { angle: 38, distance: 0.58, label: 'Recrute · Lyon' },
  { angle: 118, distance: 0.78, label: 'Mission · Nantes' },
  { angle: 215, distance: 0.38 },
  { angle: 252, distance: 0.72, label: 'Agence · Lille' },
  { angle: 318, distance: 0.62 },
]

export const beforeAfter = {
  title: 'Prospecter à froid, c’est écrire au hasard. *Sophie attend un signal.*',
  before: {
    label: 'À l’aveugle',
    items: [
      'Des listes d’entreprises prises au hasard',
      'Le même message envoyé à tout le monde',
      'Des relances oubliées, des pistes qui refroidissent',
    ],
  },
  after: {
    label: 'Avec Sophie',
    items: [
      'Des entreprises qui recrutent ou publient une mission maintenant',
      'Un premier message qui part d’un fait précis',
      'Les relances du jour, au bon moment',
    ],
  },
}

export type Feature = { icon: LucideIcon; title: string; text: string }

export const features: Record<'signals' | 'tech' | 'score' | 'records' | 'messages' | 'pipeline', Feature> = {
  signals: {
    icon: Zap,
    title: 'Des signaux d’achat, pas des listes',
    text: 'Offres d’emploi web et digital publiées sur France Travail, missions ouvertes aux freelances, entreprises tout juste créées : Sophie repère celles qui ont un besoin maintenant.',
  },
  tech: {
    icon: ScanSearch,
    title: 'Recherche par technologie',
    text: 'L’IA cherche des entreprises dont le site est fait avec votre stack. Sophie analyse ensuite chaque site : sans la technologie dans son code, l’entreprise est écartée.',
  },
  score: {
    icon: Target,
    title: 'Un score selon votre client idéal',
    text: 'Taille, signaux récents, budget au regard de votre tarif journalier : chaque entreprise reçoit une note sur 100, avec le détail du calcul.',
  },
  records: {
    icon: Building2,
    title: 'Des fiches complètes',
    text: 'SIREN, dirigeants, chiffre d’affaires, technologies du site, contacts et profils LinkedIn, réunis au même endroit.',
  },
  messages: {
    icon: Sparkles,
    title: 'Des messages qui partent d’un fait',
    text: 'Sophie rédige un premier e-mail ou message LinkedIn à partir du signal et du site de l’entreprise. Le code le contrôle, vous le relisez, vous l’envoyez : c’est noté.',
  },
  pipeline: {
    icon: Bell,
    title: 'Pipeline et relances',
    text: 'Étapes, échanges et relances du jour : vous savez toujours qui recontacter, et quand.',
  },
}

export const steps = [
  {
    title: 'Décrivez votre client idéal',
    text: 'Taille d’entreprise, technologies, tarif journalier, départements : quelques réglages suffisent.',
  },
  {
    title: 'Sophie cherche pour vous',
    text: 'Aux jours et à l’heure que vous choisissez, elle parcourt les sources et ajoute les entreprises qui correspondent.',
  },
  {
    title: 'Contactez les meilleures pistes',
    text: 'Les entreprises les mieux notées en premier, un message prêt à relire, une relance programmée.',
  },
]

export const safeguards = [
  {
    title: 'Des sources publiques',
    text: 'Chaque entreprise vient d’une source vérifiable : offres France Travail, registre officiel des entreprises.',
  },
  {
    title: 'Des sites analysés',
    text: 'Chaque site est analysé avant qu’une technologie soit retenue.',
  },
  {
    title: 'Des messages contrôlés',
    text: 'Lien inconnu, champ à compléter, prix : chaque message est vérifié, puis relu par vous avant l’envoi.',
  },
]

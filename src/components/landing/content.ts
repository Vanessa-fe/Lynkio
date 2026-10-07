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
import { SIGNUPS_CLOSED_MESSAGE, SIGNUPS_OPEN } from '@/lib/constants/signup'

export const navLinks = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#comment-ca-marche', label: 'Comment ça marche' },
  { href: '#fiabilite', label: 'Fiabilité' },
  { href: '#questions', label: 'Questions' },
]

/** Nom et définition de la marque : les mêmes partout (page, balises, données structurées) */
export const brand = {
  name: 'Lynkio',
  category: 'Outil de prospection pour les développeurs et développeuses web freelance',
  definition:
    'Lynkio est un outil de prospection B2B pour les freelances, pensé d’abord pour les développeurs et développeuses web. Son assistante, Sophie, repère les entreprises qui montrent un besoin, les note sur 100 selon votre client idéal et prépare un premier message.',
}

export const hero = {
  eyebrow: 'Outil de prospection pour les développeurs et développeuses web freelance',
  title: 'Trouvez les entreprises qui ont besoin de vous, *au bon moment.*',
  intro:
    'Sophie, l’assistante de prospection de Lynkio, repère les entreprises qui recrutent pour leur site, publient une mission ou utilisent votre technologie. Elle les note selon votre client idéal et prépare votre premier message.',
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
  { icon: Landmark, title: 'Registre des entreprises', text: 'Sociétés tout juste créées, en option' },
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
    text: 'Taille de l’entreprise, nature et fraîcheur des signaux, décideur identifié : chaque entreprise reçoit une note sur 100, avec le détail du calcul. Son budget est estimé au regard de votre tarif journalier.',
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
    text: 'Étapes, échanges, listes de prospects et relances du jour : vous savez toujours qui recontacter, et quand. Import CSV, profils LinkedIn et retour des campagnes Waalaxy inclus.',
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
    text: 'Chaque piste s’appuie sur une source vérifiable : une offre France Travail, le registre officiel des entreprises ou le code du site lui-même.',
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

/**
 * Questions fréquentes : affichées sur la page et reprises telles quelles dans les données
 * structurées (FAQPage). Réponses autonomes et factuelles, pour être citables par les moteurs.
 */
export const faq = [
  {
    question: 'Qu’est-ce que Lynkio ?',
    answer:
      'Lynkio est un outil de prospection B2B pour les freelances, pensé d’abord pour les développeurs et développeuses web. Son assistante, Sophie, repère les entreprises qui montrent un besoin (une offre d’emploi, une mission, une technologie), les note sur 100 selon votre client idéal et prépare un premier message. Lynkio suit ensuite vos échanges et vos relances, jusqu’au client signé.',
  },
  {
    question: 'Qu’est-ce qu’un signal d’achat ?',
    answer:
      'C’est un fait public qui laisse penser qu’une entreprise a besoin de vous maintenant : une offre d’emploi web ou digital publiée sur France Travail, une mission ouverte aux freelances, une agence ou une startup qui recrute un développeur, une société tout juste créée, ou un site fait avec la technologie que vous maîtrisez.',
  },
  {
    question: 'D’où viennent les entreprises proposées ?',
    answer:
      'De sources publiques : les offres d’emploi France Travail, le registre officiel des entreprises (en option) et une recherche par technologie dont chaque résultat est vérifié dans le code du site. Chaque fiche réunit ensuite le SIREN, les dirigeants, le chiffre d’affaires publié et les contacts trouvés.',
  },
  {
    question: 'Comment est calculé le score sur 100 ?',
    answer:
      'Selon votre client idéal : taille de l’entreprise, nature et fraîcheur des signaux, décideur identifié, moyen de contact connu. Le détail du calcul est affiché sur chaque fiche. Le budget de l’entreprise est estimé à part, au regard de votre tarif journalier.',
  },
  {
    question: 'Sophie envoie-t-elle les messages à ma place ?',
    answer:
      'Non. Sophie rédige un premier e-mail ou message LinkedIn à partir du signal et du site de l’entreprise. Le code le vérifie (lien inconnu, champ à compléter, prix), puis vous le relisez et l’envoyez vous-même. Un clic suffit ensuite pour le noter dans l’historique.',
  },
  {
    question: 'Quelles entreprises Lynkio cible-t-il ?',
    answer:
      'Des entreprises en France, de trois types : les agences web qui ont besoin de renfort, les TPE et PME qui veulent un site ou un outil, et les startups ou éditeurs SaaS qui renforcent leur équipe produit. Vous réglez la taille, les technologies et les départements visés.',
  },
  {
    question: 'Puis-je importer mes prospects existants ?',
    answer:
      'Oui : import CSV d’entreprises ou de personnes, ajout d’un profil LinkedIn depuis votre navigateur, et import de l’export Waalaxy pour retrouver invitations, messages et réponses dans l’historique de chaque personne.',
  },
]

/** Toutes les questions, avec l'accès qui dépend de l'ouverture des inscriptions */
export const faqItems = [
  ...faq,
  {
    question: 'Comment accéder à Lynkio ?',
    answer: SIGNUPS_OPEN
      ? 'Créez votre compte, choisissez votre métier puis réglez votre client idéal en quelques minutes. Sophie lance ensuite ses recherches aux jours et à l’heure que vous choisissez.'
      : `Lynkio est en test privé. ${SIGNUPS_CLOSED_MESSAGE}`,
  },
]

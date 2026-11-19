import {
  Bell,
  Building2,
  Landmark,
  Newspaper,
  Rocket,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { PLAN_LIMITS } from '@/lib/billing'

export const navLinks = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#comment-ca-marche', label: 'Comment ça marche' },
  { href: '#transparence', label: 'Transparence' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#questions', label: 'Questions' },
]

/** Nom et définition de la marque : les mêmes partout (page, balises, données structurées) */
export const brand = {
  name: 'Filonea',
  category: 'Outil de prospection pour les freelances',
  definition:
    'Filonea est un outil de prospection B2B pour les freelances qui vendent leurs services aux entreprises. Son assistante, Sophie, repère les entreprises qui montrent un besoin, les note sur 100 selon votre client idéal et prépare un premier message.',
}

export const hero = {
  eyebrow: 'L’outil de prospection des freelances',
  title: 'Trouvez de nouvelles entreprises\n*à prospecter chaque\u00a0semaine.*',
  intro:
    'Filonea recherche automatiquement des entreprises selon vos critères. Repérez celles à contacter en priorité et gardez le fil de vos relances.',
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
    company: 'Cabinet Ardent',
    meta: 'Cabinet de recrutement · Rennes',
    segment: 'TPE / PME',
    segmentIcon: Building2,
    score: 82,
    signals: [
      { icon: Target, title: 'Correspond à vos critères', detail: 'Recrutement · Bretagne' },
      { icon: Landmark, title: 'Création récente', detail: 'Source BODACC' },
    ],
    badges: ['Dirigeante identifiée', 'Profil LinkedIn trouvé'],
    message:
      'Bonjour Claire, j’ai vu que vous veniez de lancer votre cabinet. Si vous prévoyez de publier vos offres sur votre propre site, je peux vous aider à mettre en place une page simple pour recevoir les candidatures…',
  },
  {
    company: 'Studio Brume',
    meta: 'Agence web · Nantes',
    segment: 'Agence',
    segmentIcon: Users,
    score: 76,
    signals: [
      { icon: Target, title: 'Correspond à vos critères', detail: 'Agence web · 12 salariés · Loire-Atlantique' },
      { icon: Newspaper, title: 'Développement annoncé', detail: 'Trouvé avec « Approfondir » · site de l’agence' },
    ],
    badges: ['12 salariés', 'Dirigeant identifié', 'Profil LinkedIn trouvé'],
    message:
      'Bonjour Hugo, j’ai lu que Studio Brume ouvrait de nouveaux marchés. Quand vos projets se chevauchent, je peux renforcer l’équipe sur un projet précis, à distance…',
  },
  {
    company: 'Kalia',
    meta: 'Logiciel SaaS · Bordeaux',
    segment: 'Startup',
    segmentIcon: Rocket,
    score: 88,
    signals: [
      { icon: Landmark, title: 'Fiche officielle', detail: 'Éditeur de logiciels · créé en 2021 · CA publié' },
      { icon: Newspaper, title: 'Financement annoncé', detail: 'Trouvé avec « Approfondir » · article de presse' },
    ],
    badges: ['CA publié', 'Dirigeante identifiée', 'E-mail trouvé'],
    message:
      'Bonjour Inès, félicitations pour la levée de fonds de Kalia. Si vous renforcez votre marketing dans les prochains mois, je peux vous aider sur la stratégie de contenu…',
  },
]

/** Points du radar : angle en degrés (sens horaire depuis le haut), distance au centre (0 à 1) */
export const radarBlips = [
  { angle: 38, distance: 0.58, label: 'PME · Lyon' },
  { angle: 118, distance: 0.78, label: 'Commerce · Nantes' },
  { angle: 215, distance: 0.38 },
  { angle: 252, distance: 0.72, label: 'Agence · Lille' },
  { angle: 318, distance: 0.62 },
]

export const beforeAfter = {
  title: 'Votre prospection avance,\n*même les semaines chargées.*',
  before: {
    label: 'À la main',
    items: [
      'Chercher de nouvelles entreprises une par une',
      'Trouver quoi dire dans le premier message',
      'Se souvenir de qui relancer et quand',
    ],
  },
  after: {
    label: 'Avec Filonea',
    items: [
      'Recevez les résultats de vos recherches planifiées',
      'Partez d’une suggestion de Sophie et adaptez-la à votre façon',
      'Retrouvez les prospects à relancer dans vos rappels',
    ],
  },
}

export type Feature = { icon: LucideIcon; title: string; text: string }

export const features: Record<'messages' | 'score' | 'records' | 'pipeline', Feature> = {
  messages: {
    icon: Sparkles,
    title: 'Préparez un premier message à partir d’un fait',
    text: 'Sophie vous propose un brouillon d’e-mail ou de message LinkedIn à partir des informations disponibles sur l’entreprise. Vous pouvez le modifier avant de l’envoyer.',
  },
  score: {
    icon: Target,
    title: 'Priorisez vos prospects',
    text: 'Visualisez en un coup d’œil à quel point une entreprise correspond à vos critères et consultez le détail de son score.',
  },
  records: {
    icon: Building2,
    title: 'Retrouvez les infos utiles avant d’écrire',
    text: 'Consultez les informations disponibles sur l’entreprise, comme ses dirigeants, son chiffre d’affaires ou ses profils LinkedIn.',
  },
  pipeline: {
    icon: Bell,
    title: 'Gardez le fil de vos relances',
    text: 'Retrouvez vos échanges et voyez qui relancer aujourd’hui.',
  },
}

export const steps = [
  {
    title: 'Définissez votre cible',
    text: 'Indiquez les secteurs, les zones géographiques et les tailles d’entreprise qui vous intéressent.',
  },
  {
    title: 'Sophie lance les recherches',
    text: 'Choisissez les jours et l’heure de vos recherches. Sophie repère les entreprises qui correspondent à vos critères et les ajoute à vos résultats.',
  },
  {
    title: 'Choisissez à qui écrire',
    text: 'Consultez les résultats, sélectionnez les entreprises qui vous intéressent et partez d’un brouillon que vous pouvez adapter avant l’envoi.',
  },
]

export const safeguards: { title: string; text: string; example?: string }[] = [
  {
    title: 'Des sources publiques',
    text: 'Filonea s’appuie sur des données publiques, notamment le registre des entreprises et les annonces du BODACC, pour repérer des entreprises selon vos critères.',
    example: 'Création récente · Source BODACC',
  },
  {
    title: 'Des brouillons modifiables',
    text: 'Sophie vous propose un brouillon d’e-mail ou de message LinkedIn. Vous pouvez le relire et le modifier, puis l’envoyer vous-même au moment qui vous convient.',
  },
]

/**
 * Tarifs (15/11/2026) : deux offres. Essentiel, accessible pour démarrer ; Pro, l'offre complète mise en
 * avant. L'IA est payée par l'utilisateur à son fournisseur. Les limites viennent de PLAN_LIMITS (appliquées
 * par l'application et par Sophie) ; les prix doivent correspondre aux prix Stripe (clés essentiel_monthly,
 * essentiel_yearly, pro_monthly, pro_yearly).
 */
const { essentiel, pro } = PLAN_LIMITS

export const plans = [
  {
    key: 'essentiel',
    name: 'Essentiel',
    tagline: 'Pour prospecter chaque semaine',
    monthly: 9,
    yearly: 90,
    highlighted: false,
    searches: `${essentiel.runsPerWeek} par semaine · jusqu’à ${essentiel.companiesPerRun} entreprises par recherche`,
    keywords: `Jusqu’à ${essentiel.searchKeywords}`,
    features: [
      'Score de chaque prospect sur 100',
      'Fiche entreprise complète',
      'E-mails de prospection rédigés par Sophie',
      'Suivi des prospects et rappels à planifier',
      'Export de vos données',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'Pour prospecter plus souvent et élargir vos recherches',
    monthly: 20,
    yearly: 200,
    highlighted: true,
    searches: `Jusqu’à ${pro.daysPerWeek} jours sur 7 · jusqu’à ${pro.companiesPerRun} entreprises par recherche`,
    keywords: `Jusqu’à ${pro.searchKeywords}`,
    features: [
      'Tout Essentiel, et :',
      'Suggestions de messages LinkedIn et de relance',
      'Extension LinkedIn',
      'E-mails des décideurs',
      'Import de vos prospects',
    ],
  },
] as const

export const trialDays = 14

/**
 * Questions fréquentes : affichées sur la page et reprises telles quelles dans les données
 * structurées (FAQPage). Réponses autonomes et factuelles, pour être citables par les moteurs.
 */
export const faq = [
  {
    question: 'Comment fonctionnent les 14 jours d’essai ?',
    answer:
      'Vous pouvez essayer Filonea Pro pendant 14 jours sans renseigner de carte bancaire. Vous pouvez choisir une offre pendant ou après l’essai : si vous la choisissez pendant, le premier prélèvement a lieu à la fin de l’essai. Si vous ne choisissez aucune offre, l’essai se termine sans prélèvement.',
  },
  {
    question: 'À qui s’adresse Filonea ?',
    answer:
      'Aux freelances et indépendants qui proposent leurs services à des entreprises. Que vous fassiez du conseil, de la rédaction, du design ou du développement, vous choisissez les secteurs, les zones et les tailles d’entreprise qui vous intéressent.',
  },
  {
    question: 'D’où viennent les entreprises proposées ?',
    answer:
      'Filonea s’appuie sur des sources publiques, comme le registre des entreprises et les annonces du BODACC, pour repérer les entreprises qui correspondent à vos critères.',
  },
  {
    question: 'À quoi sert le score sur 100 ?',
    answer:
      'Il vous aide à choisir quelles entreprises examiner en priorité. Vous pouvez consulter le détail du score et ajuster le poids des signaux qui comptent pour vous, comme une création récente.',
  },
  {
    question: 'Qui envoie les messages et les relances ?',
    answer:
      'Sophie vous propose des textes que vous pouvez adapter. Vous envoyez vous-même vos messages et vos relances. Les rappels vous aident à retrouver les prospects à recontacter.',
  },
  {
    question: 'Ai-je besoin d’une clé API pour utiliser Filonea ?',
    answer:
      'Vous pouvez rechercher des entreprises, consulter leurs fiches et leurs scores, et suivre vos prospects sans clé API. Si vous souhaitez discuter avec Sophie, obtenir de l’aide pour rédiger vos messages ou utiliser la fonction « Approfondir », ajoutez votre propre clé API. Votre fournisseur peut vous facturer cet usage séparément, y compris pendant l’essai.',
  },
  {
    question: 'Puis-je importer mes prospects existants ?',
    answer: 'Oui, l’offre Pro permet d’importer vos prospects depuis un fichier CSV ou un export Waalaxy.',
  },
]

/** Questions affichées sur la page et reprises dans les données structurées (FAQPage) */
export const faqItems = faq

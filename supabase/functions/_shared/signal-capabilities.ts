// Registre des capacités de détection de Sophie (signaux d'opportunité, étape 2).
//
// Une capacité = une méthode RÉELLEMENT exécutée par le code aujourd'hui (rien de prévu, rien de
// supposé). Le registre dit, pour chacune : quelles données il lui faut, comment elle détecte, quand
// elle tourne, ce qu'elle coûte, sa fiabilité, la preuve qu'elle garde, et les signaux qu'elle crée.
// Sophie (étape 3) ne pourra recommander que des signaux reliés à une capacité de ce registre.
//
// Couches :
//   capacité (ce fichier)  →  signal (signal_types, en base)  →  poids et score (compute_company_score_v2)
//
// Règles vérifiées par src/lib/__checks__/signal-capabilities.check.ts :
//   - chaque signal « available » est créé par une capacité, et seulement par une capacité existante ;
//   - une capacité qui sert à comprendre l'entreprise (purpose « context ») ne crée jamais de signal ;
//   - aucune capacité payante en IA ne tourne pendant les recherches standards (trigger « during_search »).
//
// Sites web : on distingue
//   - site_context  : lire le site pour comprendre l'entreprise (texte pour les messages) ; jamais de points ;
//   - site_analysis : analyser le site pour repérer une opportunité, par domaine (SiteAnalysisArea).
// D'autres domaines (SEO, rédaction, accessibilité, performance) pourront s'ajouter comme nouvelles
// capacités site_analysis, chacune avec son propre détecteur, sans changer cette structure.
//
// Ce fichier n'importe rien : il est lu par l'application (Next.js) comme par les fonctions (Deno).

/** Famille de la capacité */
export type CapabilityFamily =
  | 'company_data' // données publiques sur l'entreprise (registre, annonces légales)
  | 'site_context' // lecture du site pour comprendre l'entreprise
  | 'site_analysis' // analyse du site qui peut révéler une opportunité
  | 'web_research' // recherche sur Internet par l'IA de l'utilisateur

/** Domaine d'une analyse de site (site_analysis). Seul « technical » existe aujourd'hui. */
export type SiteAnalysisArea = 'technical' | 'seo' | 'editorial' | 'accessibility' | 'performance'

/** À quoi sert la capacité */
export type CapabilityPurpose =
  | 'signal' // crée des signaux d'opportunité
  | 'fit' // nourrit l'adéquation au client idéal (secteur, taille, zone, ancienneté), sans signal
  | 'context' // aide à comprendre l'entreprise (rédaction des messages), sans points
  | 'sourcing' // trouve de nouvelles entreprises

/** Quand elle tourne */
export type CapabilityTrigger =
  | 'during_search' // à chaque prospection (automatique ou lancée à la main)
  | 'company_action' // sur une fiche, quand l'utilisateur le demande
  | 'on_demand' // lancée exprès par l'utilisateur (recherche ponctuelle)

/** Données dont elle a besoin */
export type CapabilityInput = 'siren' | 'company_name' | 'postal_code' | 'website' | 'user_technologies' | 'search_filters'

/** Ce qu'elle garde comme preuve */
export type CapabilityEvidence =
  | 'official_record' // fiche ou annonce officielle (registre, BODACC), avec sa date
  | 'page_url' // adresse de la page analysée, avec la date de l'analyse
  | 'consulted_url' // page réellement consultée par la recherche web de l'IA

export type CapabilityReliability = 'high' | 'medium' | 'low'

/** Source enregistrée sur le signal (company_signals.source) */
export type CapabilitySource = 'bodacc' | 'registry' | 'site' | 'ai_research'

export type SignalCapability = {
  /** Identifiant stable : ne jamais le renommer (il sera enregistré dans les recommandations) */
  id: string
  label: string
  /** Ce que l'utilisateur lit : comment Sophie le repère */
  detectionLabel: string
  family: CapabilityFamily
  /** Seulement pour site_analysis */
  area?: SiteAnalysisArea
  purpose: CapabilityPurpose
  trigger: CapabilityTrigger
  inputs: CapabilityInput[]
  method: string
  cost: {
    /** Appel à l'IA de l'utilisateur (sa clé, sa facture) */
    ai: 'none' | 'generation' | 'web_search'
    /** Appel réseau : API publique, ou lecture d'une page du site */
    network: 'public_api' | 'site_fetch' | 'ai_provider'
  }
  reliability: CapabilityReliability
  source: CapabilitySource
  evidence: CapabilityEvidence
  /**
   * Durée pendant laquelle l'observation reste valable quand la capacité ne crée pas de signal.
   * Pour un signal, la durée qui compte est celle de son type (signal_types.default_ttl_days).
   */
  validityDays?: number
  /** Types de signaux créés (signal_types.key) */
  signals: string[]
  /** Où se trouve le code (pour la maintenance) */
  implementedIn: string[]
}

export const SIGNAL_CAPABILITIES: readonly SignalCapability[] = [
  {
    id: 'registry_profile',
    label: 'Registre officiel des entreprises',
    detectionLabel: 'Registre officiel, à chaque recherche',
    family: 'company_data',
    purpose: 'fit',
    trigger: 'during_search',
    inputs: ['search_filters'],
    method:
      'API Recherche d’entreprises (gratuite, sans clé) : secteur NAF, tranche d’effectif, date de création, siège, dirigeants, finances publiées',
    cost: { ai: 'none', network: 'public_api' },
    reliability: 'high',
    source: 'registry',
    evidence: 'official_record',
    validityDays: 365,
    signals: [],
    implementedIn: ['supabase/functions/prospection-run/detect-profile.ts'],
  },
  {
    id: 'bodacc_creations',
    label: 'Créations d’entreprises (BODACC)',
    detectionLabel: 'Annonces légales BODACC, à chaque recherche (si la source est cochée)',
    family: 'company_data',
    purpose: 'signal',
    trigger: 'during_search',
    inputs: ['search_filters'],
    method: 'Annonces de création publiées au BODACC (open data), lues de la plus récente à la plus ancienne',
    cost: { ai: 'none', network: 'public_api' },
    reliability: 'high',
    source: 'bodacc',
    evidence: 'official_record',
    signals: ['recently_created'],
    implementedIn: ['supabase/functions/prospection-run/detect-recent-creations.ts'],
  },
  {
    id: 'site_context',
    label: 'Lecture du site pour comprendre l’entreprise',
    detectionLabel: 'Page d’accueil lue au moment de rédiger un message',
    family: 'site_context',
    purpose: 'context',
    trigger: 'company_action',
    inputs: ['website'],
    method: 'Texte de la page d’accueil extrait par le code (l’IA ne lit jamais le site elle-même)',
    cost: { ai: 'none', network: 'site_fetch' },
    reliability: 'medium',
    source: 'site',
    evidence: 'page_url',
    validityDays: 30,
    signals: [],
    implementedIn: ['supabase/functions/draft-message/site-text.ts'],
  },
  {
    id: 'site_technical_stack',
    label: 'Technologies du site',
    detectionLabel: 'Analyse du site depuis la fiche, ou recherche par technologie',
    family: 'site_analysis',
    area: 'technical',
    purpose: 'signal',
    trigger: 'company_action',
    inputs: ['website', 'user_technologies'],
    method:
      'Marqueurs dans le code de la page d’accueil (Next.js, React, WordPress, Webflow), comparés aux technologies choisies dans Client idéal',
    cost: { ai: 'none', network: 'site_fetch' },
    reliability: 'medium',
    source: 'site',
    evidence: 'page_url',
    signals: ['tech_stack_match'],
    implementedIn: [
      'supabase/functions/_shared/public-page.ts',
      'src/lib/actions/companies.ts (analyzeCompanyWebsite)',
      'supabase/migrations/00017_tech_stack_signal.sql (sync_tech_stack_signal)',
    ],
  },
  {
    id: 'site_technical_protocol',
    label: 'Protocole du site (HTTP ou HTTPS)',
    detectionLabel: 'Analyse du site depuis la fiche',
    family: 'site_analysis',
    area: 'technical',
    purpose: 'signal',
    trigger: 'company_action',
    inputs: ['website'],
    method: 'Adresse finale de la page d’accueil après redirections : une page servie en HTTP est notée avec sa date',
    cost: { ai: 'none', network: 'site_fetch' },
    reliability: 'medium',
    source: 'site',
    evidence: 'page_url',
    signals: ['website_http_observed'],
    implementedIn: [
      'src/lib/actions/companies.ts (analyzeCompanyWebsite)',
      'supabase/migrations/00059_website_audit.sql (sync_website_protocol_signal)',
    ],
  },
  {
    id: 'tech_web_research',
    label: 'Recherche par technologie',
    detectionLabel: 'Recherche sur Internet par votre IA, lancée à la demande',
    family: 'web_research',
    purpose: 'sourcing',
    trigger: 'on_demand',
    inputs: ['user_technologies'],
    method:
      'Votre IA cherche des entreprises dont le site utilise vos technologies ; chaque site est ensuite vérifié par l’analyse technique, sinon l’entreprise est écartée',
    cost: { ai: 'web_search', network: 'ai_provider' },
    reliability: 'medium',
    source: 'ai_research',
    evidence: 'consulted_url',
    signals: [],
    implementedIn: [
      'supabase/functions/prospection-run/ai-research.ts',
      'supabase/functions/prospection-run/detect-tech-users.ts',
    ],
  },
]

/**
 * Disponibilité attendue de chaque type de signal (doit correspondre à signal_types.availability, 00065).
 * Un signal « available » a forcément une capacité ; les autres n'en ont pas.
 */
export const SIGNAL_TYPE_AVAILABILITY: Readonly<Record<string, 'available' | 'unavailable' | 'retired'>> = {
  recently_created: 'available',
  tech_stack_match: 'available',
  website_http_observed: 'available',
  linkedin_post_request: 'unavailable',
  no_website: 'unavailable',
  outdated_website: 'unavailable',
  slow_website: 'unavailable',
  inactive_blog: 'unavailable',
  funding_round: 'unavailable',
  headcount_growth: 'unavailable',
  job_posting_dev: 'retired',
  job_posting_design: 'retired',
  job_posting_digital: 'retired',
  job_posting_marketing: 'retired',
  job_posting_keyword: 'retired',
  consulting_hiring: 'retired',
  dev_hiring_reinforcement: 'retired',
  freelance_mission: 'retired',
}

export function capabilityById(id: string): SignalCapability | undefined {
  return SIGNAL_CAPABILITIES.find((capability) => capability.id === id)
}

/** Capacité qui crée ce type de signal (aucune pour un signal indisponible ou retiré) */
export function capabilityForSignal(signalType: string): SignalCapability | undefined {
  return SIGNAL_CAPABILITIES.find((capability) => capability.signals.includes(signalType))
}

/** Identifiants des capacités qui créent des signaux : la seule liste que Sophie pourra recommander */
export function signalCapabilityIds(): string[] {
  return SIGNAL_CAPABILITIES.filter((capability) => capability.purpose === 'signal').map((capability) => capability.id)
}

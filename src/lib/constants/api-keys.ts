// Services payants dont chaque utilisateur apporte sa propre clé (Paramètres > Clés).
// La clé est chiffrée dans la base (Supabase Vault) et ne revient jamais au navigateur.

import type { AiServiceKey } from '@/lib/ai-key-detection'

export type ApiKeyProvider = 'openai' | 'gemini' | 'custom' | 'hunter'

// IA utilisables par Sophie (user_profiles.ai_provider). Ajouter une IA : la brancher aussi
// dans supabase/functions/_shared/ai.ts et dans src/lib/api-key-checks.ts.
export const AI_PROVIDERS = ['openai', 'gemini', 'custom'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export function isAiProvider(provider: string): provider is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(provider)
}

// Prochaines IA proposées, dès qu'elles auront été testées avec une vraie clé
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = { openai: 'OpenAI', gemini: 'Gemini (Google)', custom: 'Autre IA' }

export const OPENAI_DEFAULT_MODEL = 'gpt-5.6-terra'
export const GEMINI_DEFAULT_MODEL = 'gemini-flash-lite-latest'

// Services reconnus par la case unique « Clé de votre IA » (voir src/lib/ai-key-detection.ts).
// OpenAI et Gemini sont branchés en direct ; les autres passent par leur API compatible OpenAI
// (« custom » dans la base, avec l'adresse de l'API). Le modèle conseillé n'est écrit que quand son nom
// est stable ; sinon il est choisi dans la liste du service d'après modelPreferences (expressions régulières).
export type AiService = {
  key: AiServiceKey | 'other'
  label: string
  provider: AiProvider
  baseUrl: string
  model: string
  modelPreferences?: string[]
  keysUrl?: string
}

export const AI_SERVICES: AiService[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    provider: 'openai',
    baseUrl: '',
    model: OPENAI_DEFAULT_MODEL,
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  {
    key: 'gemini',
    label: 'Gemini (Google)',
    provider: 'gemini',
    baseUrl: '',
    model: GEMINI_DEFAULT_MODEL,
    keysUrl: 'https://aistudio.google.com/apikey',
  },
  {
    key: 'mistral',
    label: 'Mistral',
    provider: 'custom',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    keysUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    provider: 'custom',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keysUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    key: 'groq',
    label: 'Groq',
    provider: 'custom',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: '',
    modelPreferences: ['^llama-3\\.3-70b', '^openai/gpt-oss-120b$', '^llama.*70b'],
    keysUrl: 'https://console.groq.com/keys',
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    provider: 'custom',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: '',
    modelPreferences: [
      '^openai/gpt-[\\d.]+-mini$',
      '^google/gemini-[\\d.]+-flash$',
      '^anthropic/claude-[\\w.-]*haiku[\\w.-]*$',
      '^mistralai/mistral-small',
    ],
    keysUrl: 'https://openrouter.ai/keys',
  },
  {
    key: 'xai',
    label: 'xAI (Grok)',
    provider: 'custom',
    baseUrl: 'https://api.x.ai/v1',
    model: '',
    modelPreferences: ['^grok-[\\d.]+-mini$', '^grok-[\\d.]+$'],
    keysUrl: 'https://console.x.ai',
  },
  { key: 'other', label: 'Autre service compatible OpenAI', provider: 'custom', baseUrl: '', model: '' },
]

export function findAiService(key: string): AiService | null {
  return AI_SERVICES.find((service) => service.key === key) ?? null
}

/** Nom à afficher pour une clé « custom », d'après son adresse */
export function customAiLabel(baseUrl: string | null): string {
  const preset = AI_SERVICES.find((candidate) => candidate.provider === 'custom' && candidate.baseUrl && candidate.baseUrl === baseUrl)
  if (preset) return preset.label.replace(/ \(.*\)$/, '')
  try {
    return baseUrl ? new URL(baseUrl).hostname.replace(/^api\./, '') : 'Autre IA'
  } catch {
    return 'Autre IA'
  }
}

export type ApiKeyService = {
  provider: Exclude<ApiKeyProvider, 'custom'>
  label: string
  usedFor: string
  // Début habituel de la clé, pour guider la saisie
  keyPlaceholder: string
  steps: { text: string; url?: string; linkLabel?: string }[]
  cost: string
  // Modèle conseillé (IA seulement) : l'utilisateur peut en choisir un autre
  defaultModel?: string
}

export const API_KEY_SERVICES: ApiKeyService[] = [
  {
    provider: 'openai',
    label: 'OpenAI',
    usedFor: 'Sophie rédige vos messages (e-mail et LinkedIn) et fait ses recherches sur le web.',
    keyPlaceholder: 'sk-…',
    steps: [
      { text: 'Créez un compte OpenAI (ou connectez-vous).', url: 'https://platform.openai.com/signup', linkLabel: 'platform.openai.com' },
      {
        text: 'Ajoutez du crédit : 5 $ minimum, payés une fois.',
        url: 'https://platform.openai.com/settings/organization/billing/overview',
        linkLabel: 'Facturation',
      },
      {
        text: 'Conseillé : fixez un plafond de dépense mensuel.',
        url: 'https://platform.openai.com/settings/organization/limits',
        linkLabel: 'Limites',
      },
      {
        text: 'Créez une clé (« Create new secret key »), copiez-la et collez-la ci-dessous.',
        url: 'https://platform.openai.com/api-keys',
        linkLabel: 'Clés API',
      },
    ],
    cost: 'Environ 1 à 5 centimes par message rédigé : 5 $ suffisent pour une centaine de messages ou plus.',
    defaultModel: OPENAI_DEFAULT_MODEL,
  },
  {
    provider: 'gemini',
    label: 'Gemini (Google)',
    usedFor:
      'Une autre IA pour Sophie, avec une offre gratuite : elle rédige vos messages. Sa recherche sur le web demande la facturation de Google (ou une clé OpenAI).',
    keyPlaceholder: 'Votre clé Gemini',
    steps: [
      {
        text: 'Connectez-vous à Google AI Studio avec un compte Google.',
        url: 'https://aistudio.google.com/',
        linkLabel: 'aistudio.google.com',
      },
      {
        text: 'Créez une clé (« Create API key »), copiez-la et collez-la ci-dessous.',
        url: 'https://aistudio.google.com/apikey',
        linkLabel: 'Clés API',
      },
    ],
    cost: 'Gratuit, dans les limites de Google. Avec l\'offre gratuite, Google peut utiliser les textes envoyés pour améliorer ses services : activez la facturation pour l\'éviter.',
    defaultModel: GEMINI_DEFAULT_MODEL,
  },
  {
    provider: 'hunter',
    label: 'Hunter',
    usedFor: 'Trouver l\'adresse e-mail des dirigeants à partir du site de leur entreprise.',
    keyPlaceholder: 'Votre clé Hunter',
    steps: [
      { text: 'Créez un compte Hunter gratuit.', url: 'https://hunter.io/users/sign_up', linkLabel: 'hunter.io' },
      { text: 'Copiez votre clé API et collez-la ci-dessous.', url: 'https://hunter.io/api-keys', linkLabel: 'Clés API' },
    ],
    cost: 'Gratuit jusqu\'à 50 recherches par mois. Hunter ne compte rien quand il ne trouve pas d\'adresse.',
  },
]

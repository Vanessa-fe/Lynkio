// Services payants dont chaque utilisateur apporte sa propre clé (Paramètres > Clés).
// La clé est chiffrée dans la base (Supabase Vault) et ne revient jamais au navigateur.

export type ApiKeyProvider = 'openai' | 'gemini' | 'anthropic' | 'hunter'

// IA utilisables par Sophie (user_profiles.ai_provider) : les trois fournisseurs du lancement, chacun
// avec sa propre recherche sur Internet. Ajouter une IA : la brancher aussi dans
// supabase/functions/_shared/ai.ts, src/lib/api-key-checks.ts et src/lib/ai-key-detection.ts.
export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export function isAiProvider(provider: string): provider is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(provider)
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
}

export const OPENAI_DEFAULT_MODEL = 'gpt-5.6-terra'
export const GEMINI_DEFAULT_MODEL = 'gemini-flash-lite-latest'
export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5'

// Modèle conseillé (mêmes valeurs que DEFAULT_MODELS dans supabase/functions/_shared/ai.ts)
export const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: OPENAI_DEFAULT_MODEL,
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
}

// Page où créer sa clé
export const AI_KEYS_URLS: Record<AiProvider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://platform.claude.com/settings/keys',
  gemini: 'https://aistudio.google.com/apikey',
}

export type ApiKeyService = {
  provider: ApiKeyProvider
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
    provider: 'anthropic',
    label: 'Claude (Anthropic)',
    usedFor: 'Sophie rédige vos messages (e-mail et LinkedIn) et fait ses recherches sur Internet avec Claude.',
    keyPlaceholder: 'sk-ant-…',
    steps: [
      { text: 'Créez un compte Claude Platform (ou connectez-vous).', url: 'https://platform.claude.com/', linkLabel: 'platform.claude.com' },
      {
        text: 'Ajoutez du crédit : 5 $ minimum, payés une fois.',
        url: 'https://platform.claude.com/settings/billing',
        linkLabel: 'Facturation',
      },
      {
        text: 'Créez une clé (« Create key »), copiez-la et collez-la ci-dessous.',
        url: 'https://platform.claude.com/settings/keys',
        linkLabel: 'Clés API',
      },
    ],
    cost: 'Quelques centimes par message avec Claude Opus 5.5 (moins avec Sonnet ou Haiku), et environ 1 centime par recherche sur Internet.',
    defaultModel: ANTHROPIC_DEFAULT_MODEL,
  },
  {
    provider: 'gemini',
    label: 'Gemini (Google)',
    usedFor:
      'Une IA pour Sophie avec une offre gratuite : elle rédige vos messages.',
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
    cost: 'Gratuit pour rédiger, dans les limites de Google. Avec l\'offre gratuite, Google peut utiliser les textes envoyés pour améliorer ses services : activez la facturation pour l\'éviter.',
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

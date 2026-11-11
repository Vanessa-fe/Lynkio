// Services payants dont chaque utilisateur apporte sa propre clé (Paramètres > Clés).
// La clé est chiffrée dans la base (Supabase Vault) et ne revient jamais au navigateur.

export type ApiKeyProvider = 'openai' | 'gemini' | 'hunter'

// IA utilisables par Sophie (user_profiles.ai_provider). Ajouter une IA : la brancher aussi
// dans supabase/functions/_shared/ai.ts et dans src/lib/api-key-checks.ts.
export const AI_PROVIDERS = ['openai', 'gemini'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export function isAiProvider(provider: string): provider is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(provider)
}

// Prochaines IA proposées, dès qu'elles auront été testées avec une vraie clé
export const UPCOMING_AI_PROVIDERS = ['Claude (Anthropic)', 'Mistral']

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = { openai: 'OpenAI', gemini: 'Gemini (Google)' }

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
    defaultModel: 'gpt-5.6-terra',
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
    defaultModel: 'gemini-flash-lite-latest',
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

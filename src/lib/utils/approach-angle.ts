/**
 * Angle d'approche suggéré pour une fiche, sans IA : des règles simples à partir des faits du
 * registre et des signaux observés. C'est toujours une hypothèse (présentée comme telle à l'écran),
 * jamais un besoin constaté. Valable pour tous les métiers : les phrases parlent du client, pas
 * de la prestation.
 */

export type ApproachAngle = {
  // Ce qu'on propose de mettre en avant dans le premier message
  angle: string
  // Les faits sur lesquels repose la suggestion (affichés pour qu'on puisse en juger)
  because: string
}

type AngleInput = {
  approach: 'profile' | 'partner' | null
  sizeCategory: string | null
  foundedOn: string | null
  signalTypes: string[]
  hasDecisionMaker: boolean
  now?: Date
}

// Signaux observés → angle. Le premier présent dans cet ordre l'emporte (du plus parlant au moins).
const SIGNAL_ANGLES: { types: string[]; angle: string; because: string }[] = [
  {
    types: ['freelance_mission', 'linkedin_post_request'],
    angle: 'Répondez à leur demande : montrez en une phrase que vous avez déjà fait ce qu’ils cherchent, et proposez un échange court.',
    because: 'ils ont publié une demande de prestataire',
  },
  {
    types: ['funding_round'],
    angle: 'Ils viennent de lever des fonds : parlez de ce qui les aidera à grandir vite, avec un exemple chiffré si vous en avez un.',
    because: 'levée de fonds observée',
  },
  {
    types: ['headcount_growth'],
    angle: 'L’équipe s’agrandit : proposez de les soulager sur ce qu’ils n’ont pas encore le temps de faire en interne.',
    because: 'effectif en croissance',
  },
  {
    types: [
      'job_posting_keyword',
      'job_posting_dev',
      'job_posting_design',
      'job_posting_digital',
      'job_posting_marketing',
      'dev_hiring_reinforcement',
      'consulting_hiring',
    ],
    angle: 'Ils recrutent dans votre domaine : proposez votre aide en attendant la bonne recrue, ou en complément.',
    because: 'offre d’emploi dans votre domaine',
  },
  {
    types: ['no_website', 'outdated_website', 'slow_website', 'inactive_blog'],
    angle: 'Leur présence en ligne peut être améliorée : citez un point précis que vous avez remarqué, sans critiquer.',
    because: 'site absent, daté, lent ou blog inactif',
  },
  {
    types: ['recently_created'],
    angle: 'Entreprise toute récente : parlez de ce qu’il faut mettre en place au démarrage, simplement et sans jargon.',
    because: 'créée il y a moins d’un an',
  },
]

function monthsSince(date: string, now: Date): number {
  const start = new Date(date)
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
}

export function suggestApproachAngle(input: AngleInput): ApproachAngle {
  const now = input.now ?? new Date()

  // Partenaires (agences, cabinets) : on ne vend pas au client final, on propose du renfort
  if (input.approach === 'partner') {
    return {
      angle:
        'Proposez-vous en renfort : une structure de votre domaine sous-traite souvent quand elle a trop de travail. Présentez une compétence qui complète la sienne et vos disponibilités.',
      because: 'trouvée par une recherche de partenaires',
    }
  }

  for (const rule of SIGNAL_ANGLES) {
    if (rule.types.some((type) => input.signalTypes.includes(type))) {
      return { angle: rule.angle, because: rule.because }
    }
  }

  // Pas de signal : l'angle vient seulement du profil, il faut le dire
  if (input.foundedOn && monthsSince(input.foundedOn, now) < 12) {
    return {
      angle: 'Entreprise toute récente : parlez de ce qu’il faut mettre en place au démarrage, simplement et sans jargon.',
      because: 'créée il y a moins d’un an, aucun signal observé',
    }
  }
  if (input.sizeCategory === 'solo' || input.sizeCategory === 'tpe') {
    return {
      angle: input.hasDecisionMaker
        ? 'Le dirigeant décide souvent seul : message court et concret, qui parle de son activité, avec une seule question à la fin.'
        : 'Petite structure : cherchez d’abord le nom du dirigeant, puis un message court et concret sur son activité.',
      because: 'petite entreprise, aucun signal observé',
    }
  }
  if (input.sizeCategory === 'pme' || input.sizeCategory === 'eti' || input.sizeCategory === 'ge') {
    return {
      angle:
        'Plusieurs personnes décident : visez le responsable du service concerné et montrez un résultat obtenu pour une entreprise de taille comparable.',
      because: 'entreprise de taille moyenne ou grande, aucun signal observé',
    }
  }
  return {
    angle: 'Présentez-vous simplement et posez une question sur leurs projets du moment pour savoir s’il y a un besoin.',
    because: 'aucun signal observé',
  }
}

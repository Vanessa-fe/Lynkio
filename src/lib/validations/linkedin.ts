import { z } from 'zod'
import { LINKEDIN_INVITATIONS_PER_DAY, LINKEDIN_MESSAGES_PER_DAY } from '@/lib/linkedin-caps'

/**
 * Rythme d'envoi sur LinkedIn choisi par l'utilisatrice. Les mêmes bornes sont vérifiées par la base
 * (contraintes de linkedin_automation, migration 00090).
 */
export const linkedinPaceSchema = z.object({
  dailyInvitationsLimit: z
    .number({ error: `Indiquez un nombre entre ${LINKEDIN_INVITATIONS_PER_DAY.min} et ${LINKEDIN_INVITATIONS_PER_DAY.max}` })
    .int('Indiquez un nombre entier')
    .min(LINKEDIN_INVITATIONS_PER_DAY.min, 'Au moins 1 invitation par jour')
    .max(LINKEDIN_INVITATIONS_PER_DAY.max, `Au plus ${LINKEDIN_INVITATIONS_PER_DAY.max} invitations par jour`),
  dailyMessagesLimit: z
    .number({ error: `Indiquez un nombre entre ${LINKEDIN_MESSAGES_PER_DAY.min} et ${LINKEDIN_MESSAGES_PER_DAY.max}` })
    .int('Indiquez un nombre entier')
    .min(LINKEDIN_MESSAGES_PER_DAY.min, 'Au moins 1 message par jour')
    .max(LINKEDIN_MESSAGES_PER_DAY.max, `Au plus ${LINKEDIN_MESSAGES_PER_DAY.max} messages par jour`),
})

export type LinkedinPaceInput = z.infer<typeof linkedinPaceSchema>

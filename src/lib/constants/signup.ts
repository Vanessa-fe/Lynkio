// Inscriptions ouvertes au public. Fermées tant que l'outil est en test privé.
//
// Ouverture par la variable d'environnement NEXT_PUBLIC_SIGNUPS_OPEN=true (lue au moment du build).
// Elle n'est définie que dans le .env.local, pour tester les inscriptions en local : sur filonea.fr
// (Netlify), la variable est absente et les inscriptions restent fermées.
//
// Dans tous les cas, il faut aussi activer « Allow new users to sign up » dans Supabase
// (Authentication, Sign In / Providers) : la base est la même en local et en production, et ce
// réglage est le vrai verrou (la clé publique du site permet de créer un compte sans l'application).
// Pensez à le désactiver après une séance de test.
export const SIGNUPS_OPEN = process.env.NEXT_PUBLIC_SIGNUPS_OPEN === 'true'

export const SIGNUPS_CLOSED_MESSAGE = 'Les inscriptions sont fermées pour le moment.'

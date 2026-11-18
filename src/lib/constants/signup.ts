// Inscriptions ouvertes au public. Fermées tant que l'outil est en test privé.
//
// Ouverture par la variable d'environnement NEXT_PUBLIC_SIGNUPS_OPEN=true (lue au moment du build).
// Le .env.local la met à true pour tester en local. Attention : depuis le 18/11/2026 le site est construit
// sur le Mac (netlify deploy --build --prod), qui lit aussi le .env.local. La variable est donc définie à
// false dans Netlify (elle passe avant le .env.local) ; pour ouvrir, la passer à true là, puis redéployer.
//
// Dans tous les cas, il faut aussi activer « Allow new users to sign up » dans Supabase
// (Authentication, Sign In / Providers) : la base est la même en local et en production, et ce
// réglage est le vrai verrou (la clé publique du site permet de créer un compte sans l'application).
// Pensez à le désactiver après une séance de test.
export const SIGNUPS_OPEN = process.env.NEXT_PUBLIC_SIGNUPS_OPEN === 'true'

export const SIGNUPS_CLOSED_MESSAGE = 'Les inscriptions sont fermées pour le moment.'

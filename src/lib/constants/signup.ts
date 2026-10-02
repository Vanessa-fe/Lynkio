// Inscriptions ouvertes au public. Fermées tant que l'outil est en test privé :
// chaque compte utilise les clés de l'application (OpenAI, Hunter), donc ses crédits.
//
// Pour rouvrir : passer à true ici ET réactiver « Allow new users to sign up » dans
// Supabase (Authentication, Sign In / Providers). Le réglage Supabase est le vrai
// verrou : la clé publique du site permet de créer un compte sans passer par l'application.
export const SIGNUPS_OPEN = false

export const SIGNUPS_CLOSED_MESSAGE = 'Les inscriptions sont fermées pour le moment.'

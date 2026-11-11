// Erreur dont le message peut être montré tel quel à l'utilisateur
export class UserFacingError extends Error {}

// L'IA de l'utilisateur ne peut pas chercher elle-même sur Internet (pas d'outil de recherche, ou
// Gemini sans la facturation Google) : la recherche de Filonea peut prendre le relais
export class NoNativeWebSearchError extends UserFacingError {}

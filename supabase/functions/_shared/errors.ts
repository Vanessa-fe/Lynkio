// Erreur dont le message peut être montré tel quel à l'utilisateur
export class UserFacingError extends Error {}

// Problème du compte chez le fournisseur d'IA (clé refusée, plus de crédit, trop de demandes, modèle inconnu) :
// avec la clé de Filonea (IA incluse dans Pro), l'utilisateur n'y peut rien, on lui montre un autre message
export class ProviderAccountError extends UserFacingError {}

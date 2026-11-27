// Avertissement avant de supprimer une entreprise (liste et fiche). Une fiche supprimée est oubliée :
// les recherches peuvent la retrouver. « Hors cible » la garde en mémoire et l'écarte pour de bon.
export const DELETE_COMPANY_WARNING =
  'Ses contacts, signaux et échanges seront aussi supprimés.\n\n' +
  'Elle pourra réapparaître lors d’une prochaine recherche. Pour ne plus la voir, choisissez plutôt l’étape « Hors cible ».'

// Entreprises chargées dans le tableau, où se font la recherche et les filtres : 1 000 au plus, le
// maximum que la base renvoie en une fois (avant : 200, et les fiches sans score n'apparaissaient pas)
export const COMPANIES_LIMIT = 1000
// Lignes du tableau affichées d'un coup ; « Afficher plus » en ajoute autant
export const COMPANIES_PAGE_SIZE = 100
// Lien « Voir les entreprises ajoutées » (fin d'un import) : /companies?ajoutees=aujourdhui
export const ADDED_TODAY_PARAM = 'aujourdhui'

#!/bin/zsh
# Met Filonéa en ligne depuis ce Mac (builds automatiques coupés dans Netlify depuis le 18/11/2026).
#
#   scripts/mettre-en-ligne.sh            brouillon (adresse à part, filonea.fr ne change pas)
#   scripts/mettre-en-ligne.sh --prod     production (filonea.fr)
#
# Le .env.local de ce Mac sert au développement : il ouvre les inscriptions et contient des clés de test.
# Pendant la construction, il est mis de côté pour que seules les variables enregistrées dans Netlify
# soient utilisées (sinon il serait lu, et même copié dans les fonctions du site). Il est remis en place
# à la fin, même en cas d'erreur ou d'interruption.
set -euo pipefail
cd "${0:A:h}/.."

if [[ "${1:-}" == "--prod" ]]; then
  print -n "Mettre en ligne sur filonea.fr ? (oui/non) "; read -r reponse
  [[ "$reponse" == oui ]] || { print "Annulé."; exit 1; }
fi

remettre() {
  if [[ -f .env.local.de-cote ]]; then
    mv .env.local.de-cote .env.local
    print ".env.local remis en place."
  fi
}
if [[ -f .env.local ]]; then
  mv .env.local .env.local.de-cote
  trap remettre EXIT
  trap 'exit 130' INT TERM
fi

# Ancienne construction qui contiendrait encore une copie du .env.local
rm -rf .netlify/functions-internal

netlify deploy --build "$@"

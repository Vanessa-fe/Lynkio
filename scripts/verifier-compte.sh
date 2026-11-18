#!/bin/zsh
# Vérifie, pour un compte donné, ce que Filonéa et Brevo ont enregistré à chaque étape du lancement.
#
#   scripts/verifier-compte.sh inscription  adresse@exemple.fr   après l'inscription et l'onboarding
#   scripts/verifier-compte.sh abonnement   adresse@exemple.fr   après avoir choisi une offre
#   scripts/verifier-compte.sh suppression  adresse@exemple.fr   après la suppression du compte
#
# Lecture seule : la base est lue avec l'accès filonea_backup (aucune écriture possible), Brevo avec votre
# clé API (aucun envoi, aucune modification). Le mot de passe et la clé sont tapés ici, jamais enregistrés.
# Les e-mails de vos scénarios Brevo (bienvenue, remerciement) ne sont pas visibles par l'API :
# regardez la boîte de réception du compte de test.
set -uo pipefail

etape="${1:-}"
email="${2:-}"
if [[ ! "$etape" =~ ^(inscription|abonnement|suppression)$ || -z "$email" ]]; then
  print "Utilisation : $0 inscription|abonnement|suppression adresse@exemple.fr"
  exit 2
fi
email="${email:l}"

PSQL="$(brew --prefix libpq)/bin/psql"
BREVO="https://api.brevo.com/v3"
ok=0; ko=0
bon()  { print "  ✅ $1"; ok=$((ok + 1)); }
faux() { print "  ❌ $1"; ko=$((ko + 1)); }
info() { print "  ·  $1"; }

print -n "Mot de passe de l'accès filonea_backup : "; read -rs DBPASS; print
print -n "Clé API Brevo : "; read -rs BREVO_KEY; print
export PGPASSWORD="$DBPASS"; unset DBPASS
export PGSSLMODE=require

# Une ligne de résultat, champs séparés par « | » (vide si le compte n'existe pas)
sql() {
  # Requête lue sur l'entrée (avec -c, psql ne remplace pas :'email')
  print -r -- "$1" | "$PSQL" -h aws-1-eu-west-2.pooler.supabase.com -p 5432 -U filonea_backup.kifzcqxasqpcstujihqt \
    -d postgres -At -F '|' -v ON_ERROR_STOP=1 -v email="$email" -f - 2>/tmp/verifier-compte.err
}
brevo() { curl -s -w '\n%{http_code}' -H "api-key: $BREVO_KEY" -H 'Accept: application/json' "$BREVO$1"; }

# --- Base Filonéa ---------------------------------------------------------------------------------------
print "\nFilonéa ($email)"
ligne=$(sql "
  SELECT u.email_confirmed_at IS NOT NULL,
         coalesce((u.raw_user_meta_data->>'marketing_opt_in')::boolean, false),
         coalesce(p.first_name, ''), coalesce(p.business_name, ''), coalesce(p.onboarding_completed, false),
         coalesce(b.status, ''), coalesce(b.plan, ''), coalesce(to_char(b.trial_ends_at, 'YYYY-MM-DD'), ''),
         -- Même calcul que brevo_contact (migration 00086)
         CASE
           WHEN b.status = 'active' AND b.plan IS NOT NULL THEN 'abonne'
           WHEN b.status = 'trialing' AND b.plan IS NOT NULL THEN 'abonne_essai'
           WHEN b.status IN ('past_due', 'unpaid') THEN 'paiement_echoue'
           WHEN b.status = 'canceled' THEN 'resilie'
           WHEN b.trial_ends_at > now() THEN 'essai'
           ELSE 'essai_termine'
         END
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN public.billing b ON b.user_id = u.id
  WHERE lower(u.email) = lower(:'email')")
if [[ $? -ne 0 ]]; then
  print "  La base ne répond pas : $(head -1 /tmp/verifier-compte.err)"; unset PGPASSWORD; exit 1
fi
unset PGPASSWORD

if [[ "$etape" == suppression ]]; then
  [[ -z "$ligne" ]] && bon "Compte effacé de Filonéa" || faux "Le compte existe encore dans Filonéa"
else
  if [[ -z "$ligne" ]]; then
    faux "Aucun compte avec cette adresse"; print "\n$ok vérification(s) réussie(s), $ko à revoir."; exit 1
  fi
  IFS='|' read -r confirme optin prenom entreprise onboarding statut_stripe offre fin_essai statut_attendu <<< "$ligne"
  [[ "$confirme" == t ]] && bon "Adresse confirmée" || faux "Adresse pas encore confirmée (lien de l'e-mail non cliqué)"
  info "Case « conseils et nouveautés » : $([[ "$optin" == t ]] && print cochée || print 'non cochée')"
  [[ "$onboarding" == t ]] && bon "Onboarding terminé" || faux "Onboarding pas terminé"
  [[ -n "$prenom" ]] && bon "Prénom : $prenom" || faux "Prénom vide"
  [[ -n "$entreprise" ]] && bon "Activité : $entreprise" || faux "Nom de l'activité vide"
  [[ -n "$fin_essai" ]] && bon "Fin de l'essai : $fin_essai" || faux "Pas de date de fin d'essai"
  if [[ "$etape" == abonnement ]]; then
    [[ "$statut_attendu" =~ ^(abonne|abonne_essai)$ ]] \
      && bon "Abonnement confirmé par Stripe : $statut_stripe, offre $offre" \
      || faux "Stripe n'a pas encore confirmé d'abonnement (statut : ${statut_stripe:-aucun})"
  fi
fi

# --- Fiche Brevo ----------------------------------------------------------------------------------------
print "\nBrevo"
reponse=$(brevo "/contacts/${email//@/%40}?identifierType=email_id")
code="${reponse##*$'\n'}"; corps="${reponse%$'\n'*}"
if [[ "$etape" == suppression ]]; then
  [[ "$code" == 404 ]] && bon "Fiche retirée de Brevo" || faux "La fiche existe encore dans Brevo (code $code)"
elif [[ "$code" == 401 ]]; then
  faux "Clé Brevo refusée"
elif [[ "$code" != 200 ]]; then
  faux "Pas de fiche Brevo (code $code)"
else
  attr() { print -r -- "$corps" | jq -r ".attributes.$1 // \"\"" ; }
  print -r -- "$corps" | jq -e '.listIds | index(3)' >/dev/null && bon "Dans la liste « Inscrits Filonea »" || faux "Pas dans la liste « Inscrits Filonea »"
  b_optin=$(attr OPT_IN); b_prenom=$(attr PRENOM); b_statut=$(attr STATUT); b_offre=$(attr OFFRE)
  if [[ "$optin" == t ]]; then
    [[ "$b_optin" == true ]] && bon "OPT_IN = oui" || faux "OPT_IN devrait être à oui (lu : ${b_optin:-vide})"
  else
    [[ "$b_optin" != true ]] && bon "OPT_IN = non" || faux "OPT_IN est à oui alors que la case n'était pas cochée"
  fi
  [[ "$b_prenom" == "$prenom" ]] && bon "PRENOM = $b_prenom" || faux "PRENOM : « $b_prenom » au lieu de « $prenom »"
  [[ "$b_statut" == "$statut_attendu" ]] && bon "STATUT = $b_statut" || faux "STATUT : « $b_statut » au lieu de « $statut_attendu »"
  if [[ "$etape" == abonnement ]]; then
    [[ -n "$b_offre" && "$b_offre" == "$offre" ]] && bon "OFFRE = $b_offre" || faux "OFFRE : « $b_offre » au lieu de « $offre »"
  fi
  print -r -- "$corps" | jq -e '.emailBlacklisted' >/dev/null && faux "Adresse bloquée dans Brevo (désinscription ou rejet)"
fi

# --- E-mails envoyés par Filonéa (3 derniers jours) -----------------------------------------------------
if [[ "$etape" != suppression ]]; then
  print "\nE-mails envoyés par Filonéa (3 derniers jours)"
  evenements() { brevo "/smtp/statistics/events?limit=50&days=3&sort=desc&email=${1//@/%40}" | sed '$d'; }
  recus=$(evenements "$email" | jq -r '.events[]? | select(.event == "delivered" or .event == "requests") | .subject' | sort -u)
  if [[ -n "$recus" ]]; then
    print -r -- "$recus" | while IFS= read -r sujet; do bon "Au compte : $sujet"; done
  else
    faux "Aucun e-mail envoyé à cette adresse (confirmation d'inscription attendue)"
  fi
  if [[ "$etape" == inscription ]]; then
    alerte=$(evenements contact@filonea.fr | jq -r --arg e "$email" '.events[]? | select(.subject | test($e; "i")) | .subject' | head -1)
    [[ -n "$alerte" ]] && bon "Alerte reçue sur contact@filonea.fr : $alerte" || faux "Pas d'alerte « Nouvelle inscription » sur contact@filonea.fr"
  fi
  info "Scénarios Brevo (bienvenue, remerciement) : à vérifier dans la boîte de réception du compte."
fi
unset BREVO_KEY

print "\n$ok vérification(s) réussie(s), $ko à revoir."
[[ $ko -eq 0 ]]

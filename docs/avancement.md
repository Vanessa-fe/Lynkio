# Avancement du projet

Point au **5 octobre 2026**. Le détail technique de chaque étape (tables, règles, choix) est dans
[refonte-prospection.md](refonte-prospection.md) ; ce document-ci dit seulement où on en est.

## Le but

Un outil de prospection B2B pour freelances. Sophie, l'agente automatique, repère les entreprises qui
ont probablement besoin d'un freelance (signaux d'achat), les note selon le client idéal, puis
prépare les messages. Premier métier : développeuse web.

Site en ligne : https://filonea.fr (mis à jour à chaque fusion dans `main` ; adresse Netlify : lynkio.netlify.app).

Le produit s'appelait **Lynkio** jusqu'au 7 octobre 2026 : lynkio.fr ayant été réservé par un tiers et le nom
étant déjà porté par d'autres sociétés, il a été renommé **Filonea** (« trouver le bon filon »), avec filonea.fr et filonea.com.

## Ce qui est fait

| Domaine | Détail |
|---|---|
| Socle | Next.js 16, React 19, Node 22 ; faille CVE-2025-29927 corrigée ; sécurité de la base renforcée (00009) |
| Modèle prospection | Entreprises, contacts d'entreprise, signaux, échanges, qualifications, client idéal (00010) |
| Métier | Lancement avec « développeuse web » seulement, choisi à l'onboarding (00011) |
| Entreprises | Liste, fiche, formulaire, étapes du pipeline, analyse du site (stack), recherche de contact Hunter |
| Sophie | Onglet Prospection : planning, départements, lancement manuel, historique ; passage automatique toutes les heures (00012, 00013) |
| Sources | Offres France Travail (source principale), sociétés tout juste créées BODACC (option, désactivée) (00014) |
| Offres | Missions freelance gardées ; offres anonymes à identifier avec leur lien (00015) |
| Score | Règles `rules-v1` sur 100, calculées par la base, « Pourquoi ce score » sur la fiche (00016) |
| Stack technique | Signal « stack compatible » selon les technologies du client idéal (00017) |
| Paramètres | Client idéal, étapes du pipeline, sources |
| Tableau de bord | Pistes en cours, nouveautés, relances du jour et en retard, meilleures opportunités, dernière recherche de Sophie |
| Relances | Rattachées à une entreprise, raccourcis de date |
| Import / export | CSV des entreprises avec aperçu, doublons, modèle à télécharger |
| Ancien modèle | Contacts particuliers, rendez-vous, paiements et agences supprimés (code et base, 00018, 27/09) |
| Site web | Bouton « Rechercher le site » sur les fiches qui n'en ont pas |
| Messages (01/10) | « Préparer un message » sur la fiche : Sophie rédige un premier e-mail ou message LinkedIn à partir des signaux, du site et de votre présentation ; le code vérifie (lien inconnu, champ à compléter, prix, longueur, client confidentiel) et ajoute la signature. Brouillon à copier puis « Marquer comme envoyé ». Réglages dans Paramètres, Messages de Sophie (00022, fonction `draft-message`). Depuis le 10/11, premier message LinkedIn court : 25 à 40 mots (150 à 250 caractères), réécrit une fois par Sophie s'il dépasse 300 ; alerte au-delà de 300 |
| Ciblage (28/09) | Client idéal revu : TPE / PME en direct, 100 % à distance, projets complets. Signal « Recrute pour le web ou le digital » (00019) ; intermédiaires, ESN et régie repérés dans le texte des annonces |
| Suivi commercial (05/10) | « Prochaine action » et « Montant estimé » sur chaque entreprise, modifiables sur la fiche ; colonne dans la liste, montant par étape sur le tableau de bord, colonnes de l'import / export CSV (00023). Remplace la base Notion « Prospection » |
| Personnes (05/10) | Une fiche peut être une personne seule (indépendant, ou entreprise inconnue) avec étape, échanges, relances et messages de Sophie ; page Personnes ; « Ajouter une personne » seule ou avec son entreprise (retrouvée par son nom) ; « Rattacher à une entreprise » déplace tout sur la fiche de l'entreprise ; import CSV de personnes (00024) |
| Listes et statuts (05/10) | Listes de personnes (page Personnes : cocher, « Ajouter à une liste », export Waalaxy d'une liste). Statut de chaque personne déduit de ses échanges (À contacter, Contacté, Relancé, A répondu, Ne pas contacter) ; bouton « Noter » pour un envoi ou une réponse en un clic ; l'étape de la fiche avance toute seule, vers l'avant seulement (00025) |
| Fenêtre d'import (05/10) | « Importer des prospects » sur la page Personnes : profil LinkedIn, CSV, saisie d'une personne ou d'une entreprise, recherches de Sophie. Bouton « + Filonea » à glisser dans les favoris : sur un profil LinkedIn, ouvre « Ajouter une personne » pré-rempli (source LinkedIn, doublon signalé). Personne ajoutée ou import CSV rangés directement dans une liste |
| Retour Waalaxy (05/10) | L'export CSV de Waalaxy s'importe tel quel : personnes reconnues (profil LinkedIn, e-mail, nom d'une personne seule), plusieurs personnes d'une même entreprise réunies sur sa fiche ; invitations, messages et réponses (avec leur texte) notés dans l'historique, sans doublon ; « pas intéressé » → Perdu, « intéressé plus tard » → prochaine action ; liste Waalaxy reprise comme liste Filonea |
| Segments (06/10) | Trois cibles : Agence (renfort), TPE/PME (site, outil), Startup/SaaS (renfort produit). Segment deviné (code d'activité, nom, taille) ou choisi sur la fiche, filtres dans les listes, choix à l'import. Nouveau signal « Agence ou startup qui recrute un développeur » : Sophie reprend les offres de développeur des agences, studios et éditeurs, et écarte celles des entreprises qui montent une équipe. Messages de Sophie adaptés au segment (00026) |
| Posts LinkedIn (08/11) | **Retiré de l'interface le 10/11** (trop peu de vraies demandes trouvées ; table `linkedin_posts`, fonction `linkedin-posts` et code de l'extension gardés, recherche coupée sur le compte). Avant : L'extension Chrome cherche toutes les 2 heures (lun-ven, 9 h-18 h) les posts « je cherche un freelance » selon 5 mots-clés au plus (Paramètres, Extension LinkedIn), cherchés mot pour mot sur 7 jours, triés par date (extension 0.3.2, 09/11). En onglet d'arrière-plan, LinkedIn ne livre que les 3 posts les plus récents par mot-clé : suffisant avec un passage toutes les 2 heures. La fonction `linkedin-posts` écarte doublons, autres langues et hors métier (règles puis IA) ; depuis le 09/11, les missions relayées par un recruteur, une ESN ou une plateforme sont gardées, avec « Via un recruteur : » dans le résumé ; carte « Posts LinkedIn » dans Prospection : Ajouter (personne, entreprise, signal « Cherche un freelance sur LinkedIn », e-mail du post ou trouvé par Hunter) ou Ignorer, puis « Écrire un e-mail avec Sophie » ou « Envoyer sur LinkedIn ». Sophie répond au post dans ses messages. Posts non ajoutés effacés après 30 jours (00031) |
| Clés personnelles (10/11) | Chaque compte apporte ses clés OpenAI et Hunter (Paramètres, Vos clés) : vérifiées auprès du service, chiffrées dans Supabase Vault (00034), seuls les 4 derniers caractères sont lisibles ; seules les fonctions serveur les déchiffrent (`read_user_api_key`, service_role). Sophie (rédaction, recherche par technologie, tri des posts) et la recherche Hunter (relais `hunter` : la clé ne quitte jamais Supabase) utilisent la clé de l'utilisateur ; `OPENAI_API_KEY` et `HUNTER_API_KEY` ne servent plus. 10 vérifications de clé par heure et par compte (`rate_limits`, 00035). Depuis le 11/11 : OpenAI, Claude ou Gemini (voir « IA du lancement ») |
| Tous les métiers (10/11) | 7 métiers à l'inscription (développement web, design/graphisme, rédaction/SEO, marketing/communication, vidéo/photo, assistanat/gestion, autre métier), chacun avec des suggestions de mots-clés (`professions.suggested_keywords`, 00036). Chaque compte choisit jusqu'à 10 mots-clés (inscription, Paramètres > Client idéal, `criteria.search_keywords`). Sophie fait une recherche France Travail par mot-clé (plusieurs mots-clés ensemble se combinent en « et ») et ne garde que les offres dont l'intitulé contient le mot-clé (masculin/féminin, mots collés : `titleMatchesKeyword`) ; signal « Recrute sur l'un de vos mots-clés ». Le développement web garde sa recherche par codes ROME en plus. Recherche par technologie montrée seulement aux développeurs |
| Sécurité (10/11) | En-têtes de sécurité sur toutes les pages (`next.config.js`) : politique de contenu (scripts et connexions limités à Filonea et Supabase), site impossible à afficher dans un cadre, caméra/micro/position désactivés, HSTS 2 ans. Piège à robots sur l'inscription. Nouveaux mots de passe : 10 caractères au moins. Next.js 16.4.6 et CLI Supabase 2.110 (failles corrigées). `rls_auto_enable` n'est plus appelable par l'API (00037) |
| Mon compte (10/11) | Paramètres > Mon compte : export des entreprises et suppression définitive du compte (écrire SUPPRIMER). La fonction `delete-account` supprime le compte (auth.users) : toutes les données suivent en cascade (19 tables, clés du coffre comprises, vérifié dans une transaction annulée). La personne est aussi retirée de Brevo, puis déconnectée |
| Intermédiaires et Tech / IT (11/11) | Les ESN ne sont plus écartées d'office : Prospection > Réglages > Intermédiaires acceptés (ESN et sociétés de conseil, cabinets de recrutement, plateformes freelance, agences d'intérim ; `accepted_intermediaries`, 00038). ESN acceptée : signal « ESN qui recrute » (Sophie propose une mission en régie) ; cabinets et intérim acceptés : offres à identifier. « Développeur·se web » devient « Tech / IT » (00039, clé web_developer inchangée) avec des suggestions DevOps, cloud, data, IA, cybersécurité |
| Gemini (11/11) | Deuxième IA au choix dans Vos clés (Google AI Studio, offre gratuite). Modèle conseillé `gemini-flash-lite-latest` : avec une clé gratuite, les modèles Flash ne répondaient pas et la recherche Google (grounding) renvoie 429 ; Sophie l'explique et propose la facturation ou une clé OpenAI. Avec deux clés d'IA, l'utilisateur choisit celle de Sophie (`setAiProvider`) |
| IA du lancement (11/11) | Trois fournisseurs seulement, 100 % BYOK, recherche sur Internet comprise : OpenAI (API Responses, outil `web_search`), Claude d'Anthropic (bibliothèque officielle `@anthropic-ai/sdk`, modèle conseillé `claude-opus-5-5`, outil `web_search_20260209` ou `web_search_20250305`, repli `fallbacks: "default"`) et Gemini (recherche Google, qui demande la facturation Google). Une seule case « Votre IA » : le fournisseur est reconnu d'après la clé (`src/lib/ai-key-detection.ts`) ; la clé Claude est vérifiée par l'API Models, avec la recherche web du modèle. Messages clairs dans `_shared/ai.ts` : clé refusée, crédit épuisé, facturation Google, trop de demandes, modèle inconnu ou sans recherche web, recherche web coupée sur le compte Claude, service surchargé. Base limitée à ces fournisseurs (00046). La recherche d'offres d'emploi et de créations n'utilise pas d'IA |
| Évolution de Sophie, phase 0 (13/11) | Journal des changements d'étape (`company_stage_events`, 00047) : chaque passage d'une étape à une autre est noté par la base avec sa date et son origine (écran, avancement automatique, Sophie, import) ; point de départ « backfill » pour les fiches existantes. Interrupteur global par source (`connector_settings`, 00048) : une source coupée n'est plus interrogée par aucun passage, sans déploiement, et l'historique le dit. Plan complet : audit du 12/11 (cartes Trello [P0]–[P3]) |

## Ce qu'il reste à faire

**Nouveau cap (05/10) : un CRM complet jusqu'au client signé**, pour ne plus jongler entre Filonea,
Notion et Waalaxy. Les projets, devis et factures restent hors de Filonea.

- **LinkedIn** : module d'envoi prudent (profils choisis, quotas bas), si l'abonnement Waalaxy ne vaut
  pas le coût après l'essai.

- **Recherche d'agences francophones** : une source de Sophie dédiée aux agences web et studios
  (France, Belgique, Suisse, Luxembourg, Québec), la recherche par technologie visant les clients
  directs dont le site est en Next.js, ce qui n'est plus un critère.

Suite de la prospection, par ordre de priorité proposé :

1. **Sites web des entreprises** (étape 2 du nouveau ciblage), puis **analyse du site** : lent
   (PageSpeed), daté (étape 3). Agences web en source secondaire (étape 5).
   **Sites web des entreprises.** France Travail donne rarement le site ; sans lui, pas d'analyse de
   stack ni de recherche Hunter automatique. Pistes : site présent dans l'offre, déduction depuis le
   nom avec vérification, saisie manuelle.
2. **Hunter automatique**, seulement sur les entreprises bien notées (quota gratuit limité).
3. **Qualification par IA**, en complément des règles, sur les entreprises déjà filtrées.
4. **Onglet Références** : tes missions passées, que Sophie cite déjà dans les messages si elles
   existent (la table existe, pas encore l'écran).
5. **Relances préparées par Sophie** : un second message qui tient compte du premier.
6. **Autres métiers** : ajouter une ligne dans `professions`, sans déploiement.

## Petits chantiers

- Passer à zod 4 (faille « mémoire » de zod 3 ; risque faible, les envois sont limités à 1 Mo).
- Règles RLS des relances : écrire `(select auth.uid())` comme sur les nouvelles tables (plus rapide).

## À faire de ton côté

- Régler Sophie dans l'onglet Prospection sur ton compte (activer, départements, jours, heure).
- Enregistrer tes clés OpenAI et Hunter dans Paramètres, Vos clés (Sophie ne rédige plus sans).
- Activer la protection contre les mots de passe divulgués (Supabase, Authentication).
- Faire l'onboarding de ton compte principal.

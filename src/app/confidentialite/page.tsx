import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { LEGAL } from '@/lib/constants/legal'

export const metadata: Metadata = {
  title: 'Confidentialité',
  description: 'Comment Filonea protège vos données et celles de vos prospects.',
  alternates: { canonical: '/confidentialite' },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>
        Cette page explique quelles données Filonea traite, pourquoi, avec qui, combien de temps, et comment exercer
        vos droits. En résumé : vos données servent à faire fonctionner Filonea, elles ne sont jamais vendues, et vous
        pouvez tout exporter ou tout supprimer à tout moment.
      </p>

      <h2>Qui est responsable</h2>
      <p>
        {LEGAL.publisher}, {LEGAL.status.toLowerCase()} (SIRET {LEGAL.siret}), {LEGAL.address}. Contact :{' '}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
      <p>
        Pour les données de vos <strong>prospects</strong>, c&apos;est vous, utilisateur, qui êtes responsable du
        traitement : Filonea les traite pour votre compte, comme sous-traitant (voir plus bas).
      </p>

      <h2>Les données de votre compte</h2>
      <ul>
        <li>Votre adresse e-mail et votre mot de passe (enregistré sous une forme illisible, jamais en clair).</li>
        <li>Votre prénom, le nom de votre activité, votre métier, votre présentation et votre signature.</li>
        <li>Vos réglages : client idéal, mots-clés, départements, sources, intermédiaires acceptés.</li>
        <li>
          Vos clés personnelles d&apos;IA et de recherche d&apos;e-mails : chiffrées, jamais affichées (seulement leurs
          4 derniers caractères), utilisées seulement pour les demandes que vous faites à Sophie.
        </li>
        <li>Vos informations d&apos;abonnement et de facturation (le paiement est traité par Stripe).</li>
      </ul>
      <p>
        Ces données servent à fournir le service (exécution du contrat), à le sécuriser et à l&apos;améliorer
        (intérêt légitime), et à tenir la comptabilité (obligation légale).
      </p>

      <h2>Les messages d&apos;aide</h2>
      <p>
        Quand vous écrivez par le formulaire d&apos;aide (page Contact), nous recevons votre nom, votre adresse
        e-mail, le sujet et votre message, ainsi que votre compte si vous êtes connecté. Ils servent seulement à vous
        répondre (intérêt légitime) : le message nous est transmis par e-mail via Brevo, et gardé 12 mois.
      </p>

      <h2>Les données de vos prospects</h2>
      <p>
        Filonea réunit des informations sur des entreprises à partir de sources publiques :
        registre officiel des entreprises (dont le nom des dirigeants), annonces du BODACC
        et sites des entreprises. Vous pouvez y ajouter des personnes, des e-mails professionnels trouvés avec votre
        compte Hunter, vos échanges et vos notes.
      </p>
      <ul>
        <li>
          Ces données concernent des professionnels, dans le cadre de leur activité. La base légale est votre intérêt
          légitime à prospecter des entreprises pour proposer vos services.
        </li>
        <li>
          Filonea ne les utilise que pour vous fournir le service, ne les partage avec aucun autre utilisateur et ne les
          vend jamais.
        </li>
        <li>
          Une personne qui ne souhaite plus être contactée peut être marquée « ne plus contacter » sur sa fiche : Sophie
          ne propose plus de message pour elle.
        </li>
        <li>
          Toute personne peut aussi écrire à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> pour savoir si des
          données la concernent et s&apos;y opposer.
        </li>
        <li>
          Comme responsable du traitement, l&apos;utilisateur informe la personne dès son premier message : d&apos;où
          viennent ses coordonnées, pourquoi il la contacte, et qu&apos;elle peut s&apos;y opposer d&apos;une simple
          réponse.
        </li>
      </ul>

      <h2>L&apos;extension Filonea pour LinkedIn</h2>
      <p>
        L&apos;extension Chrome de Filonea, si vous l&apos;installez, relie LinkedIn à votre compte Filonea. Elle ne
        transmet à Filonea que ce que vous lui demandez :
      </p>
      <ul>
        <li>
          <strong>Une personne que vous ajoutez</strong> avec le bouton « + Filonea » : son nom, son poste, son
          entreprise et l&apos;adresse de son profil, que vous vérifiez avant d&apos;enregistrer.
        </li>
        <li>
          <strong>Les posts trouvés pour vos expressions</strong> (par exemple « cherche un freelance ») : texte du
          post, nom et titre de son auteur, date. Sophie les trie pour vous ; ceux que vous ne retenez pas sont effacés
          après 30 jours par défaut (voir « Combien de temps »).
        </li>
        <li>
          <strong>Le suivi des invitations et messages</strong> que vous avez validés dans Filonea, si vous activez
          l&apos;envoi depuis votre compte LinkedIn : invitation envoyée, acceptée, message envoyé.
        </li>
      </ul>
      <p>
        Pour envoyer depuis votre compte, l&apos;extension lit sur place votre jeton de session LinkedIn : il
        n&apos;est jamais transmis à Filonea ni à personne. Sa connexion à Filonea est gardée dans votre navigateur.
        Rien de ce qu&apos;elle lit n&apos;est vendu ni partagé. Vous restez responsable de votre usage de LinkedIn et
        de ses conditions. Pour tout arrêter, désinstallez l&apos;extension ou déconnectez-la dans Paramètres &gt;
        Extension LinkedIn.
      </p>

      <h2>Avec qui vos données sont partagées</h2>
      <p>Seulement avec les prestataires nécessaires au service, chacun pour sa mission :</p>
      <ul>
        <li>
          <strong>Supabase</strong> : base de données et connexion, serveurs à Londres (Royaume-Uni, pays reconnu
          comme protecteur par l&apos;Union européenne).
        </li>
        <li>
          <strong>Netlify</strong> : hébergement du site (États-Unis, avec les garanties prévues par le RGPD pour les
          transferts hors d&apos;Europe).
        </li>
        <li>
          <strong>Brevo</strong> (France) : e-mails liés à votre compte (confirmation d&apos;adresse, mot de passe,
          essai gratuit, abonnement), alertes de Sophie que vous avez activées et, seulement si vous l&apos;avez
          accepté à l&apos;inscription, conseils et nouveautés de Filonea, avec désinscription en un clic. Brevo
          reçoit pour cela votre adresse e-mail, votre prénom, le nom de votre activité, votre métier, vos dates
          d&apos;inscription et de fin d&apos;essai, votre offre et le fait que vous ayez lancé une recherche.
        </li>
        <li>
          <strong>PostHog</strong> : mesure d&apos;audience, avec des serveurs en Europe (voir « Cookies »).
        </li>
        <li>
          <strong>Stripe</strong> : paiement de l&apos;abonnement. Filonea ne voit jamais votre numéro de carte.
        </li>
        <li>
          <strong>OpenAI, pour l&apos;IA incluse dans l&apos;offre Pro</strong> (essai compris) : quand vous demandez un
          message, une analyse ou discutez avec Sophie sans clé personnelle, les informations utiles (fiche de
          l&apos;entreprise, prénom et poste du contact, votre présentation, vos messages à Sophie) sont envoyées à
          OpenAI par Filonea. Filonea désactive l&apos;enregistrement des échanges chez OpenAI (option « store »).
          Selon ses conditions pour les entreprises, OpenAI n&apos;utilise pas ces données pour entraîner ses modèles
          et peut les garder jusqu&apos;à 30 jours pour détecter les abus.
        </li>
        <li>
          <strong>L&apos;IA et le service de recherche d&apos;e-mails que vous avez choisis</strong> (OpenAI, Anthropic
          Claude ou Google Gemini, et Hunter) : quand vous demandez un message ou une recherche, les informations
          utiles (fiche de l&apos;entreprise, prénom et poste du contact, votre présentation) leur sont envoyées avec
          votre clé, sous vos propres conditions avec eux.
        </li>
      </ul>

      <h2>Combien de temps</h2>
      <ul>
        <li>Les données de votre compte : tant que votre compte existe.</li>
        <li>
          Les prospects restés sans suite : vous choisissez la durée (6 mois à 3 ans, 3 ans par défaut, la durée
          recommandée par la CNIL), comptée depuis le dernier échange, signal ou ajout, et pouvez activer leur
          effacement automatique (Paramètres &gt; Mon compte). Vos clients, les fiches avec un rappel en cours et les
          personnes qui ont demandé à ne plus être contactées sont gardés, pour respecter leur demande.
        </li>
        <li>
          Les posts LinkedIn proposés par Sophie et non retenus : 30 jours par défaut (de 7 à 90 jours selon votre
          choix).
        </li>
        <li>Les signaux d&apos;opportunité : effacés automatiquement après une durée propre à chaque type de signal.</li>
        <li>Le journal d&apos;accès à vos données (exports, clés, nettoyages) : 12 mois.</li>
        <li>Les messages envoyés par le formulaire d&apos;aide : 12 mois.</li>
        <li>
          À la suppression du compte (Paramètres &gt; Mon compte), tout est effacé immédiatement ; les sauvegardes
          chiffrées, gardées 30 jours, disparaissent ensuite.
        </li>
        <li>Les factures : 10 ans, comme l&apos;exige la loi.</li>
      </ul>

      <h2>Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), clés personnelles chiffrées dans un coffre et jamais renvoyées au navigateur,
        accès aux données limité à votre compte par la base elle-même, sauvegardes chiffrées, règles de sécurité sur
        toutes les pages du site. Les exports de vos données, les changements de clés et les nettoyages sont inscrits
        dans un journal que vous consultez dans Paramètres &gt; Mon compte et que personne ne peut modifier.
      </p>

      <h2 id="cookies" className="scroll-mt-24">Cookies</h2>
      <ul>
        <li>Un cookie de session, nécessaire pour rester connecté.</li>
        <li>
          La mesure d&apos;audience (PostHog) n&apos;utilise de cookie qu&apos;avec votre accord, donné ou refusé dans le
          bandeau. Vous pouvez changer d&apos;avis à tout moment avec le lien « Cookies » en bas de la page
          d&apos;accueil.
        </li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez accéder à vos données, les corriger, les exporter, les supprimer, vous opposer à leur traitement ou
        en demander la limitation. La plupart de ces actions se font directement dans Filonea (Paramètres &gt; Mon compte : export
        complet de vos données dans un fichier réutilisable, durée de conservation, suppression du compte) ; pour le
        reste, écrivez à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Vous pouvez aussi adresser une
        réclamation à la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
      </p>
    </LegalPage>
  )
}

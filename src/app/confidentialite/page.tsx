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

      <h2>Les données de vos prospects</h2>
      <p>
        Filonea réunit des informations sur des entreprises à partir de sources publiques : offres d&apos;emploi
        publiées sur France Travail, registre officiel des entreprises (dont le nom des dirigeants), annonces du BODACC
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
      </ul>

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
          <strong>Brevo</strong> (France) : e-mails d&apos;information sur Filonea, avec désinscription en un clic.
        </li>
        <li>
          <strong>Resend</strong> (États-Unis) : envoi des e-mails de confirmation de compte et de mot de passe.
        </li>
        <li>
          <strong>PostHog</strong> : mesure d&apos;audience, avec des serveurs en Europe (voir « Cookies »).
        </li>
        <li>
          <strong>Stripe</strong> : paiement de l&apos;abonnement. Filonea ne voit jamais votre numéro de carte.
        </li>
        <li>
          <strong>L&apos;IA et le service de recherche d&apos;e-mails que vous avez choisis</strong> (OpenAI, Google
          Gemini, Hunter ou un autre) : quand vous demandez un message ou une recherche, les informations utiles
          (fiche de l&apos;entreprise, prénom et poste du contact, votre présentation) leur sont envoyées avec votre
          clé, sous vos propres conditions avec eux.
        </li>
      </ul>

      <h2>Combien de temps</h2>
      <ul>
        <li>Les données de votre compte et de vos prospects : tant que votre compte existe.</li>
        <li>
          À la suppression du compte (Paramètres &gt; Mon compte), tout est effacé immédiatement ; les sauvegardes
          chiffrées, gardées 30 jours, disparaissent ensuite.
        </li>
        <li>Les factures : 10 ans, comme l&apos;exige la loi.</li>
      </ul>

      <h2>Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), clés personnelles chiffrées dans un coffre, accès aux données limité à votre
        compte, sauvegardes chiffrées, règles de sécurité sur toutes les pages du site.
      </p>

      <h2>Cookies</h2>
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
        en demander la limitation. La plupart de ces actions se font directement dans Filonea (Paramètres) ; pour le
        reste, écrivez à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Vous pouvez aussi adresser une
        réclamation à la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
      </p>
    </LegalPage>
  )
}

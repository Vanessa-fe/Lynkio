import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { LEGAL } from '@/lib/constants/legal'

export const metadata: Metadata = {
  title: 'Conditions générales',
  description: 'Conditions générales d’utilisation et de vente du service Filonea.',
  alternates: { canonical: '/conditions' },
}

export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales d’utilisation et de vente">
      <p>
        Ces conditions encadrent l&apos;utilisation du service Filonea, édité par {LEGAL.publisher} ({LEGAL.status},
        SIRET {LEGAL.siret}). Créer un compte vaut acceptation de ces conditions.
      </p>

      <h2>1. Le service</h2>
      <p>
        Filonea est un outil de prospection pour les freelances. Son assistante, Sophie, repère des entreprises à
        partir de sources publiques (offres d&apos;emploi France Travail, registre officiel des entreprises, BODACC),
        les note selon le client idéal de l&apos;utilisateur et prépare des messages. L&apos;utilisateur suit ensuite
        ses prospects, ses échanges et ses relances. Sophie propose : l&apos;utilisateur relit et décide de chaque
        envoi.
      </p>

      <h2>2. Réservé aux professionnels</h2>
      <p>
        Filonea s&apos;adresse aux professionnels (freelances, indépendants, sociétés) pour leur activité. Le
        droit de rétractation réservé aux consommateurs ne s&apos;applique donc pas ; l&apos;essai gratuit permet de
        découvrir le service avant tout paiement.
      </p>

      <h2>3. Compte</h2>
      <p>
        L&apos;utilisateur fournit une adresse e-mail valide et garde son mot de passe confidentiel. Il est
        responsable de l&apos;usage fait de son compte. Il peut le supprimer à tout moment depuis Paramètres &gt; Mon
        compte : le compte et toutes ses données sont alors effacés.
      </p>

      <h2>4. Offres, prix et paiement</h2>
      <ul>
        <li>
          <strong>Essentiel</strong> : 9 € par mois ou 90 € par an. <strong>Pro</strong> : 15 € par mois ou 150 € par
          an. Le contenu de chaque offre est décrit sur la page d&apos;accueil.
        </li>
        <li>{LEGAL.vat}.</li>
        <li>Les 14 premiers jours de l&apos;offre Pro sont gratuits, sans carte bancaire.</li>
        <li>
          Le paiement se fait par carte ou par les moyens proposés par notre prestataire de paiement, Stripe.
          L&apos;abonnement se renouvelle automatiquement à la fin de chaque période (mois ou année).
        </li>
        <li>
          L&apos;utilisateur peut changer d&apos;offre ou résilier à tout moment. La résiliation prend effet à la fin
          de la période déjà payée, qui n&apos;est pas remboursée.
        </li>
        <li>
          Un changement de prix est annoncé par e-mail au moins 30 jours à l&apos;avance et ne s&apos;applique
          qu&apos;à la période suivante.
        </li>
      </ul>

      <h2>5. Clés personnelles (IA, recherche d&apos;e-mails)</h2>
      <p>
        Pour rédiger ses messages et trouver des adresses e-mail, Sophie utilise les comptes de l&apos;utilisateur
        chez des services tiers (OpenAI, Google Gemini, Hunter ou un autre service de son choix), avec ses propres
        clés. Ces services sont facturés directement par eux à l&apos;utilisateur, selon leurs propres conditions.
        Filonea chiffre ces clés et ne s&apos;en sert que pour les demandes faites par l&apos;utilisateur.
      </p>

      <h2>6. Engagements de l&apos;utilisateur</h2>
      <ul>
        <li>
          Prospecter dans le respect de la loi : messages professionnels en rapport avec l&apos;activité de la
          personne contactée, possibilité simple de refuser les messages suivants, prise en compte de toute
          opposition.
        </li>
        <li>Respecter les conditions des sites et services utilisés, notamment LinkedIn avec l&apos;extension Filonea.</li>
        <li>Ne pas utiliser Filonea pour envoyer des messages en masse non sollicités, ni pour un usage illicite.</li>
        <li>Ne pas chercher à contourner la sécurité du service ni à en perturber le fonctionnement.</li>
      </ul>

      <h2>7. Données des prospects</h2>
      <p>
        Pour les données des personnes que l&apos;utilisateur prospecte, l&apos;utilisateur est responsable du
        traitement et Filonea agit comme sous-traitant : Filonea ne les utilise que pour fournir le service, ne les
        vend pas et les supprime avec le compte. Les détails figurent dans la{' '}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>8. Disponibilité et responsabilité</h2>
      <p>
        Filonea fait de son mieux pour que le service soit disponible et fiable, sans pouvoir le garantir en
        permanence (maintenance, panne d&apos;un prestataire). Les informations proposées par Sophie viennent de
        sources publiques et d&apos;une IA : elles peuvent comporter des erreurs, et l&apos;utilisateur les vérifie
        avant de s&apos;en servir. La responsabilité de l&apos;éditrice est limitée aux dommages directs, dans la limite
        des sommes payées par l&apos;utilisateur au cours des 12 derniers mois.
      </p>

      <h2>9. Vos données, à tout moment</h2>
      <p>
        L&apos;utilisateur peut exporter ses entreprises à tout moment (Paramètres &gt; Mon compte) et supprimer son
        compte. Les sauvegardes chiffrées du service sont effacées au bout de 30 jours.
      </p>

      <h2>10. Évolution des conditions</h2>
      <p>
        Ces conditions peuvent évoluer. Toute modification importante est annoncée par e-mail au moins 30 jours avant
        de s&apos;appliquer. L&apos;utilisateur qui n&apos;est pas d&apos;accord peut résilier avant cette date.
      </p>

      <h2>11. Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de désaccord, une solution amiable est recherchée en
        priorité : écrivez à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. À défaut, les tribunaux de Lille
        sont compétents.
      </p>
    </LegalPage>
  )
}

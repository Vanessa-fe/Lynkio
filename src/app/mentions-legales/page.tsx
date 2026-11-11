import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
import { LEGAL } from '@/lib/constants/legal'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Éditrice, hébergeur et contact du site Filonea.',
  alternates: { canonical: '/mentions-legales' },
}

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditrice du site</h2>
      <p>
        Le site <strong>filonea.fr</strong> et le service Filonea sont édités par <strong>{LEGAL.publisher}</strong>,{' '}
        {LEGAL.status.toLowerCase()}.
      </p>
      <ul>
        <li>SIRET : {LEGAL.siret}</li>
        <li>Adresse : {LEGAL.address}</li>
        <li>
          E-mail : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </li>
        <li>{LEGAL.vat}</li>
      </ul>
      <p>Directrice de la publication : {LEGAL.publisher}.</p>

      <h2>Hébergement</h2>
      <p>Le site est hébergé par {LEGAL.host}.</p>
      <p>
        Les données du service (comptes, prospects, réglages) sont hébergées par Supabase, Inc., sur des serveurs
        situés à Londres (Royaume-Uni), pays reconnu par l&apos;Union européenne comme offrant une protection adéquate
        des données personnelles.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom Filonea, le logo, les textes et l&apos;interface du site sont la propriété de l&apos;éditrice. Toute
        reproduction sans autorisation est interdite.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.
        L&apos;utilisation du service est encadrée par les <a href="/conditions">conditions générales</a>.
      </p>
    </LegalPage>
  )
}

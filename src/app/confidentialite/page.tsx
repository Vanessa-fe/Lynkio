import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CookieSettingsButton } from '@/components/analytics/cookie-banner'
import { Logo } from '@/components/brand/logo'
import { CtaLink } from '@/components/landing/cta-link'
import { Footer } from '@/components/landing/footer'
import { SectionLabel } from '@/components/landing/section-label'
import { RevealWords } from '@/components/motion/reveal'
import { OPEN_GRAPH_BASE } from '@/lib/site'
import { getAuthUser } from '@/lib/supabase/auth'

const TITLE = 'Confidentialité - Filonea'
const DESCRIPTION =
  'Ce que Filonea fait de vos données : compte, mesure d’audience, cookies, services utilisés pour la prospection, et comment exercer vos droits.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/confidentialite' },
  openGraph: { ...OPEN_GRAPH_BASE, title: TITLE, description: DESCRIPTION, url: '/confidentialite' },
}

// Adresse de toutes les demandes sur les données (accès, suppression, opposition…)
const CONTACT_EMAIL = 'lynkio@solynk.fr'
// À changer à chaque modification du contenu de la page
const UPDATED_AT = '5 novembre 2026'

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-700 underline underline-offset-2 hover:text-ink">
      {CONTACT_EMAIL}
    </a>
  )
}

function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-brand-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Pourquoi et combien de temps, en bas d'une section */
function Facts({ basis, duration }: { basis: ReactNode; duration: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
      <div className="rounded-xl bg-cream p-4">
        <dt className="text-xs font-semibold text-brand-700">Ce qui nous y autorise</dt>
        <dd className="mt-1 text-sm leading-relaxed">{basis}</dd>
      </div>
      <div className="rounded-xl bg-cream p-4">
        <dt className="text-xs font-semibold text-brand-700">Combien de temps</dt>
        <dd className="mt-1 text-sm leading-relaxed">{duration}</dd>
      </div>
    </dl>
  )
}

const cookies = [
  {
    name: 'Connexion',
    service: 'Supabase',
    purpose: 'Garde votre session ouverte dans l’application.',
    consent: 'Indispensable, sans accord',
    duration: 'Jusqu’à votre déconnexion',
  },
  {
    name: 'Votre choix au bandeau',
    service: 'PostHog',
    purpose: 'Retient « Accepter » ou « Refuser », pour ne pas vous redemander à chaque page.',
    consent: 'Indispensable, sans accord',
    duration: 'Jusqu’à ce que vous changiez d’avis',
  },
  {
    name: 'Mesure d’audience',
    service: 'PostHog',
    purpose: 'Reconnaît votre navigateur d’une visite à l’autre.',
    consent: 'Seulement après « Accepter »',
    duration: '1 an au plus',
  },
]

const sections: { id: string; title: string; content: ReactNode }[] = [
  {
    id: 'responsable',
    title: 'Qui s’occupe de vos données',
    content: (
      <>
        <p>
          Filonea est responsable des données de votre compte et de la mesure d’audience du site. Pour toute question
          ou demande, écrivez à <Mail /> : nous répondons sous un mois au plus.
        </p>
        <p>
          Pour les personnes que vous prospectez, c’est vous qui décidez qui contacter et pourquoi : vous êtes
          responsable de ces données. Filonea les trouve, les range et prépare vos messages pour votre compte (on dit
          qu’elle est « sous-traitante »).
        </p>
      </>
    ),
  },
  {
    id: 'compte',
    title: 'Votre compte',
    content: (
      <>
        <p>Pour faire fonctionner l’outil, Filonea garde :</p>
        <List
          items={[
            'votre adresse e-mail et votre mot de passe, qui n’est jamais conservé en clair ;',
            'votre profil : prénom, nom d’activité, métier, présentation, signature et références ;',
            'ce que vous enregistrez dans l’outil : client idéal, entreprises, personnes, listes, échanges, rappels, messages préparés et séquences LinkedIn.',
          ]}
        />
        <p>
          Ces données sont hébergées par <Strong>Supabase</Strong>, sur des serveurs situés à Londres. Le Royaume-Uni
          est reconnu par l’Union européenne comme protégeant les données personnelles au même niveau qu’elle. Le site
          est hébergé par <Strong>Netlify</Strong> qui, comme tout hébergeur, voit passer l’adresse IP des visiteurs.
        </p>
        <Facts
          basis="Le contrat qui nous lie quand vous créez un compte."
          duration="Tant que votre compte existe. Quand vous demandez sa suppression, tout est effacé, vos prospects compris."
        />
      </>
    ),
  },
  {
    id: 'mesure',
    title: 'Mesure d’audience',
    content: (
      <>
        <p>
          Filonea utilise <Strong>PostHog</Strong> pour savoir quelles pages sont vues et quelles fonctions servent
          vraiment, afin d’améliorer l’outil. PostHog est hébergé dans l’Union européenne, et les statistiques passent
          par filonea.fr. Rien n’est revendu, rien ne sert à la publicité.
        </p>
        <List
          items={[
            <>
              <Strong>Sans votre accord</Strong> (vous refusez, ou ne répondez pas au bandeau) : vos visites sont
              comptées de façon anonyme, sans cookie de mesure. PostHog ne peut pas vous reconnaître d’un jour à
              l’autre.
            </>,
            <>
              <Strong>Si vous cliquez sur « Accepter »</Strong> : un cookie reconnaît votre navigateur d’une visite à
              l’autre. Si vous êtes connecté·e, vos visites sont rattachées à votre compte (identifiant, adresse e-mail
              et métier). Vos sessions peuvent aussi être enregistrées (pages vues, clics, défilement) pour repérer ce
              qui gêne. Les mots de passe ne sont jamais enregistrés.
            </>,
            <>
              <Strong>Dans l’application, dans tous les cas</Strong> : certaines actions (créer une entreprise, lancer
              une prospection, importer des prospects, démarrer une séquence LinkedIn…) sont comptées par notre serveur
              et rattachées à l’identifiant de votre compte, sans aucun cookie. Seuls le type d’action et quelques
              chiffres sont envoyés, comme le nombre de contacts exportés : jamais le contenu de vos fiches.
            </>,
            'Les erreurs techniques (une page qui plante) sont aussi envoyées à PostHog, pour être corrigées.',
          ]}
        />
        <Facts
          basis={
            <>
              Votre accord pour le cookie et l’enregistrement des sessions. Notre intérêt à améliorer Filonea pour le
              comptage sans cookie et les actions dans l’application : vous pouvez vous y opposer en écrivant à <Mail />.
            </>
          }
          duration="1 an pour les statistiques, 30 jours pour les enregistrements de session."
        />
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    content: (
      <>
        <p>Trois choses peuvent être gardées dans votre navigateur :</p>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cookies.map((cookie) => (
            <li key={cookie.name} className="rounded-xl border border-ink/[0.07] p-4">
              <p className="font-display font-semibold tracking-tight text-ink">{cookie.name}</p>
              <p className="text-xs text-ink/50">{cookie.service}</p>
              <p className="mt-2 text-sm leading-relaxed">{cookie.purpose}</p>
              <p className="mt-3 text-xs font-semibold text-brand-700">{cookie.consent}</p>
              <p className="text-xs text-ink/55">{cookie.duration}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-start gap-3 rounded-xl bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-ink/75">
            Vous pouvez changer d’avis à tout moment, ici ou avec le lien « Cookies » en bas de la page d’accueil.
          </p>
          <CookieSettingsButton className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-brand-600">
            Changer mon choix
          </CookieSettingsButton>
        </div>
      </>
    ),
  },
  {
    id: 'e-mails',
    title: 'E-mails',
    content: (
      <>
        <p>
          Les e-mails de Filonea (confirmation de votre adresse, nouveau mot de passe) sont envoyés par{' '}
          <Strong>Resend</Strong>, un service d’envoi d’e-mails qui reçoit pour cela votre adresse et le message.
        </p>
        <p>
          Filonea n’envoie aucun e-mail à vos prospects : c’est vous qui envoyez vos messages, depuis votre messagerie
          ou LinkedIn, après les avoir relus.
        </p>
      </>
    ),
  },
  {
    id: 'services',
    title: 'Les services qui aident Sophie',
    content: (
      <>
        <p>Pour trouver des entreprises et préparer vos messages, Sophie s’appuie sur :</p>
        <List
          items={[
            <>
              <Strong>les registres publics de l’État</Strong> (BODACC, Annuaire des entreprises) : nom, activité,
              taille, chiffre d’affaires et dirigeants des entreprises ;
            </>,
            <>
              <Strong>France Travail</Strong> : les offres d’emploi publiées par les entreprises ;
            </>,
            <>
              <Strong>les sites des entreprises</Strong> : Sophie lit leurs pages publiques pour repérer leur activité
              et leurs technologies ;
            </>,
            <>
              <Strong>Hunter.io</Strong>, quand vous cherchez l’e-mail d’un contact : il reçoit le nom de domaine de
              l’entreprise, et le nom de la personne si vous l’avez rempli, puis renvoie les adresses professionnelles
              qu’il a trouvées en ligne ;
            </>,
            <>
              <Strong>OpenAI</Strong>, entreprise américaine : il rédige les messages et cherche sur le web des
              entreprises qui utilisent une technologie. Pour un message, il reçoit la fiche de l’entreprise, ses
              signaux, le texte de son site et de son offre d’emploi, votre présentation et vos références (sans le nom
              de vos clients confidentiels), ainsi que le prénom, le nom et le poste de la personne à qui vous écrivez.
              D’après ses conditions, OpenAI ne se sert pas de ces données pour entraîner ses modèles ;
            </>,
            <>
              <Strong>l’extension Chrome de Filonea</Strong>, si vous l’installez : elle agit sur LinkedIn depuis
              votre navigateur, avec votre propre compte. Filonea ne connaît pas votre mot de passe LinkedIn.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'prospects',
    title: 'Les personnes prospectées',
    content: (
      <>
        <p>
          Pour chaque personne de vos listes, Filonea peut garder son nom, son poste, son adresse e-mail et son
          téléphone professionnels, son profil LinkedIn, vos notes et vos échanges.
        </p>
        <List
          items={[
            'Ces données viennent de sources publiques (registres officiels, sites des entreprises, Hunter.io) ou de ce que vous ajoutez vous-même (saisie, import d’un fichier, LinkedIn).',
            'Pour chaque personne, Filonea note d’où vient la donnée et quand elle a été collectée : vous pouvez le dire à toute personne qui le demande.',
            'Quand quelqu’un ne veut plus être contacté, un clic sur « Ne souhaite plus être contacté·e » l’écarte des messages, des exports et des séquences LinkedIn. La date de son refus est gardée, pour qu’il ne soit pas recontacté par erreur.',
          ]}
        />
        <p>
          Entre professionnels, la prospection est permise sans accord préalable, à condition que le message concerne
          le métier de la personne et qu’elle puisse facilement refuser d’être recontactée.
        </p>
        <p className="rounded-xl bg-brand-50 p-4 text-sm text-ink/75">
          Vous avez reçu un message d’un freelance qui utilise Filonea ? Demandez-lui d’où viennent vos coordonnées,
          ou écrivez-nous à <Mail /> : nous transmettrons votre demande et veillerons à ce qu’elle soit traitée.
        </p>
      </>
    ),
  },
  {
    id: 'droits',
    title: 'Vos droits',
    content: (
      <>
        <p>À tout moment, vous pouvez :</p>
        <List
          items={[
            'savoir quelles données Filonea a sur vous, et en recevoir une copie ;',
            'les faire corriger ou effacer ;',
            'vous opposer à un usage, ou demander qu’il soit mis en pause ;',
            'récupérer vos données dans un fichier que vous pouvez réutiliser ailleurs ;',
            'retirer votre accord aux cookies, avec le bouton « Changer mon choix » ci-dessus.',
          ]}
        />
        <p>
          Pour cela, écrivez à <Mail /> depuis l’adresse de votre compte, pour que nous sachions que c’est bien vous.
          Nous répondons sous un mois au plus. Si la réponse ne vous convient pas, vous pouvez vous adresser à la CNIL,
          sur{' '}
          <a
            href="https://www.cnil.fr/fr/plaintes"
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-ink"
          >
            cnil.fr
          </a>
          .
        </p>
      </>
    ),
  },
]

export default async function PrivacyPage() {
  // Lisible connecté·e ou non : seul le bouton du haut change
  const user = await getAuthUser()

  return (
    <>
      <div className="min-h-screen overflow-x-clip bg-cream text-ink">
        <header className="px-3 pt-3 md:px-6 md:pt-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 py-2 pl-4 pr-2">
            <Logo />
            <CtaLink href={user ? '/dashboard' : '/'} variant="dark" size="sm">
              {user ? 'Retour à l’application' : 'Retour à l’accueil'}
            </CtaLink>
          </div>
        </header>

        <main className="px-4 pb-24 pt-14 md:px-6 md:pb-32 md:pt-20">
          <div className="mx-auto max-w-6xl">
            <SectionLabel label="Confidentialité" />
            <RevealWords
              as="h1"
              text="Vos données, *en clair.*"
              immediate
              accentClassName="text-brand-600"
              className="mt-6 font-display text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[1.04] tracking-[-0.04em]"
            />
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/65">
              Ce que Filonea garde, pourquoi, chez qui, et comment changer d’avis.
            </p>
            <p className="mt-2 text-sm text-ink/45">Mise à jour le {UPDATED_AT}</p>

            <div className="mt-12 grid grid-cols-1 gap-10 md:mt-16 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
              <nav aria-label="Sommaire" className="hidden lg:sticky lg:top-10 lg:block lg:self-start">
                <p className="text-xs font-semibold text-ink/45">Sommaire</p>
                <ol className="mt-3 space-y-1 border-l border-ink/10">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-ink/60 hover:border-brand-600 hover:text-ink"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="space-y-4">
                <section aria-labelledby="essentiel" className="rounded-2xl bg-wine p-5 text-cream md:p-8">
                  <h2 id="essentiel" className="font-display text-xl font-semibold tracking-tight md:text-2xl">
                    L’essentiel
                  </h2>
                  <ul className="mt-4 space-y-2.5 leading-relaxed text-cream/80">
                    {[
                      'Vos données ne sont ni revendues, ni utilisées pour de la publicité.',
                      'Aucun cookie de mesure sans votre accord : sans réponse au bandeau, les visites sont comptées sans cookie.',
                      'Votre compte est hébergé à Londres, la mesure d’audience dans l’Union européenne.',
                      'Vos prospects viennent de sources publiques ou de vous. Qui refuse d’être contacté est écarté de tout envoi.',
                    ].map((item) => (
                      <li key={item} className="flex gap-3">
                        <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-brand-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 border-t border-cream/15 pt-5 text-sm text-cream/70">
                    Une question, une suppression :{' '}
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="font-medium text-cream underline underline-offset-2 hover:text-brand-300"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                </section>

                {sections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    aria-labelledby={`${section.id}-titre`}
                    className="scroll-mt-6 rounded-2xl border border-ink/[0.07] bg-white p-5 shadow-soft md:p-8"
                  >
                    <h2
                      id={`${section.id}-titre`}
                      className="font-display text-xl font-semibold tracking-tight md:text-2xl"
                    >
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4 leading-relaxed text-ink/70">{section.content}</div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
      <div aria-hidden className="grain" />
    </>
  )
}

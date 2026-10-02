import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Building2,
  Code2,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SIGNUPS_CLOSED_MESSAGE, SIGNUPS_OPEN } from '@/lib/constants/signup'

const features = [
  {
    icon: Zap,
    title: 'Des signaux d\'achat, pas des listes',
    text: 'Offres d\'emploi web et digital publiées sur France Travail, missions ouvertes aux freelances, entreprises tout juste créées : Sophie repère celles qui ont un besoin maintenant.',
  },
  {
    icon: ScanSearch,
    title: 'Recherche par technologie',
    text: 'L\'IA cherche des PME dont le site est fait avec votre stack. Sophie analyse ensuite chaque site : sans la technologie dans son code, l\'entreprise est écartée.',
  },
  {
    icon: Target,
    title: 'Un score selon votre client idéal',
    text: 'Taille, signaux récents, budget au regard de votre tarif journalier : chaque entreprise reçoit une note sur 100, avec le détail du calcul.',
  },
  {
    icon: Building2,
    title: 'Des fiches complètes',
    text: 'SIREN, dirigeants, chiffre d\'affaires, technologies du site, contacts et profils LinkedIn, réunis au même endroit.',
  },
  {
    icon: Sparkles,
    title: 'Des messages qui partent d\'un fait',
    text: 'Sophie rédige un premier e-mail ou message LinkedIn à partir du signal et du site de l\'entreprise. Vous le relisez, vous l\'envoyez, c\'est noté.',
  },
  {
    icon: Bell,
    title: 'Pipeline et relances',
    text: 'Étapes, échanges et relances du jour : vous savez toujours qui recontacter, et quand.',
  },
]

const steps = [
  {
    title: 'Décrivez votre client idéal',
    text: 'Taille d\'entreprise, technologies, tarif journalier, départements : quelques réglages suffisent.',
  },
  {
    title: 'Sophie cherche pour vous',
    text: 'Aux jours et à l\'heure que vous choisissez, elle parcourt les sources et ajoute les entreprises qui correspondent.',
  },
  {
    title: 'Contactez les meilleures pistes',
    text: 'Les entreprises les mieux notées en premier, un message prêt à relire, une relance programmée.',
  },
]

const safeguards = [
  'Chaque entreprise vient d\'une source publique : offres France Travail, registre officiel des entreprises.',
  'Chaque site est analysé avant qu\'une technologie soit retenue.',
  'Chaque message est contrôlé (lien inconnu, champ à compléter, prix), puis relu par vous avant l\'envoi.',
]

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-lg">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Radar className="h-5 w-5" />
      </span>
      Prospect CRM
    </Link>
  )
}

function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Sections">
          <a href="#fonctionnalites" className="hover:text-foreground transition-colors">
            Fonctionnalités
          </a>
          <a href="#comment-ca-marche" className="hover:text-foreground transition-colors">
            Comment ça marche
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant={SIGNUPS_OPEN ? 'ghost' : 'default'} size="sm" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          {SIGNUPS_OPEN && (
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/signup">Créer un compte</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Aperçu d'une fiche telle que Sophie la prépare (entreprise fictive)
 */
function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-2xl border bg-card p-5 shadow-lg space-y-4" aria-label="Exemple de fiche entreprise">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Exemple fictif</p>
            <p className="font-semibold text-lg">Atelier Lumen</p>
            <p className="text-sm text-muted-foreground">Fabrication de luminaires · Lyon · PME</p>
          </div>
          <div className="text-center shrink-0">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-2xl font-bold tabular-nums">82</p>
          </div>
        </div>

        <ul className="space-y-2">
          <li className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <Zap className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Recrute pour le web ou le digital</p>
              <p className="text-muted-foreground">« Chargé·e de projet web » · il y a 2 jours</p>
            </div>
          </li>
          <li className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <Code2 className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Stack technique compatible</p>
              <p className="text-muted-foreground">Site fait avec Next.js</p>
            </div>
          </li>
        </ul>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">CA 1,8 M€</Badge>
          <Badge variant="secondary">Budget confortable</Badge>
          <Badge variant="outline">Décideur identifié</Badge>
        </div>

        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-medium mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Message préparé par Sophie
          </p>
          <p className="text-sm text-muted-foreground line-clamp-3">
            Bonjour Claire, j&apos;ai vu que vous recrutez un·e chargé·e de projet web pour faire évoluer votre
            boutique en ligne. En attendant le bon profil, je peux prendre en main un projet précis, à distance…
          </p>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        <section className="bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Pour les développeurs et développeuses web freelance
              </p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Trouvez les entreprises qui ont besoin de vous, au bon moment
              </h1>
              <p className="text-lg text-muted-foreground">
                Sophie, votre assistante de prospection, repère les entreprises qui recrutent pour leur site,
                publient une mission ou utilisent votre technologie. Elle les note selon votre client idéal et
                prépare votre premier message.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {SIGNUPS_OPEN ? (
                  <>
                    <Button size="lg" asChild>
                      <Link href="/signup">
                        Créer mon compte
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="/login">J&apos;ai déjà un compte</Link>
                    </Button>
                  </>
                ) : (
                  <Button size="lg" asChild>
                    <Link href="/login">
                      Se connecter
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {SIGNUPS_OPEN
                  ? 'Sources publiques, sites vérifiés, messages relus par vous.'
                  : `${SIGNUPS_CLOSED_MESSAGE} Prospect CRM est en test privé.`}
              </p>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section id="fonctionnalites" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold tracking-tight">Tout ce qu&apos;il faut pour prospecter sans y passer vos journées</h2>
            <p className="text-muted-foreground mt-3">
              Sophie fait le repérage et la préparation. Vous gardez le meilleur rôle : choisir à qui écrire.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="rounded-xl border bg-card p-6">
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.text}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section id="comment-ca-marche" className="scroll-mt-16 border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <h2 className="text-3xl font-bold tracking-tight mb-10">Comment ça marche</h2>
            <ol className="grid gap-8 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="space-y-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {index + 1}
                  </span>
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h2 className="text-3xl font-bold tracking-tight">L&apos;IA propose, le code vérifie</h2>
              <p className="text-muted-foreground mt-3">
                Une IA peut se tromper avec beaucoup d&apos;assurance. Sophie s&apos;en sert pour chercher et rédiger,
                jamais pour décider seule.
              </p>
            </div>
            <ul className="space-y-3">
              {safeguards.map((safeguard) => (
                <li key={safeguard} className="flex gap-3 rounded-xl border bg-card p-4">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm">{safeguard}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Vos prochains clients sont peut-être en train de recruter
            </h2>
            <p className="mt-3 opacity-90">Réglez votre client idéal en quelques minutes : Sophie s&apos;occupe du reste.</p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              {SIGNUPS_OPEN && (
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/signup">Créer mon compte</Link>
                </Button>
              )}
              {/* Seul bouton quand les inscriptions sont fermées : il prend le style principal du bandeau */}
              <Button
                size="lg"
                variant={SIGNUPS_OPEN ? 'outline' : 'secondary'}
                asChild
                className={
                  SIGNUPS_OPEN
                    ? 'border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'
                    : undefined
                }
              >
                <Link href="/login">Se connecter</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <Logo />
          <p>L&apos;outil de prospection des freelances.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Se connecter
            </Link>
            {SIGNUPS_OPEN && (
              <Link href="/signup" className="hover:text-foreground">
                Créer un compte
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

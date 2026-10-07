'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, ChevronRight, FileSpreadsheet, Radar, Upload, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { linkedinBookmarklet } from '@/lib/linkedin-bookmarklet'

type View = 'menu' | 'linkedin'

/**
 * « Importer des prospects » : toutes les façons de faire entrer des personnes et des
 * entreprises dans Filonea, au même endroit (sur le modèle de la fenêtre de Waalaxy)
 */
export function ImportProspectsDialog() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')

  const changeOpen = (value: boolean) => {
    setOpen(value)
    if (!value) setView('menu')
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-2" />
        Importer des prospects
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {view === 'menu' ? (
            <>
              <DialogHeader>
                <DialogTitle>Importer des prospects</DialogTitle>
                <DialogDescription>Choisissez d&apos;où viennent les personnes ou les entreprises.</DialogDescription>
              </DialogHeader>

              <Section title="LinkedIn">
                <Choice
                  icon={<LinkedinIcon className="w-5 h-5" />}
                  title="Depuis un profil LinkedIn"
                  description="Un clic sur le profil que vous regardez : la personne arrive pré-remplie dans Filonea."
                  onClick={() => setView('linkedin')}
                />
              </Section>

              <Section title="Classiques">
                <Choice
                  icon={<FileSpreadsheet className="w-5 h-5" />}
                  title="Depuis un fichier CSV"
                  description="Entreprises et personnes, avec aperçu et repérage des doublons. Export Waalaxy accepté."
                  href="/import-export"
                  onNavigate={() => changeOpen(false)}
                />
                <Choice
                  icon={<UserPlus className="w-5 h-5" />}
                  title="Saisir une personne"
                  description="Seule, ou avec son entreprise."
                  href="/people/new"
                  onNavigate={() => changeOpen(false)}
                />
                <Choice
                  icon={<Building2 className="w-5 h-5" />}
                  title="Saisir une entreprise"
                  href="/companies/new"
                  onNavigate={() => changeOpen(false)}
                />
              </Section>

              <Section title="Signaux d'intérêt">
                <Choice
                  icon={<Radar className="w-5 h-5" />}
                  title="Recherches de Sophie"
                  description="Les entreprises qui recrutent pour le web, les offres anonymes à identifier, les sociétés tout juste créées. Sophie les ajoute toute seule selon votre planning."
                  href="/prospection"
                  onNavigate={() => changeOpen(false)}
                />
              </Section>
            </>
          ) : (
            <LinkedinInstructions onBack={() => setView('menu')} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function Choice({
  icon,
  title,
  description,
  href,
  onClick,
  onNavigate,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  href?: string
  onClick?: () => void
  onNavigate?: () => void
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-medium">{title}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
    </>
  )
  const className =
    'flex w-full items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return href ? (
    <Link href={href} className={className} onClick={onNavigate}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  )
}

/**
 * Installation du bouton « + Filonea » : à glisser dans la barre de favoris
 */
function LinkedinInstructions({ onBack }: { onBack: () => void }) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  // React refuse les adresses « javascript: » dans href : on la pose directement
  // sur le lien. Le code est le nôtre (linkedin-bookmarklet.ts), jamais une saisie.
  useEffect(() => {
    linkRef.current?.setAttribute('href', linkedinBookmarklet(window.location.origin))
  }, [])

  return (
    <div className="space-y-4">
      <DialogHeader>
        <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <DialogTitle>Ajouter depuis un profil LinkedIn</DialogTitle>
        <DialogDescription>
          Un bouton dans votre barre de favoris : sur le profil d&apos;une personne, un clic l&apos;ajoute à Filonea.
        </DialogDescription>
      </DialogHeader>

      <ol className="space-y-4 text-sm">
        <li className="space-y-2">
          <p>
            <span className="font-medium">1.</span> Glissez ce bouton jusqu&apos;à votre barre de favoris (si elle
            est cachée : Cmd + Maj + B sur Mac, Ctrl + Maj + B sur Windows).
          </p>
          <a
            ref={linkRef}
            href="#"
            onClick={(event) => event.preventDefault()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow cursor-grab"
            title="Glissez-moi dans la barre de favoris"
          >
            + Filonea
          </a>
        </li>
        <li>
          <span className="font-medium">2.</span> Ouvrez le profil LinkedIn d&apos;une personne, puis cliquez sur
          « + Filonea » dans vos favoris.
        </li>
        <li>
          <span className="font-medium">3.</span> Filonea s&apos;ouvre avec la personne pré-remplie : vérifiez le prénom,
          le nom et l&apos;entreprise, choisissez une liste si vous voulez, puis « Ajouter la personne ».
        </li>
      </ol>

      <p className="text-xs text-muted-foreground">
        Le bouton lit seulement le profil affiché, quand vous cliquez : rien n&apos;est aspiré en masse, et rien
        n&apos;est enregistré sans votre validation. Si la personne est déjà dans Filonea, Filonea vous le signale.
      </p>
    </div>
  )
}

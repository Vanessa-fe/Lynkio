'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StrategyDialog } from './strategy-dialog'
import { StrategyAssistantDialog } from './strategy-assistant-dialog'

// Exemples de description qui défilent : donnent l'idée du ton attendu par Sophie
const EXAMPLES = [
  'Des PME de l’immobilier autour de Lille qui ont besoin de moderniser leurs outils.',
  'Des agences de Lyon qui cherchent du renfort sur leurs projets.',
  'Des cabinets de conseil en Bretagne qui veulent une image plus claire.',
  'Des startups parisiennes qui montent leur première équipe produit.',
]
const EXAMPLE_DELAY_MS = 4500

/**
 * Bandeau de la page Prospection : la question « Qui aimeriez-vous rencontrer ? »
 * et l'accès direct à Sophie pour créer une recherche
 */
export function ProspectionBand({
  professionKey,
  defaultDepartments,
  hasAiKey,
  atLimit,
}: {
  professionKey: string | null
  defaultDepartments: string[]
  hasAiKey: boolean
  atLimit: boolean
}) {
  const [example, setExample] = useState(0)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantKey, setAssistantKey] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setExample((current) => (current + 1) % EXAMPLES.length), EXAMPLE_DELAY_MS)
    return () => clearInterval(timer)
  }, [])

  const openForm = () => {
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-wine px-6 py-7 text-cream shadow-lift sm:px-8 sm:py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <h2 className="accent-serif text-3xl text-cream md:text-4xl">Qui aimeriez-vous rencontrer ?</h2>
          <p className="relative min-h-[4.5rem] text-base text-cream/80 sm:min-h-[3.5rem] md:text-lg" aria-live="off">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={example}
                className="block"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
              >
                « {EXAMPLES[example]} »
              </motion.span>
            </AnimatePresence>
          </p>
          <p className="text-sm text-cream/60">
            Décrivez-le avec vos mots : Sophie en fait une recherche, que vous relisez avant de la lancer.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button
            type="button"
            size="lg"
            disabled={atLimit}
            onClick={() => {
              setAssistantKey((key) => key + 1)
              setAssistantOpen(true)
            }}
          >
            <Sparkles className="mr-2 size-4" />
            Décrire à Sophie
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            disabled={atLimit}
            onClick={openForm}
            className="text-cream hover:bg-cream/10 hover:text-cream"
          >
            <Plus className="mr-2 size-4" />
            Remplir le formulaire
          </Button>
          {atLimit && (
            <p className="text-xs text-cream/70 lg:max-w-48">
              Nombre maximum de recherches atteint : supprimez-en une pour en créer une autre.
            </p>
          )}
        </div>
      </div>

      <StrategyDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        professionKey={professionKey}
        defaultDepartments={defaultDepartments}
        strategy={null}
      />
      <StrategyAssistantDialog
        key={`band-assistant-${assistantKey}`}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        hasAiKey={hasAiKey}
        professionKey={professionKey}
        defaultDepartments={defaultDepartments}
        onUseForm={openForm}
      />
    </section>
  )
}

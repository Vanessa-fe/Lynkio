'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, History, KeyRound, Loader2, MessageSquarePlus, Pencil, Send, Sparkles, Square, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'
import { SophieSuggestions, useSuggestionCount } from './sophie-suggestions'
import { useSophie } from './sophie-provider'
import { SophieMessageBubble } from './sophie-message'

// Questions proposées selon la page ouverte (pas d'appel à l'IA tant qu'on ne clique pas)
function starters(page: string, isCompany: boolean): string[] {
  if (isCompany) {
    return [
      'Pourquoi cette entreprise a-t-elle ce score ?',
      'Que sait-on vraiment de cette entreprise, et qu’est-ce qui reste inconnu ?',
      'Proposez-moi un premier message pour le dirigeant, assez naturel.',
    ]
  }
  if (page.startsWith('/prospection')) {
    return ['Comment fonctionnent mes recherches enregistrées ?', 'Comment trouver plus d’entreprises dans ma zone ?']
  }
  if (page.startsWith('/reminders')) return ['Comment relancer sans être insistant ?']
  return ['Par quoi commencer aujourd’hui ?', 'Comment choisir les entreprises à contacter en priorité ?']
}

/**
 * Panneau Sophie (phase 2) : à droite sur grand écran, par-dessus la page sur écran moyen, plein écran
 * sur mobile. Fermer ramène exactement à la page en cours.
 */
export function SophiePanel() {
  const sophie = useSophie()
  const { open, view, closePanel } = sophie
  const panelRef = useRef<HTMLElement>(null)

  // Échap ferme le panneau ; le focus va dans le panneau à l'ouverture
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  if (!open) return null

  return (
    <>
      {/* Écran moyen : fond assombri, un clic ferme ; grand écran : la page se décale (SophieMain) */}
      <div className="fixed inset-0 z-40 bg-black/30 xl:hidden" aria-hidden="true" onClick={closePanel} />
      <aside
        ref={panelRef}
        role="complementary"
        aria-label="Sophie, votre assistante de prospection"
        className="fixed inset-0 z-50 flex flex-col bg-background shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[400px] sm:border-l xl:z-30"
      >
        <SophieHeader />
        {view === 'history' ? <SophieHistory /> : <SophieChat />}
      </aside>
    </>
  )
}

function SophieHeader() {
  const { closePanel, hasAiKey, providerLabel, view, setView, newConversation, loadHistory, title } = useSophie()
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wine font-display text-sm font-semibold text-cream" aria-hidden="true">
        S
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">Sophie</p>
        <p className="truncate text-xs text-muted-foreground">
          {hasAiKey ? (title && view === 'chat' ? title : `Disponible${providerLabel ? ` · ${providerLabel}` : ''}`) : 'Incluse dans l’offre Pro'}
        </p>
      </div>
      {hasAiKey && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (view === 'history') setView('chat')
              else {
                void loadHistory()
                setView('history')
              }
            }}
            aria-label={view === 'history' ? 'Revenir à la conversation' : 'Historique des conversations'}
            title={view === 'history' ? 'Revenir à la conversation' : 'Historique'}
          >
            {view === 'history' ? <ArrowLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={newConversation} aria-label="Nouvelle conversation" title="Nouvelle conversation">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePanel} aria-label="Fermer Sophie" title="Fermer">
        <X className="h-4 w-4" />
      </Button>
    </header>
  )
}

function SophieChat() {
  const { messages, send, sending, stop, hasAiKey, context, firstName, loadingConversation } = useSophie()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // La conversation descend avec la réponse qui s'écrit
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (hasAiKey) inputRef.current?.focus()
  }, [hasAiKey])

  const submit = (text: string) => {
    if (!text.trim() || sending) return
    setDraft('')
    void send(text)
  }

  // Entrée envoie, Maj + Entrée revient à la ligne
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(draft)
    }
  }

  const isCompany = context.entityType === 'company'

  return (
    <>
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {loadingConversation ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Chargement de la conversation…
          </p>
        ) : messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-3 text-sm leading-relaxed">
              <p>Bonjour{firstName ? ` ${firstName}` : ''},</p>
              <p className="mt-1.5">
                {hasAiKey
                  ? isCompany
                    ? 'Je peux vous expliquer cette entreprise, son score et ce qui reste à vérifier, ou vous aider à préparer un premier message.'
                    : 'Je peux vous aider à choisir vos priorités, comprendre une entreprise ou préparer vos messages. Posez-moi votre question.'
                  : 'Je suis incluse dans l’offre Pro. Avec l’offre Essentiel, ajoutez la clé de votre propre IA (OpenAI, Gemini ou Claude) pour discuter avec moi. Tout le reste de Filonea fonctionne sans IA : recherches, scores, suivi et relances.'}
              </p>
            </div>
            <SophieSuggestions />
            {hasAiKey ? (
              <div className="flex flex-col items-start gap-2">
                {starters(context.page, isCompany).map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => submit(starter)}
                    className="rounded-full border px-3 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/billing">Passer en Pro</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings/keys">
                    <KeyRound className="mr-2 h-4 w-4" />
                    Ajouter ma clé IA
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <SophieSuggestions compact />
            {messages.map((message) => (
              <SophieMessageBubble
                key={message.id}
                message={message}
                otherCompany={message.role === 'assistant' && !!message.entityId && message.entityId !== context.entityId}
              />
            ))}
          </>
        )}
      </div>

      <form
        className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault()
          submit(draft)
        }}
      >
        <div className={cn('flex items-end gap-2 rounded-xl border bg-card px-3 py-2', !hasAiKey && 'opacity-60')}>
          <label htmlFor="sophie-input" className="sr-only">
            Votre message à Sophie
          </label>
          <textarea
            id="sophie-input"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={4000}
            disabled={!hasAiKey}
            placeholder={hasAiKey ? 'Écrivez à Sophie…' : 'Offre Pro ou clé d’IA nécessaire'}
            className="max-h-40 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground"
          />
          {sending ? (
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={stop} aria-label="Arrêter la réponse">
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!hasAiKey || !draft.trim()} aria-label="Envoyer">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {hasAiKey ? 'Sophie peut se tromper : vérifiez les informations importantes.' : 'Vos recherches, scores et relances restent disponibles sans IA.'}
        </p>
      </form>
    </>
  )
}

function SophieHistory() {
  const { conversations, loadConversation, renameConversation, deleteConversation, conversationId } = useSophie()

  if (conversations === null) {
    return (
      <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Chargement…
      </p>
    )
  }

  if (conversations.length === 0) {
    return <p className="px-4 py-4 text-sm text-muted-foreground">Aucune conversation pour l’instant.</p>
  }

  return (
    <ul className="flex-1 divide-y overflow-y-auto">
      {conversations.map((conversation) => (
        <li key={conversation.id} className={cn('flex items-center gap-2 px-4 py-3', conversation.id === conversationId && 'bg-muted/50')}>
          <button
            type="button"
            onClick={() => void loadConversation(conversation.id)}
            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className="block truncate text-sm font-medium">{conversation.title}</span>
            <span className="text-xs text-muted-foreground">{formatDate(conversation.updated_at, "d MMMM 'à' HH:mm")}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Renommer « ${conversation.title} »`}
            onClick={() => {
              const next = window.prompt('Nouveau nom de la conversation', conversation.title)
              if (next) void renameConversation(conversation.id, next)
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Supprimer « ${conversation.title} »`}
            onClick={() => {
              if (window.confirm(`Supprimer la conversation « ${conversation.title} » ? Elle sera effacée définitivement.`)) {
                void deleteConversation(conversation.id)
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

/** Bouton pour ouvrir Sophie, présent sur toutes les pages connectées */
export function SophieLauncher() {
  const { open, openPanel, peek, dismissPeek, suggestions, firstName } = useSophie()
  const count = useSuggestionCount()
  if (open) return null
  const summary =
    suggestions?.summary ??
    (firstName ? `Bonjour ${firstName}, je suis là si vous avez besoin de moi.` : 'Bonjour, je suis là si vous avez besoin de moi.')
  return (
    <>
      {/* Mobile, à l'arrivée sur l'accueil : un aperçu qui laisse la page utilisable, le plein écran sur demande */}
      {peek && (
        <aside
          aria-label="Aperçu de Sophie"
          className="fixed inset-x-4 bottom-[calc(6rem+var(--cookie-banner-offset,0px))] z-40 flex items-start gap-3 rounded-2xl border border-ink/[0.07] bg-card p-3 shadow-lift sm:hidden"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-wine font-display text-xs font-semibold text-cream" aria-hidden="true">
            S
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm leading-snug">{summary}</p>
            <Button type="button" size="sm" className="mt-2 h-8" onClick={openPanel}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {count > 0 ? `Voir ${count} suggestion${count > 1 ? 's' : ''}` : 'Ouvrir Sophie'}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8 shrink-0" onClick={dismissPeek} aria-label="Masquer l’aperçu de Sophie">
            <X className="h-4 w-4" />
          </Button>
        </aside>
      )}
      <SophieButton count={count} onClick={openPanel} className={peek ? 'max-sm:hidden' : undefined} />
    </>
  )
}

function SophieButton({ count, onClick, className }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'fixed bottom-[calc(6rem+var(--cookie-banner-offset,0px))] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-wine px-4 py-3 text-sm font-semibold text-cream shadow-lift transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-6 md:right-6',
        className
      )}
      aria-label={count > 0 ? `Ouvrir Sophie : ${count} suggestion${count > 1 ? 's' : ''}` : 'Ouvrir Sophie'}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      Sophie
      {count > 0 && (
        <span className="-mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-peach px-1.5 text-xs font-bold text-wine" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  )
}

/** Contenu de la page : il laisse la place au panneau sur grand écran, au lieu d'être recouvert */
export function SophieMain({ children }: { children: React.ReactNode }) {
  const { open } = useSophie()
  return <div className={cn('md:pl-64 transition-[padding] duration-200', open && 'xl:pr-[400px]')}>{children}</div>
}

'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSessionState, writeSessionState } from '@/lib/hooks/use-session-state'
import { askSophie, type SophiePageContext } from './sophie-stream'

/**
 * État partagé du panneau Sophie (phase 2 de la refonte), monté une fois dans la mise en page :
 * la conversation survit aux changements de page. L'historique est gardé côté serveur (tables
 * sophie_conversations et sophie_messages) ; le navigateur ne retient que l'ouverture du panneau et la
 * conversation en cours, pour la session.
 */

export type SophieMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'done' | 'error' | 'streaming'
  error?: string | null
  // Fiche ouverte quand le message a été écrit : une réponse ne s'applique qu'à elle
  entityId: string | null
}

export type SophieConversation = { id: string; title: string; updated_at: string }

type SophieState = {
  open: boolean
  view: 'chat' | 'history'
  setView: (view: 'chat' | 'history') => void
  openPanel: () => void
  closePanel: () => void
  context: SophiePageContext
  hasAiKey: boolean
  providerLabel: string | null
  firstName: string | null
  conversationId: string | null
  title: string | null
  messages: SophieMessage[]
  sending: boolean
  loadingConversation: boolean
  send: (text: string) => Promise<void>
  stop: () => void
  newConversation: () => void
  loadConversation: (id: string) => Promise<void>
  conversations: SophieConversation[] | null
  loadHistory: () => Promise<void>
  renameConversation: (id: string, title: string) => Promise<boolean>
  deleteConversation: (id: string) => Promise<boolean>
}

const SophieContext = createContext<SophieState | null>(null)

export function useSophie(): SophieState {
  const state = useContext(SophieContext)
  if (!state) throw new Error('useSophie doit être utilisé dans SophieProvider')
  return state
}

const OPEN_KEY = 'filonea:sophie-open'
const CONVERSATION_KEY = 'filonea:sophie-conversation'
// Ouverture automatique déjà faite (ou panneau fermé volontairement) pendant cette session
const AUTO_OPENED_KEY = 'filonea:sophie-auto-opened'
const COMPANY_PAGE = /^\/companies\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function session(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function setSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
  } catch {
    // stockage indisponible (navigation privée) : rien de grave, l'état reste en mémoire
  }
}

function readContext(pathname: string): SophiePageContext {
  const company = COMPANY_PAGE.exec(pathname)
  return company
    ? { page: pathname, entityType: 'company', entityId: company[1]!.toLowerCase() }
    : { page: pathname, entityType: null, entityId: null }
}

export function SophieProvider({
  children,
  hasAiKey,
  providerLabel,
  firstName,
  autoOpen,
}: {
  children: ReactNode
  hasAiKey: boolean
  providerLabel: string | null
  firstName: string | null
  autoOpen: boolean
}) {
  const pathname = usePathname()
  const context = useMemo(() => readContext(pathname), [pathname])
  // Ouvert ou fermé : gardé pour la session (on retrouve le panneau après un rechargement)
  const [open] = useSessionState(OPEN_KEY, (raw) => raw === true)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [messages, setMessages] = useState<SophieMessage[]>([])
  const [sending, setSending] = useState(false)
  const [loadingConversation, setLoadingConversation] = useState(false)
  // Reprise de la dernière conversation terminée (avant : « Chargement… » plutôt que l'accueil)
  const [resumeDone, setResumeDone] = useState(false)
  const [conversations, setConversations] = useState<SophieConversation[] | null>(null)
  const resumed = useRef(false)
  const abort = useRef<AbortController | null>(null)

  const loadConversation = useCallback(async (id: string, showLoading = true) => {
    if (showLoading) setLoadingConversation(true)
    const supabase = createClient()
    const [{ data: conversation }, { data: rows }] = await Promise.all([
      supabase.from('sophie_conversations').select('id, title').eq('id', id).maybeSingle(),
      supabase
        .from('sophie_messages')
        .select('id, role, content, status, error, context')
        .eq('conversation_id', id)
        .order('created_at')
        .limit(200),
    ])
    setLoadingConversation(false)
    if (!conversation) {
      setConversationId(null)
      setTitle(null)
      setMessages([])
      setSession(CONVERSATION_KEY, null)
      return
    }
    setConversationId(conversation.id)
    setTitle(conversation.title)
    setSession(CONVERSATION_KEY, conversation.id)
    setMessages(
      (rows ?? []).map((row) => {
        const rowContext = (row.context ?? {}) as { entity_id?: string | null }
        return {
          id: row.id,
          role: row.role === 'user' ? 'user' : 'assistant',
          content: row.content,
          status: row.status === 'error' ? 'error' : 'done',
          error: row.error,
          entityId: rowContext.entity_id ?? null,
        }
      })
    )
    setView('chat')
  }, [])

  // Reprise : la conversation de la session, sinon la plus récente du compte (après une reconnexion)
  const resume = useCallback(async () => {
    if (resumed.current) return
    resumed.current = true
    const current = session(CONVERSATION_KEY)
    if (current) {
      await loadConversation(current, false)
    } else {
      const { data } = await createClient()
        .from('sophie_conversations')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) await loadConversation(data.id, false)
    }
    setResumeDone(true)
  }, [loadConversation])

  const openPanel = useCallback(() => writeSessionState(OPEN_KEY, true), [])

  const closePanel = useCallback(() => {
    writeSessionState(OPEN_KEY, false)
    // Fermé volontairement : pas de nouvelle ouverture automatique pendant la session
    setSession(AUTO_OPENED_KEY, '1')
  }, [])

  // À la première ouverture : reprise de la dernière conversation
  useEffect(() => {
    if (!open) return
    // Lecture lancée juste après l'affichage, pas pendant l'effet lui-même
    const timer = setTimeout(() => void resume(), 0)
    return () => clearTimeout(timer)
  }, [open, resume])

  // Ouverture automatique à l'arrivée sur l'accueil, une fois par session, jamais pendant une saisie
  useEffect(() => {
    if (!autoOpen || pathname !== '/dashboard' || session(AUTO_OPENED_KEY)) return
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
    setSession(AUTO_OPENED_KEY, '1')
    writeSessionState(OPEN_KEY, true)
  }, [autoOpen, pathname])

  const newConversation = useCallback(() => {
    abort.current?.abort()
    setConversationId(null)
    setTitle(null)
    setMessages([])
    setSession(CONVERSATION_KEY, null)
    setView('chat')
  }, [])

  const stop = useCallback(() => abort.current?.abort(), [])

  const send = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || sending || !hasAiKey) return
      const controller = new AbortController()
      abort.current = controller
      setSending(true)
      const userMessage: SophieMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: message,
        status: 'done',
        entityId: context.entityId,
      }
      const replyId = `reply-${Date.now()}`
      setMessages((current) => [
        ...current,
        userMessage,
        { id: replyId, role: 'assistant', content: '', status: 'streaming', entityId: context.entityId },
      ])
      const update = (change: (message: SophieMessage) => SophieMessage) =>
        setMessages((current) => current.map((item) => (item.id === replyId ? change(item) : item)))

      await askSophie({
        conversationId,
        message,
        context,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'meta') {
            setConversationId(event.conversationId)
            setTitle(event.title)
            setSession(CONVERSATION_KEY, event.conversationId)
          } else if (event.type === 'delta') {
            update((item) => ({ ...item, content: item.content + event.text }))
          } else if (event.type === 'done') {
            update((item) => ({ ...item, id: event.messageId ?? item.id, status: 'done' }))
          } else if (event.type === 'error') {
            update((item) => ({ ...item, status: 'error', error: event.message }))
          }
        },
      })
      if (controller.signal.aborted) {
        update((item) => (item.status === 'streaming' ? { ...item, status: 'error', error: 'Réponse arrêtée.' } : item))
      }
      abort.current = null
      setSending(false)
      setConversations(null)
    },
    [sending, hasAiKey, conversationId, context]
  )

  const loadHistory = useCallback(async () => {
    const { data } = await createClient()
      .from('sophie_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)
    setConversations(data ?? [])
  }, [])

  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      const clean = newTitle.trim().slice(0, 120)
      if (!clean) return false
      const { error } = await createClient()
        .from('sophie_conversations')
        .update({ title: clean, title_set_by: 'user' })
        .eq('id', id)
      if (error) return false
      if (id === conversationId) setTitle(clean)
      setConversations((current) => current?.map((item) => (item.id === id ? { ...item, title: clean } : item)) ?? current)
      return true
    },
    [conversationId]
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      const { error } = await createClient().from('sophie_conversations').delete().eq('id', id)
      if (error) return false
      if (id === conversationId) newConversation()
      setConversations((current) => current?.filter((item) => item.id !== id) ?? current)
      return true
    },
    [conversationId, newConversation]
  )

  const value: SophieState = {
    open,
    view,
    setView,
    openPanel,
    closePanel,
    context,
    hasAiKey,
    providerLabel,
    firstName,
    conversationId,
    title,
    messages,
    sending,
    loadingConversation: loadingConversation || (open && !resumeDone),
    send,
    stop,
    newConversation,
    loadConversation,
    conversations,
    loadHistory,
    renameConversation,
    deleteConversation,
  }

  return <SophieContext.Provider value={value}>{children}</SophieContext.Provider>
}

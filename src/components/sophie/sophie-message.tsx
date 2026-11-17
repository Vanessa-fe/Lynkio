'use client'

import ReactMarkdown from 'react-markdown'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSophie, type SophieMessage } from './sophie-provider'
import { SophieCardView } from './sophie-cards'

// Markdown sûr (décision du 17/11/2026 : react-markdown, sans HTML brut) : texte, gras, listes, liens.
// Pas d'image, pas de tableau, pas de titre ; les liens s'ouvrent à part, sans accès à la page.
const ALLOWED = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br', 'code', 'blockquote']

export function SophieMessageBubble({ message, otherCompany }: { message: SophieMessage; otherCompany: boolean }) {
  const { professionKey } = useSophie()
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {message.content}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Réponse donnée sur une autre fiche : elle ne s'applique pas à l'entreprise ouverte maintenant */}
      {otherCompany && <p className="text-xs text-muted-foreground">Réponse donnée sur une autre fiche entreprise</p>}
      {message.content && (
        <div
          className={cn(
            'max-w-[92%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm leading-relaxed',
            '[&_a]:text-primary [&_a]:underline [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5'
          )}
        >
          <ReactMarkdown
            skipHtml
            allowedElements={ALLOWED}
            unwrapDisallowed
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      {/* Cartes : ce que Sophie a consulté ou préparé, à vérifier (rien n'est enregistré ni envoyé sans clic) */}
      {message.cards.length > 0 && (
        <div className="space-y-2 pt-1">
          {message.cards.map((card, index) => (
            <SophieCardView key={`${card.type}-${index}`} card={card} professionKey={professionKey} />
          ))}
        </div>
      )}
      {message.status === 'streaming' && !message.content && (
        <p className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground" aria-label="Sophie écrit">
          {message.statusText && <span>{message.statusText}</span>}
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
              style={{ animationDelay: `${dot * 120}ms` }}
            />
          ))}
        </p>
      )}
      {message.status === 'error' && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message.error ?? 'Sophie n’a pas pu répondre.'}</span>
        </p>
      )}
    </div>
  )
}

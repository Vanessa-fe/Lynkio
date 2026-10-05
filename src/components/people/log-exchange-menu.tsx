'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, MessageSquareReply, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { logContactExchange } from '@/lib/actions/company-interactions'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

type Exchange = Parameters<typeof logContactExchange>[1]

/**
 * « Noter » : enregistre en un clic un envoi ou une réponse, daté de maintenant.
 * Le statut de la personne et l'étape de sa fiche suivent tout seuls.
 */
export function LogExchangeMenu({
  contactId,
  personName,
  optedOut,
}: {
  contactId: string
  personName: string
  optedOut: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const log = async (exchange: Exchange, message: string) => {
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof logContactExchange>>
    try {
      result = await logContactExchange(contactId, exchange)
    } catch {
      toast({ variant: 'destructive', title: 'Échange non enregistré', description: CONNECTION_ERROR })
      return
    } finally {
      setIsSaving(false)
    }

    if (!result.success) {
      toast({ variant: 'destructive', title: 'Échange non enregistré', description: result.error })
      return
    }
    toast({ title: message, description: personName })
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isSaving} aria-label={`Noter un échange avec ${personName}`}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="ml-2 hidden xl:inline">Noter</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Envoyé aujourd&apos;hui</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={optedOut}
          onSelect={() => log({ type: 'linkedin_message', direction: 'outgoing' }, 'Message LinkedIn noté')}
        >
          <LinkedinIcon className="w-4 h-4 mr-2" />
          Message LinkedIn envoyé
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={optedOut}
          onSelect={() => log({ type: 'email', direction: 'outgoing' }, 'E-mail noté')}
        >
          <Mail className="w-4 h-4 mr-2" />
          E-mail envoyé
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Reçu aujourd&apos;hui</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => log({ type: 'linkedin_message', direction: 'incoming' }, 'Réponse notée')}
        >
          <MessageSquareReply className="w-4 h-4 mr-2" />
          Réponse sur LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => log({ type: 'email', direction: 'incoming' }, 'Réponse notée')}>
          <MessageSquareReply className="w-4 h-4 mr-2" />
          Réponse par e-mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

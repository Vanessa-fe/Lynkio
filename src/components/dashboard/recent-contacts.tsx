import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Contact } from '@/types'
import { User } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface RecentContactsProps {
  contacts: Contact[]
}

export function RecentContacts({ contacts }: RecentContactsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts récents</CardTitle>
        <CardDescription>Derniers contacts ajoutés</CardDescription>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Aucun contact récent
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => {
              const contactName =
                [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Sans nom'

              return (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{contactName}</p>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone || contact.email || 'Pas de coordonnées'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {contact.favorite && (
                      <Badge variant="outline" className="mb-1">
                        Favori
                      </Badge>
                    )}
                    {contact.created_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(contact.created_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
            <Link href="/contacts">
              <Button variant="outline" size="sm" className="w-full">
                Voir tous les contacts
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

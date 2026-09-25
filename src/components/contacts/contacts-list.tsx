'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { deleteContact, toggleFavorite, updateContactStatus } from '@/lib/actions/contacts'
import { useToast } from '@/lib/hooks/use-toast'
import type { ContactWithRelations, ContactStatus, ContactSource } from '@/types'
import {
  Search,
  Plus,
  Star,
  Trash2,
  Eye,
  AlertTriangle,
  ShieldAlert,
  Ban,
} from 'lucide-react'

interface ContactsListProps {
  contacts: ContactWithRelations[]
  statuses: ContactStatus[]
  sources: ContactSource[]
  totalCount: number
}

const riskLevelIcons = {
  normal: null,
  monitor: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  insistent: <ShieldAlert className="w-4 h-4 text-orange-500" />,
  blocked: <Ban className="w-4 h-4 text-red-500" />,
}

export function ContactsList({ contacts, statuses, sources, totalCount }: ContactsListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleToggleFavorite = async (contactId: string, currentFavorite: boolean) => {
    const result = await toggleFavorite(contactId, !currentFavorite)

    if (result.success) {
      toast({
        title: 'Succès',
        description: currentFavorite
          ? 'Contact retiré des favoris'
          : 'Contact ajouté aux favoris',
      })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  const handleStatusChange = async (contactId: string, newStatusId: string) => {
    const result = await updateContactStatus(contactId, newStatusId === 'none' ? null : newStatusId)

    if (result.success) {
      toast({
        title: 'Succès',
        description: 'Statut mis à jour',
      })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  const handleDelete = async (contactId: string, contactName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${contactName} ?`)) {
      return
    }

    setDeletingId(contactId)

    const result = await deleteContact(contactId)

    if (result.success) {
      toast({
        title: 'Succès',
        description: 'Contact supprimé avec succès',
      })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }

    setDeletingId(null)
  }

  // Filtrer les contacts côté client
  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      contact.first_name?.toLowerCase().includes(searchLower) ||
      contact.last_name?.toLowerCase().includes(searchLower) ||
      contact.nickname?.toLowerCase().includes(searchLower) ||
      contact.phone?.includes(search) ||
      contact.email?.toLowerCase().includes(searchLower)

    const matchesStatus = statusFilter === 'all' || contact.status_id === statusFilter
    const matchesSource = sourceFilter === 'all' || contact.source_id === sourceFilter
    const matchesRisk = riskFilter === 'all' || contact.risk_level === riskFilter

    return matchesSearch && matchesStatus && matchesSource && matchesRisk
  })

  const getContactName = (contact: ContactWithRelations) => {
    const parts = [contact.first_name, contact.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : 'Sans nom'
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec recherche et bouton d'ajout */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="search"
            placeholder="Rechercher un contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Link href="/contacts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau contact
          </Button>
        </Link>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tous les niveaux de risque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="monitor">À surveiller</SelectItem>
              <SelectItem value="insistent">Insistant</SelectItem>
              <SelectItem value="blocked">Bloqué</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Compteur de résultats */}
      <div className="text-sm text-muted-foreground">
        {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} trouvé
        {filteredContacts.length !== 1 ? 's' : ''} sur {totalCount}
      </div>

      {/* Liste des contacts */}
      {filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Aucun contact trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Risque</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="transition-all hover:scale-[1.01] hover:shadow-md"
                  style={{
                    backgroundColor: contact.status
                      ? `${contact.status.color}10`
                      : undefined,
                    borderLeft: contact.status
                      ? `4px solid ${contact.status.color}`
                      : undefined,
                  }}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 font-medium">
                        {getContactName(contact)}
                        {contact.favorite && (
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </div>
                      {contact.nickname && (
                        <span className="text-sm text-muted-foreground">
                          &ldquo;{contact.nickname}&rdquo;
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={contact.status_id || 'none'}
                      onValueChange={(value) => handleStatusChange(contact.id, value)}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue>
                          {contact.status ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: contact.status.color }}
                              />
                              <span className="text-sm">{contact.status.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Aucun statut</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Aucun statut</span>
                        </SelectItem>
                        {statuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: status.color }}
                              />
                              {status.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{contact.phone || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm truncate max-w-xs block">
                      {contact.email || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{contact.city || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {riskLevelIcons[contact.risk_level ?? 'normal']}
                      <span className="text-sm">
                        {contact.risk_level === 'normal' && 'Normal'}
                        {contact.risk_level === 'monitor' && 'À surveiller'}
                        {contact.risk_level === 'insistent' && 'Insistant'}
                        {contact.risk_level === 'blocked' && 'Bloqué'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Link href={`/contacts/${contact.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFavorite(contact.id, contact.favorite ?? false)}
                      >
                        <Star
                          className={`w-4 h-4 ${contact.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact.id, getContactName(contact))}
                        disabled={deletingId === contact.id}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

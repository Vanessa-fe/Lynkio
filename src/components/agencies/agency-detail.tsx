'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { deleteAgency } from '@/lib/actions/agencies'
import { useToast } from '@/lib/hooks/use-toast'
import type { AgencyWithRelations, AgencyInteraction, ReminderWithRelations } from '@/types'
import {
  Globe,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  ArrowLeft,
  MessageSquare,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  Zap,
} from 'lucide-react'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AgencyInteractionsTimeline } from './agency-interactions-timeline'
import { RemindersList } from '@/components/reminders/reminders-list'

interface AgencyDetailProps {
  agency: AgencyWithRelations
  interactions: AgencyInteraction[]
  reminders: ReminderWithRelations[]
}

const signalTypeLabels: Record<string, string> = {
  job_posting_dev: 'Offre d\'emploi dev',
  nextjs_portfolio: 'Réalisation Next.js',
  ai_offer: 'Offre IA',
  other: 'Autre signal',
}

const preferredChannelLabels: Record<string, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  phone: 'Téléphone',
  other: 'Autre',
}

export function AgencyDetail({ agency, interactions, reminders }: AgencyDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${agency.name} ?`)) {
      return
    }

    setIsDeleting(true)

    const result = await deleteAgency(agency.id)

    if (result.success) {
      toast({
        title: 'Succès',
        description: 'Agence supprimée avec succès',
      })
      router.push('/agencies')
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <Link href="/agencies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux agences
          </Button>
        </Link>

        <div className="flex gap-2">
          <Link href={`/agencies/${agency.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Informations principales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{agency.name}</CardTitle>
          {agency.city && <CardDescription className="text-lg mt-1">{agency.city}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statut et source */}
          <div className="flex flex-wrap gap-4">
            {agency.status && (
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: agency.status.color }}
                />
                <span className="font-medium">{agency.status.name}</span>
              </div>
            )}
            {agency.source && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span>Source: {agency.source.name}</span>
              </div>
            )}
            {agency.size_range && (
              <Badge variant="outline">{agency.size_range} personnes</Badge>
            )}
          </div>

          {/* Coordonnées */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agency.website && (
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Site web</p>
                  <a
                    href={agency.website.startsWith('http') ? agency.website : `https://${agency.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {agency.website}
                  </a>
                </div>
              </div>
            )}

            {agency.city && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Ville</p>
                  <p className="font-medium">{agency.city}</p>
                </div>
              </div>
            )}
          </div>

          {/* Stack détectée */}
          {agency.detected_stack && agency.detected_stack.length > 0 && (
            <div>
              <p className="font-semibold mb-2">Stack technique détectée</p>
              <div className="flex flex-wrap gap-2">
                {agency.detected_stack.map((tech) => (
                  <Badge key={tech} variant="secondary">
                    {tech}
                  </Badge>
                ))}
              </div>
              {agency.stack_detected_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Analysé le {format(new Date(agency.stack_detected_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          )}

          {/* Signal d'opportunité */}
          {agency.signal_type && (
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-semibold">{signalTypeLabels[agency.signal_type]}</p>
                  {agency.signal_url && (
                    <a
                      href={agency.signal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {agency.signal_url}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Contact humain */}
          {(agency.contact_name ||
            agency.contact_email ||
            agency.contact_phone ||
            agency.contact_linkedin_url) && (
            <div>
              <p className="font-semibold mb-3">Contact</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agency.contact_name && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{agency.contact_name}</p>
                      {agency.contact_role && (
                        <p className="text-sm text-muted-foreground">{agency.contact_role}</p>
                      )}
                    </div>
                  </div>
                )}
                {agency.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <a href={`mailto:${agency.contact_email}`} className="font-medium hover:underline">
                      {agency.contact_email}
                    </a>
                  </div>
                )}
                {agency.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <a href={`tel:${agency.contact_phone}`} className="font-medium hover:underline">
                      {agency.contact_phone}
                    </a>
                  </div>
                )}
                {agency.contact_linkedin_url && (
                  <div className="flex items-center gap-3">
                    <LinkedinIcon className="w-5 h-5 text-muted-foreground" />
                    <a
                      href={agency.contact_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      Profil LinkedIn
                    </a>
                  </div>
                )}
                {agency.preferred_channel && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-sm">
                      Canal préféré : {preferredChannelLabels[agency.preferred_channel]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {agency.notes && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold">Notes</p>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{agency.notes}</p>
            </div>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                Créée le {format(new Date(agency.created_at), 'dd MMMM yyyy', { locale: fr })}
              </span>
            </div>
            {agency.last_interaction_at && (
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>
                  Dernière interaction le{' '}
                  {format(new Date(agency.last_interaction_at), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relances */}
      <Card>
        <CardHeader>
          <CardTitle>Relances</CardTitle>
          <CardDescription>Rappels et relances liés à cette agence</CardDescription>
        </CardHeader>
        <CardContent>
          <RemindersList reminders={reminders} totalCount={reminders.length} agencyId={agency.id} />
        </CardContent>
      </Card>

      {/* Timeline des interactions */}
      <AgencyInteractionsTimeline agencyId={agency.id} interactions={interactions} />
    </div>
  )
}

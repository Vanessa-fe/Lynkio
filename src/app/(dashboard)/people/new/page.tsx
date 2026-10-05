import Link from 'next/link'
import { PersonForm } from '@/components/people/person-form'
import { getPipelineStages } from '@/lib/queries/companies'
import { getContactByLinkedin, getOrganizationOptions, getProspectLists } from '@/lib/queries/people'

interface NewPersonPageProps {
  // Envoyés par le bouton « + Lynkio » depuis un profil LinkedIn
  searchParams: Promise<{
    firstName?: string
    lastName?: string
    role?: string
    company?: string
    linkedin?: string
    from?: string
  }>
}

const text = (value: string | undefined, max: number) => value?.trim().slice(0, max) || undefined

export default async function NewPersonPage({ searchParams }: NewPersonPageProps) {
  const params = await searchParams
  const [organizations, stages, lists, existing] = await Promise.all([
    getOrganizationOptions(),
    getPipelineStages(),
    getProspectLists(),
    getContactByLinkedin(params.linkedin),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Ajouter une personne</h1>
        <p className="text-muted-foreground mt-2">Seule, ou avec son entreprise</p>
      </div>

      {existing && (
        <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {existing.name} est déjà dans Lynkio, avec ce profil LinkedIn.{' '}
          <Link href={`/companies/${existing.companyId}`} className="underline font-medium">
            Voir sa fiche
          </Link>
        </div>
      )}

      <PersonForm
        organizations={organizations}
        stages={stages}
        lists={lists}
        initial={{
          firstName: text(params.firstName, 100),
          lastName: text(params.lastName, 100),
          role: text(params.role, 200),
          companyName: text(params.company, 200),
          linkedinUrl: text(params.linkedin, 500),
          origin: params.from === 'linkedin' ? 'linkedin' : 'manual',
        }}
      />
    </div>
  )
}

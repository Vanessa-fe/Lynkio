import { notFound } from 'next/navigation'
import { CompanyDetail } from '@/components/companies/company-detail'
import {
  getCompanyById,
  getCompanyContacts,
  getCompanyInteractions,
  getCompanySignals,
  getLatestQualification,
  getPipelineStages,
} from '@/lib/queries/companies'
import { getCompanyReminders } from '@/lib/queries/reminders'

interface CompanyPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params
  const [company, stages, contacts, signals, interactions, qualification, reminders] = await Promise.all([
    getCompanyById(id),
    getPipelineStages(),
    getCompanyContacts(id),
    getCompanySignals(id),
    getCompanyInteractions(id),
    getLatestQualification(id),
    getCompanyReminders(id),
  ])

  if (!company) {
    notFound()
  }

  return (
    <CompanyDetail
      company={company}
      stages={stages}
      contacts={contacts}
      signals={signals}
      interactions={interactions}
      qualification={qualification}
      reminders={reminders}
    />
  )
}

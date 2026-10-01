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
import { getIcpBasics } from '@/lib/queries/icp'
import { getUserProfile } from '@/lib/queries/user-profile'

interface CompanyPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params
  const [company, stages, contacts, signals, interactions, qualification, reminders, icp, profile] = await Promise.all([
    getCompanyById(id),
    getPipelineStages(),
    getCompanyContacts(id),
    getCompanySignals(id),
    getCompanyInteractions(id),
    getLatestQualification(id),
    getCompanyReminders(id),
    getIcpBasics(),
    getUserProfile(),
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
      dayRate={icp.dayRate}
      hasPitch={Boolean(profile?.message_pitch)}
    />
  )
}

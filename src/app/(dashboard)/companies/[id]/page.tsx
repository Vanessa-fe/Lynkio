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
import { getContactsOutreach, getOrganizationOptions } from '@/lib/queries/people'
import { getStrategy } from '@/lib/queries/strategies'

interface CompanyPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{ redaction?: string }>
}

export default async function CompanyPage({ params, searchParams }: CompanyPageProps) {
  const [{ id }, { redaction }] = await Promise.all([params, searchParams])
  const [company, stages, contacts, signals, interactions, qualification, reminders, icp, profile, outreach] = await Promise.all([
    getCompanyById(id),
    getPipelineStages(),
    getCompanyContacts(id),
    getCompanySignals(id),
    getCompanyInteractions(id),
    getLatestQualification(id),
    getCompanyReminders(id),
    getIcpBasics(),
    getUserProfile(),
    getContactsOutreach(id),
  ])

  if (!company) {
    notFound()
  }

  // Personne seule : les entreprises auxquelles on peut la rattacher
  const [organizations, strategy] = await Promise.all([
    company.kind === 'individual' ? getOrganizationOptions() : Promise.resolve([]),
    company.strategy_id ? getStrategy(company.strategy_id) : Promise.resolve(null),
  ])

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
      organizations={organizations}
      outreach={outreach}
      openEmailDraft={redaction === 'email'}
      strategy={strategy}
    />
  )
}

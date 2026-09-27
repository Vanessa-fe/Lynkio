import { RemindersList } from '@/components/reminders/reminders-list'
import { getReminders, getRemindersCount } from '@/lib/queries/reminders'
import { getCompanyChoices } from '@/lib/queries/prospection'

export default async function RemindersPage() {
  const [reminders, totalCount, companies] = await Promise.all([
    getReminders({ limit: 100 }),
    getRemindersCount(),
    getCompanyChoices(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relances</h1>
        <p className="text-muted-foreground mt-2">
          Vos rappels, des plus urgents aux plus lointains. Une piste qu&apos;on ne relance pas est une piste
          perdue.
        </p>
      </div>
      <RemindersList reminders={reminders} totalCount={totalCount} companies={companies} />
    </div>
  )
}

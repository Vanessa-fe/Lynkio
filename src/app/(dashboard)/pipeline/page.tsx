import { redirect } from 'next/navigation'

// « Pipeline commercial » est devenu la vue Kanban de la page Entreprises (lot 1.9) :
// les anciens liens et favoris y mènent
export default function PipelinePage() {
  redirect('/companies?vue=kanban')
}

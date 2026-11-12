'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { markNotificationsRead } from '@/lib/actions/notifications'

export function MarkReadButton() {
  const [pending, start] = useTransition()
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(() => markNotificationsRead())}>
      Tout marquer comme lu
    </Button>
  )
}

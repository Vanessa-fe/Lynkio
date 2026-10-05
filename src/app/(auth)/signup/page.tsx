import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SIGNUPS_CLOSED_MESSAGE, SIGNUPS_OPEN } from '@/lib/constants/signup'
import { SignupForm } from './signup-form'

export default function SignupPage() {
  if (SIGNUPS_OPEN) {
    return <SignupForm />
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Inscriptions fermées</CardTitle>
        <CardDescription>
          {SIGNUPS_CLOSED_MESSAGE} Lynkio est en test privé. Vous avez déjà un compte ? Connectez-vous.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <Link href="/login">Se connecter</Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

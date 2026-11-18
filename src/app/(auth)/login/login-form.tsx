'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { login } from '@/lib/actions/auth'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { isNavigationError } from '@/lib/utils/navigation-error'

export function LoginForm({
  linkExpired = false,
  accountDeleted = false,
  redirectTo = null,
}: {
  linkExpired?: boolean
  // Page demandée avant la connexion (lien d'un e-mail) : on y revient après
  redirectTo?: string | null
  // Arrivée juste après la suppression du compte
  accountDeleted?: boolean
}) {
  const [error, setError] = useState<string | null>(
    linkExpired ? 'Ce lien n’est plus valable (déjà utilisé ou expiré). Connectez-vous avec votre mot de passe.' : null
  )
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setError(null)
    setIsLoading(true)

    // Chargement de la page suivante en cours : le bouton reste en attente jusqu'au changement de page
    let leaving = false
    try {
      const result = await login(data, redirectTo)

      // Action réussie : le serveur redirige et ne renvoie rien (la navigation est déjà en cours)
      if (result?.success && result.redirectTo) {
        // Chargement complet : la page arrive entière, avec son menu (voir actions/auth.ts)
        leaving = true
        window.location.assign(result.redirectTo)
        return
      }
      if (result && !result.success && result.error) {
        setError(result.error)
      }
    } catch (err) {
      // Connexion réussie : la redirection vers le tableau de bord arrive comme une « erreur »
      if (isNavigationError(err)) return
      setError('Une erreur inattendue est survenue')
    } finally {
      if (!leaving) setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
        <CardDescription>
          Connectez-vous à votre compte pour accéder à votre CRM
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {accountDeleted && !error && (
            <div role="status" className="p-3 text-sm text-emerald-800 bg-emerald-50 rounded-md dark:text-emerald-200 dark:bg-emerald-950/40">
              Votre compte et toutes vos données ont été supprimés. Merci d&apos;avoir essayé Filonea.
            </div>
          )}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              autoComplete="email"
              disabled={isLoading}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link
                href="/reset-password"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </Button>
          {SIGNUPS_OPEN && (
            <p className="text-sm text-center text-muted-foreground">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="text-primary hover:underline">
                Créer un compte
              </Link>
            </p>
          )}
          <p className="text-sm text-center text-muted-foreground">
            <Link href="/" className="hover:underline">
              Découvrir Filonea
            </Link>
            {' · '}
            <Link href="/contact" className="hover:underline">
              Besoin d&apos;aide ?
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

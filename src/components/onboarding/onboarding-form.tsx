'use client'

import { useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, type OnboardingInput } from '@/lib/validations/user-profile'
import { completeOnboarding } from '@/lib/actions/user-profile'
import { THEMES } from '@/lib/constants/themes'
import { MAX_SEARCH_KEYWORDS } from '@/lib/validations/icp'
import { KeywordPicker } from '@/components/settings/keyword-picker'
import { suggestKeywords } from '@/lib/actions/keyword-suggestions'
import { cn } from '@/lib/utils'
import type { Profession } from '@/types'
import { LogoutButton } from '@/components/layout/logout-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ProfessionChoice = Pick<Profession, 'key' | 'label' | 'description'> & {
  suggestedKeywords: string[]
  defaultKeywords: string[]
}

interface OnboardingFormProps {
  professions: ProfessionChoice[]
  defaultValues: Partial<OnboardingInput>
  /** Compte déjà configuré à qui il ne manque que le métier */
  isReturningUser: boolean
  /** Compte connecté : on le montre pour qu'on puisse en changer si ce n'est pas le bon */
  email: string | null
}

export function OnboardingForm({ professions, defaultValues, isReturningUser, email }: OnboardingFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      ...defaultValues,
      selectedTheme: defaultValues.selectedTheme ?? 'minimal',
    },
  })

  const professionKey = useWatch({ control, name: 'professionKey' })
  const searchKeywords = useWatch({ control, name: 'searchKeywords' })
  const profession = professions.find((candidate) => candidate.key === professionKey) ?? null
  // Tant que la personne n'a rien touché, les mots-clés suivent le métier choisi
  const [keywordsEdited, setKeywordsEdited] = useState(false)
  const shownKeywords = keywordsEdited ? (searchKeywords ?? []) : (profession?.defaultKeywords ?? [])

  const onSubmit = async (data: OnboardingInput) => {
    setError(null)
    setIsLoading(true)

    try {
      const result = await completeOnboarding({ ...data, searchKeywords: shownKeywords })

      // Action réussie : le serveur redirige et ne renvoie rien (la navigation est déjà en cours)
      if (result && !result.success && result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError('Une erreur inattendue est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center">
              {isReturningUser ? 'Quel est votre métier ?' : 'Bienvenue sur Filonea'}
            </CardTitle>
            <CardDescription className="text-center">
              {isReturningUser
                ? 'Filonea s\'adapte maintenant à votre métier : choisissez-le pour continuer'
                : 'Quelques informations pour personnaliser votre expérience'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md space-y-2">
                  <p>{error}</p>
                  {error.includes('connecté') && (
                    <p className="text-xs">
                      <a href="/login" className="underline hover:text-destructive/80">
                        Cliquez ici pour vous reconnecter
                      </a>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  placeholder="Votre prénom"
                  disabled={isLoading}
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Nom de votre activité</Label>
                <Input
                  id="businessName"
                  placeholder="Ex : Studio Lumen, Marie Dupont Design..."
                  disabled={isLoading}
                  {...register('businessName')}
                />
                {errors.businessName && (
                  <p className="text-sm text-destructive">
                    {errors.businessName.message}
                  </p>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium leading-none mb-2">Votre métier</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {professions.map((profession) => (
                    <label
                      key={profession.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                        'hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                        isLoading && 'pointer-events-none opacity-50'
                      )}
                    >
                      <input
                        type="radio"
                        value={profession.key}
                        disabled={isLoading}
                        className="mt-1 accent-primary"
                        {...register('professionKey')}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="font-medium">{profession.label}</span>
                        {profession.description && (
                          <span className="text-xs text-muted-foreground">
                            {profession.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.professionKey && (
                  <p className="text-sm text-destructive">
                    {errors.professionKey.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Votre métier détermine les postes à cibler et les signaux d&apos;achat
                  utiles. Vous pourrez affiner votre client idéal ensuite.
                </p>
              </fieldset>

              {profession && (
                <div className="space-y-2">
                  <p className="text-sm font-medium leading-none">Mots-clés recherchés</p>
                  <p className="text-xs text-muted-foreground">
                    Sophie cherche les offres d&apos;emploi dont l&apos;intitulé contient l&apos;un de ces mots : une
                    entreprise qui recrute dans votre métier a un besoin et un budget.
                    {profession.key === 'web_developer'
                      ? ' Les offres de développeur, de webmaster et du digital sont déjà cherchées pour vous.'
                      : ''}
                  </p>
                  <KeywordPicker
                    value={shownKeywords}
                    onChange={(next) => {
                      setKeywordsEdited(true)
                      setValue('searchKeywords', next)
                    }}
                    suggestions={profession.suggestedKeywords}
                    max={MAX_SEARCH_KEYWORDS}
                    disabled={isLoading}
                    placeholder="Ex. : graphiste, community manager"
                    inputLabel="Nouveau mot-clé recherché"
                    listLabel="Mots-clés recherchés"
                    searchSuggestions={suggestKeywords}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="selectedTheme">Thème de couleur</Label>
                <Controller
                  name="selectedTheme"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="selectedTheme">
                        <SelectValue placeholder="Choisissez un thème" />
                      </SelectTrigger>
                      <SelectContent>
                        {THEMES.map((theme) => (
                          <SelectItem key={theme.id} value={theme.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{theme.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {theme.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.selectedTheme && (
                  <p className="text-sm text-destructive">
                    {errors.selectedTheme.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Vous pourrez modifier le thème à tout moment dans les paramètres
                </p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading
                  ? 'Configuration...'
                  : isReturningUser
                    ? 'Continuer'
                    : 'Commencer à utiliser Filonea'}
              </Button>
            </CardContent>
          </form>
        </Card>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground text-center">
          <span>
            {email ? (
              <>
                Connecté·e avec <span className="font-medium text-foreground break-all">{email}</span>.
              </>
            ) : (
              'Vous êtes connecté·e.'
            )}{' '}
            Ce n&apos;est pas votre compte ?
          </span>
          <LogoutButton variant="link" className="h-auto p-0" />
        </div>
      </div>
    </div>
  )
}

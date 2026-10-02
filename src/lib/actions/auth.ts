'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SIGNUPS_CLOSED_MESSAGE, SIGNUPS_OPEN } from '@/lib/constants/signup'
import {
  loginSchema,
  signupSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  type LoginInput,
  type SignupInput,
  type ResetPasswordInput,
  type UpdatePasswordInput,
} from '@/lib/validations/auth'

/**
 * Type de retour pour les actions d'authentification
 */
type ActionResult = {
  success: boolean
  error?: string
}

/**
 * Connexion d'un utilisateur
 */
export async function login(data: LoginInput): Promise<ActionResult> {
  let destination = '/dashboard'

  try {
    // Validation
    const validated = loginSchema.parse(data)

    const supabase = await createClient()

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    })

    if (error) {
      return {
        success: false,
        error: 'Email ou mot de passe incorrect',
      }
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', authData.user.id)
      .maybeSingle()

    const onboardingCompleted = (profile as {
      onboarding_completed: boolean
    } | null)?.onboarding_completed

    if (!onboardingCompleted) {
      destination = '/onboarding'
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de la connexion',
    }
  }

  revalidatePath('/', 'layout')
  redirect(destination)
}

/**
 * Inscription d'un nouvel utilisateur
 */
export async function signup(data: SignupInput): Promise<ActionResult> {
  if (!SIGNUPS_OPEN) {
    return { success: false, error: SIGNUPS_CLOSED_MESSAGE }
  }

  try {
    // Validation
    const validated = signupSchema.parse(data)

    const supabase = await createClient()

    const { data: authData, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      return {
        success: false,
        error: 'Impossible de créer le compte. Cet email est peut-être déjà utilisé.',
      }
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Une erreur est survenue lors de la création du compte',
      }
    }

    // Le profil utilisateur sera créé automatiquement par un trigger PostgreSQL
    // Pas besoin de le créer manuellement ici

    // Sans session, Supabase attend la confirmation de l'adresse email.
    // Ne pas envoyer l'utilisateur vers une page protégée avant cette étape.
    if (!authData.session) {
      return {
        success: true,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de l\'inscription',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

/**
 * Déconnexion de l'utilisateur
 */
export async function logout(): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        success: false,
        error: 'Impossible de se déconnecter',
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de la déconnexion',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Demande de réinitialisation de mot de passe
 */
export async function resetPassword(data: ResetPasswordInput): Promise<ActionResult> {
  try {
    // Validation
    const validated = resetPasswordSchema.parse(data)

    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/update-password`,
    })

    if (error) {
      return {
        success: false,
        error: 'Impossible d\'envoyer l\'email de réinitialisation',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de la réinitialisation',
    }
  }
}

/**
 * Mise à jour du mot de passe
 */
export async function updatePassword(data: UpdatePasswordInput): Promise<ActionResult> {
  try {
    // Validation
    const validated = updatePasswordSchema.parse(data)

    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
      password: validated.password,
    })

    if (error) {
      return {
        success: false,
        error: 'Impossible de mettre à jour le mot de passe',
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de la mise à jour',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

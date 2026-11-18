import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { lien, compte, redirect } = await searchParams
  return (
    <LoginForm
      linkExpired={lien === 'expire'}
      accountDeleted={compte === 'supprime'}
      redirectTo={typeof redirect === 'string' ? redirect : null}
    />
  )
}

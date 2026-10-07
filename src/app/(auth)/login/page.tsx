import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { lien } = await searchParams
  return <LoginForm linkExpired={lien === 'expire'} />
}

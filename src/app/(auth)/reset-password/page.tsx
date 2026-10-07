import { ResetPasswordForm } from './reset-password-form'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { lien } = await searchParams
  return <ResetPasswordForm linkExpired={lien === 'expire'} />
}

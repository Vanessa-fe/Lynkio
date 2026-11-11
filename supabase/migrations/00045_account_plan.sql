-- Offre appliquée à un compte, pour les fonctions de Sophie :
-- 'pro' (essai gratuit, compte offert, abonnement Pro), 'essentiel', ou null (essai terminé, sans abonnement).
-- Même règle que getAccess dans src/lib/billing.ts. Sans ligne d'abonnement (cas anormal) : 'pro'.
create or replace function public.account_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when b.user_id is null then 'pro'
    when b.exempt then 'pro'
    when b.status in ('active', 'trialing', 'past_due') then case when b.plan = 'essentiel' then 'essentiel' else 'pro' end
    when b.trial_ends_at > now() then 'pro'
    else null
  end
  from (select p_user_id as id) as account
  left join public.billing as b on b.user_id = account.id
$$;

revoke execute on function public.account_plan(uuid) from public, anon, authenticated;
grant execute on function public.account_plan(uuid) to service_role;

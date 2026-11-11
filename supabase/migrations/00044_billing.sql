-- Abonnements (Stripe) et essai gratuit de 14 jours de l'offre Pro.
-- Une ligne par compte, créée à l'inscription. Le navigateur peut seulement la lire : l'essai, l'offre
-- et le statut ne sont écrits que par le serveur (webhook Stripe, fonction billing), avec service_role.
CREATE TABLE billing (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  -- Comptes de l'équipe : jamais bloqués
  exempt BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT CHECK (plan IN ('essentiel', 'pro')),
  billing_interval TEXT CHECK (billing_interval IN ('month', 'year')),
  -- Statut Stripe de l'abonnement : active, trialing, past_due, canceled, unpaid, incomplete…
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE billing IS 'Essai gratuit et abonnement Stripe de chaque compte (écrit par le serveur seulement)';

ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own billing"
  ON billing FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Comptes existants : 14 jours d'essai à partir d'aujourd'hui
INSERT INTO billing (user_id)
SELECT id FROM user_profiles
ON CONFLICT (user_id) DO NOTHING;

-- Nouveaux comptes : la ligne naît avec le profil
CREATE FUNCTION public.create_billing_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.billing (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_billing_row() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER user_profiles_create_billing
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_billing_row();

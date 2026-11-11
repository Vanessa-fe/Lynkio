-- IA du lancement (décision du 11/11/2026) : OpenAI, Claude (Anthropic) et Gemini seulement, chacun
-- avec sa propre recherche sur Internet ; Hunter pour les e-mails. « Autre IA » (services compatibles
-- OpenAI, 00041) et Mistral disparaissent : plus aucune clé de ce type n'existe (vérifié le 11/11).
-- À appliquer une fois le site sans « Autre IA » en ligne (il ne lit plus base_url).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_api_keys
     WHERE provider NOT IN ('openai', 'anthropic', 'gemini', 'hunter') OR base_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Des clés d''une IA retirée existent encore : les supprimer avant cette migration';
  END IF;
END;
$$;

ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini', 'hunter'));

UPDATE user_profiles SET ai_provider = NULL WHERE ai_provider NOT IN ('openai', 'anthropic', 'gemini');
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_ai_provider_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_ai_provider_check
  CHECK (ai_provider IN ('openai', 'anthropic', 'gemini'));

DROP FUNCTION public.save_my_custom_ai_key(TEXT, TEXT, TEXT);
DROP FUNCTION public.read_user_api_base_url(UUID, TEXT);
ALTER TABLE user_api_keys DROP COLUMN base_url;

/**
 * Enregistre (ou remplace) la clé d'un service pour l'utilisateur connecté (même fonction qu'en 00034,
 * avec la liste des fournisseurs du lancement)
 */
CREATE OR REPLACE FUNCTION public.save_my_api_key(p_provider TEXT, p_key TEXT, p_model TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  clean_key TEXT := btrim(p_key);
  clean_model TEXT := NULLIF(btrim(p_model), '');
  existing_secret UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_provider NOT IN ('openai', 'anthropic', 'gemini', 'hunter') THEN
    RAISE EXCEPTION 'Unknown provider' USING ERRCODE = '22023';
  END IF;
  IF clean_key IS NULL OR char_length(clean_key) NOT BETWEEN 16 AND 400 OR clean_key ~ '\s' THEN
    RAISE EXCEPTION 'Invalid key' USING ERRCODE = '22023';
  END IF;

  SELECT secret_id INTO existing_secret
    FROM public.user_api_keys
   WHERE user_id = current_user_id AND provider = p_provider;

  IF existing_secret IS NULL THEN
    INSERT INTO public.user_api_keys (user_id, provider, secret_id, key_hint, model)
    VALUES (
      current_user_id,
      p_provider,
      vault.create_secret(clean_key, NULL, 'Clé personnelle ' || p_provider),
      right(clean_key, 4),
      clean_model
    );
  ELSE
    PERFORM vault.update_secret(existing_secret, clean_key);
    UPDATE public.user_api_keys
       SET key_hint = right(clean_key, 4), model = clean_model, updated_at = now()
     WHERE user_id = current_user_id AND provider = p_provider;
  END IF;
END;
$$;

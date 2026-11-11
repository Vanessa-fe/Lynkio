-- « Autre IA » : n'importe quel service compatible avec l'API d'OpenAI (Mistral, DeepSeek, Groq,
-- OpenRouter, xAI…), avec son adresse d'API et son modèle (demande du 11/11/2026).
-- Les fonctions existantes ne changent pas : deux fonctions s'ajoutent pour l'adresse de l'API.
-- L'adresse est vérifiée ici (https, pas d'identifiants) et de nouveau côté serveur avant chaque appel.

ALTER TABLE user_api_keys
  ADD COLUMN base_url TEXT
  CONSTRAINT user_api_keys_base_url_check
    CHECK (base_url IS NULL OR (char_length(base_url) <= 200 AND base_url ~ '^https://[A-Za-z0-9.-]+(:443)?(/[A-Za-z0-9._~/-]*)?$'));

ALTER TABLE user_api_keys DROP CONSTRAINT user_api_keys_provider_check;
ALTER TABLE user_api_keys ADD CONSTRAINT user_api_keys_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini', 'mistral', 'custom', 'hunter'));

ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_ai_provider_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_ai_provider_check
  CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'mistral', 'custom'));

/**
 * Enregistre (ou remplace) la clé « Autre IA » de l'utilisateur connecté, avec l'adresse de l'API et le modèle
 */
CREATE FUNCTION public.save_my_custom_ai_key(p_key TEXT, p_model TEXT, p_base_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  clean_key TEXT := btrim(p_key);
  clean_model TEXT := NULLIF(btrim(p_model), '');
  clean_url TEXT := NULLIF(rtrim(btrim(p_base_url), '/'), '');
  existing_secret UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF clean_key IS NULL OR char_length(clean_key) NOT BETWEEN 16 AND 400 OR clean_key ~ '\s' THEN
    RAISE EXCEPTION 'Invalid key' USING ERRCODE = '22023';
  END IF;
  IF clean_url IS NULL OR clean_model IS NULL THEN
    RAISE EXCEPTION 'A URL and a model are required' USING ERRCODE = '22023';
  END IF;

  SELECT secret_id INTO existing_secret
    FROM public.user_api_keys
   WHERE user_id = current_user_id AND provider = 'custom';

  IF existing_secret IS NULL THEN
    INSERT INTO public.user_api_keys (user_id, provider, secret_id, key_hint, model, base_url)
    VALUES (
      current_user_id,
      'custom',
      vault.create_secret(clean_key, NULL, 'Clé personnelle custom'),
      right(clean_key, 4),
      clean_model,
      clean_url
    );
  ELSE
    PERFORM vault.update_secret(existing_secret, clean_key);
    UPDATE public.user_api_keys
       SET key_hint = right(clean_key, 4), model = clean_model, base_url = clean_url, updated_at = now()
     WHERE user_id = current_user_id AND provider = 'custom';
  END IF;
END;
$$;

/**
 * Adresse de l'API « Autre IA » d'un utilisateur, pour les fonctions serveur seulement (service_role)
 */
CREATE FUNCTION public.read_user_api_base_url(p_user_id UUID, p_provider TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT base_url FROM public.user_api_keys WHERE user_id = p_user_id AND provider = p_provider;
$$;

REVOKE ALL ON FUNCTION public.save_my_custom_ai_key(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.read_user_api_base_url(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_custom_ai_key(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_user_api_base_url(UUID, TEXT) TO service_role;

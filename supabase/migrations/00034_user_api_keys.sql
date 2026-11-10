-- Clés personnelles des services payants (IA, Hunter) : chaque utilisateur apporte les siennes,
-- et paie directement son fournisseur.
--
-- La clé est chiffrée par Supabase Vault ; la table ne garde que ses 4 derniers caractères, pour
-- l'afficher. Le navigateur peut enregistrer ou supprimer sa clé, jamais la relire : seules les
-- fonctions serveur (rôle service_role) la déchiffrent, au moment d'appeler le service.

CREATE TABLE user_api_keys (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'mistral', 'hunter')),
  secret_id UUID NOT NULL,
  key_hint TEXT NOT NULL,
  -- Modèle d'IA choisi ; null = modèle conseillé par Filonea
  model TEXT CHECK (model IS NULL OR char_length(model) <= 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

COMMENT ON TABLE user_api_keys IS 'Clés personnelles (chiffrées dans vault.secrets) : seuls les 4 derniers caractères sont lisibles';

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Lecture de ses propres lignes (fournisseur, 4 derniers caractères) ; aucune écriture directe
CREATE POLICY "Users can read their own key hints"
  ON user_api_keys FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- IA utilisée par Sophie, parmi les clés enregistrées
ALTER TABLE user_profiles
  ADD COLUMN ai_provider TEXT CHECK (ai_provider IN ('openai', 'anthropic', 'gemini', 'mistral'));

-- Une clé supprimée (par l'utilisateur, ou avec son compte) l'est aussi du coffre
CREATE FUNCTION public.delete_user_api_key_secret()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = OLD.secret_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER user_api_keys_delete_secret
  AFTER DELETE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.delete_user_api_key_secret();

/**
 * Enregistre (ou remplace) la clé de l'utilisateur connecté pour un service
 */
CREATE FUNCTION public.save_my_api_key(p_provider TEXT, p_key TEXT, p_model TEXT DEFAULT NULL)
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
  IF p_provider NOT IN ('openai', 'anthropic', 'gemini', 'mistral', 'hunter') THEN
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

/**
 * Supprime la clé de l'utilisateur connecté pour un service
 */
CREATE FUNCTION public.delete_my_api_key(p_provider TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_api_keys WHERE user_id = auth.uid() AND provider = p_provider;
END;
$$;

/**
 * Clé déchiffrée d'un utilisateur, pour les fonctions serveur seulement (service_role)
 */
CREATE FUNCTION public.read_user_api_key(p_user_id UUID, p_provider TEXT)
RETURNS TABLE (api_key TEXT, model TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT secrets.decrypted_secret, keys.model
    FROM public.user_api_keys keys
    JOIN vault.decrypted_secrets secrets ON secrets.id = keys.secret_id
   WHERE keys.user_id = p_user_id AND keys.provider = p_provider;
$$;

-- Supabase donne l'exécution des nouvelles fonctions à anon et authenticated : on la retire
REVOKE ALL ON FUNCTION public.delete_user_api_key_secret() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_my_api_key(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_api_key(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.read_user_api_key(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_my_api_key(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_user_api_key(UUID, TEXT) TO service_role;

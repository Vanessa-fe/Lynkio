-- Rôle de la sauvegarde quotidienne (GitHub Actions, dépôt privé filonea-backups).
-- Il lit toutes les données (pg_read_all_data, sans les filtres RLS pour que la copie soit
-- complète) et ne peut rien modifier : chaque transaction est en lecture seule.
-- Son mot de passe n'est jamais écrit dans ce dépôt public : il est fixé à part, sous forme
-- hachée (SCRAM), et rangé seulement dans les secrets GitHub du dépôt de sauvegarde.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'filonea_backup') THEN
    CREATE ROLE filonea_backup LOGIN BYPASSRLS CONNECTION LIMIT 2;
  END IF;
END
$$;

GRANT pg_read_all_data TO filonea_backup;

ALTER ROLE filonea_backup SET default_transaction_read_only = on;

# Configuration de Filonea

## ✅ Ce qui est fait

- ✅ Projet Next.js configuré
- ✅ Supabase CLI installé et lié au projet cloud
- ✅ Variables d'environnement configurées (`.env.local`)
- ✅ Serveur Next.js démarré sur http://localhost:3000

## 🔧 Étapes restantes

### 1. Exécuter les migrations SQL sur Supabase

**IMPORTANT** : Si tu ne l'as pas encore fait, tu dois exécuter les 3 migrations SQL dans l'éditeur Supabase.

👉 **Ouvre l'éditeur SQL** : https://supabase.com/dashboard/project/kifzcqxasqpcstujihqt/sql/new

Ensuite, **copie et exécute chaque fichier SQL dans l'ordre** :

#### Migration 1 : Schéma initial
```bash
cat supabase/migrations/00001_initial_schema.sql
```
Copie tout le contenu → Colle dans l'éditeur SQL → Clique sur "RUN"

#### Migration 2 : Politiques RLS
```bash
cat supabase/migrations/00002_rls_policies.sql
```
Copie tout le contenu → Colle dans l'éditeur SQL → Clique sur "RUN"

#### Migration 3 : Fonction d'initialisation
```bash
cat supabase/migrations/00003_seed_default_data.sql
```
Copie tout le contenu → Colle dans l'éditeur SQL → Clique sur "RUN"

### 2. Tester l'authentification

1. **Ouvre l'application** : http://localhost:3000

2. **Crée un compte** :
   - Clique sur "Créer un compte"
   - Entre un email et un mot de passe (min 8 caractères, avec majuscule, minuscule et chiffre)
   - Exemple : `Test1234`

3. **Complète l'onboarding** :
   - Prénom
   - Nom de l'activité
   - Type d'activité
   - Choisis un thème parmi les 6 disponibles

4. **Explore le dashboard** :
   - Tu seras redirigé vers `/dashboard`
   - Navigation mobile en bas (5 items)
   - Navigation desktop sur le côté
   - KPIs affichés (tous à 0 pour l'instant)

### 3. Vérifier que tout fonctionne

Teste le flux complet :
- ✅ Inscription → Onboarding → Dashboard
- ✅ Déconnexion → Reconnexion
- ✅ Réinitialisation de mot de passe (vérifie ta boîte mail)
- ✅ Navigation entre les pages

## 🐛 En cas de problème

### Erreur "Failed to execute statement"
- Les migrations SQL n'ont pas été exécutées
- Retourne dans l'éditeur SQL et exécute-les dans l'ordre

### Erreur "unauthorized" ou "access denied"
- Vérifie que les politiques RLS ont été appliquées (migration 2)
- Vérifie que ton `.env.local` contient les bonnes clés

### Erreur lors de l'onboarding
- Vérifie que la fonction `initialize_user_defaults` a été créée (migration 3)
- Consulte les logs dans la console du navigateur (F12)

### Le serveur ne démarre pas
```bash
# Arrête le serveur
pkill -f "next dev"

# Relance-le
npm run dev
```

## 📚 Prochaines étapes

Une fois que tout fonctionne :

1. **Phase 3 : Contacts**
   - Formulaire de création de contact
   - Normalisation du téléphone
   - Détection de doublons
   - Liste avec filtres
   - Vue détail

2. **Phase 4 : Interactions**
   - Timeline des interactions
   - Types d'interactions
   - Mise à jour automatique

3. **Phase 5-11** : Rendez-vous, Paiements, Dashboard complet, etc.

## 🔗 Liens utiles

- **Application** : http://localhost:3000
- **Supabase Dashboard** : https://supabase.com/dashboard/project/kifzcqxasqpcstujihqt
- **SQL Editor** : https://supabase.com/dashboard/project/kifzcqxasqpcstujihqt/sql/new
- **Table Editor** : https://supabase.com/dashboard/project/kifzcqxasqpcstujihqt/editor

---

**Bon développement !** 🚀

# Supabase setup and safe migration procedure

## Migration order

1. `202611170001_initial.sql` — schéma du tournoi et RLS initiale.
2. `202611180002_secure_username_auth.sql` — champs username/rôle et ancien bootstrap Auth.
3. `202611180003_tournament_workflows.sql` — inscriptions et cycle de vie.
4. `202611180004_competition_and_communications.sql` — tirage, résultats, contacts et annonces.
5. `202611180005_standings_knockout_podium.sql` — classements et élimination directe.
6. `202611190006_username_password_auth.sql` — identifiants Argon2id, sessions, limitation des tentatives et adaptateurs serveur.

La migration 006 est additive. Elle conserve toutes les lignes de `profiles` et `auth.users`, retire uniquement la clé étrangère qui obligeait chaque profil à dépendre de `auth.users`, puis désactive l’ancien trigger d’inscription. Elle ne supprime aucun utilisateur existant.

## Projet de test obligatoire

Créez un projet Supabase jetable distinct, puis :

```bash
supabase login
supabase link --project-ref YOUR_TEST_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
```

Configurez `.env.test.local` avec `SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_ROLE_KEY` et `SUPABASE_TEST_CONFIRM=disposable-project`, puis exécutez :

```bash
npm run test:integration
```

Le projet doit être vide ou réservé à ces tests. Le test refuse d’être présenté comme une validation de production.

## Projet existant `eweiwqffiwbnnfkexjkv`

Les migrations 001–005 étant déjà présentes, inspectez d’abord l’historique :

```bash
supabase link --project-ref eweiwqffiwbnnfkexjkv
supabase migration list
supabase db push --dry-run
```

Vérifiez que le dry-run propose uniquement la migration 006. Si l’historique distant ne correspond pas aux fichiers, arrêtez-vous et réconciliez l’historique avant toute écriture. N’utilisez jamais `supabase db reset` sur ce projet.

Après validation explicite du dry-run :

```bash
supabase db push
npm run audit:schema
```

Dans Supabase Dashboard → Authentication, désactivez les nouvelles inscriptions email/password : l’application ne transmet plus aucun email à Supabase Auth. Les anciennes lignes `auth.users` restent conservées mais ne donnent plus accès aux mutations applicatives.

## Provisionnement de `anas`

Dans `.env.local`, configurez un mot de passe fort temporairement :

```dotenv
ADMIN_USERNAME=anas
ADMIN_PASSWORD=at-least-12-characters-with-Aa1-symbol
```

Puis :

```bash
npm run provision:admin
npm run audit:admin
```

Le provisionnement :

1. refuse un mot de passe faible sur tout projet distant ;
2. vérifie la présence de la migration 006 avant toute écriture ;
3. hache le mot de passe avec Argon2id ;
4. crée ou actualise le profil `anas` côté application ;
5. attribue `ADMIN` et `is_super_admin=true` dans une RPC réservée au service role ;
6. invalide les anciennes sessions admin ;
7. relit le profil et l’identifiant pour confirmer le résultat.

Les profils existants sans ligne `app_credentials` ne sont pas revendicables automatiquement : cela empêcherait l’usurpation d’un ancien username. Leur activation nécessite une intervention administrateur contrôlée.

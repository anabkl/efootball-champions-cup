# eFootball Champions Cup

Application privée de gestion d’un tournoi eFootball : comptes joueurs par username, inscriptions flexibles, administration, groupes, matchs, classements et phases finales.

## Authentification

Supabase Auth n’est pas utilisé pour les comptes de l’application, car ses comptes permanents par mot de passe exigent une adresse email ou un numéro de téléphone. Better Auth n’a pas été retenu non plus : son plugin username permet la connexion par username, mais son inscription email/password conserve un email obligatoire.

L’application utilise à la place :

- `profiles` comme identité applicative avec un username unique ;
- `app_credentials` avec des hashes Argon2id, jamais des mots de passe en clair ;
- `app_sessions` avec un jeton aléatoire de 256 bits dans un cookie HttpOnly et seulement son SHA-256 en base ;
- `app_login_attempts` pour bloquer quinze minutes après cinq échecs ;
- des Server Actions Next.js, qui appliquent la vérification CSRF Origin/Host du framework ;
- une vérification de session et de rôle dans chaque mutation serveur.

La clé `SUPABASE_SERVICE_ROLE_KEY` est utilisée uniquement dans les modules serveur. Elle ne doit jamais avoir le préfixe `NEXT_PUBLIC` ni être importée dans un composant client.

## Installation locale

```bash
cp .env.example .env.local
npm install
npm run dev
```

Renseignez dans `.env.local` :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
ADMIN_USERNAME=anas
ADMIN_PASSWORD=replace-with-a-strong-local-secret
```

Appliquez les six migrations dans l’ordre indiqué par [supabase/SETUP.md](supabase/SETUP.md), puis provisionnez l’administrateur :

```bash
npm run audit:schema
npm run provision:admin
npm run audit:admin
```

Le mot de passe admin distant doit contenir au moins douze caractères, avec minuscule, majuscule, chiffre et symbole. Le script ne l’affiche pas et stocke uniquement son hash Argon2id.

## Déploiement Vercel

Ajoutez ces variables dans Vercel :

- `NEXT_PUBLIC_SUPABASE_URL` ;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ;
- `SUPABASE_SERVICE_ROLE_KEY` comme variable serveur chiffrée, sans préfixe `NEXT_PUBLIC`.

`ADMIN_PASSWORD` n’est pas nécessaire au runtime et ne doit pas être ajouté à Vercel. Exécutez le provisionnement depuis une machine de confiance, puis retirez éventuellement ce mot de passe de `.env.local`.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Le test d’intégration exige un projet Supabase jetable ayant reçu les six migrations :

```dotenv
SUPABASE_TEST_CONFIRM=disposable-project
SUPABASE_TEST_URL=https://your-test-project.supabase.co
SUPABASE_TEST_SERVICE_ROLE_KEY=your-test-service-role-key
```

```bash
npm run test:integration
```

Il crée temporairement `amin` et `anas`, vérifie les hashes, les sessions persistantes et invalidées, le refus des droits admin au joueur et l’inscription au tournoi, puis supprime les données créées. La confirmation explicite est obligatoire et le test refuse l’URL Supabase configurée pour l’application. Ne le pointez jamais vers la production.

No license is included until an explicit license choice is made.

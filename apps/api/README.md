# api

The schelf.store api Worker: publishing, checks, review, signing, downloads on `dl.schelf.store`, search, the dashboard API and the Pult back office. It serves `schelf.store/api/*` and `dl.schelf.store`; the site Worker reaches it through a service binding.

## Run it

```sh
cp .dev.vars.example .dev.vars   # fill in at least the first four
bun run db:migrate
bun run dev
bun run test
```

`STORE_SIGNING_KEY` is a base64 Ed25519 seed and `SEALING_KEY` 32 random bytes in base64. Locally, also set `ROOT_PUBLIC_KEY` to a root of your own and sign store keys with it (`scripts/store-keys.ts init`), since the store only signs with keys its root vouches for.

## Deploy

```sh
bun run deploy
```

It builds the Pult definitions, applies D1 migrations and deploys. The Worker sends its definitions to Pult itself the first time it runs a new version, using its `PULT_KEY` secret. Lantharos's own listings come from `OWNER_EMAIL=… bun scripts/seed-lantharos.ts --remote`, which finds every app and extension in Luft with a `schelf.toml` and takes its text, categories, links, colour and screenshots from its `store/listing.toml`; the store signs them on its next hourly run.

## Pult

Review, rollouts, pulling apps and key rotation all happen in Pult, in the `schelf` project with `dev` and `prod` environments. Each environment's origin is where the Worker runs (`https://schelf.store` for prod); Pult calls `/api/ops`. Put the prod key in the `PULT_KEY` secret.

Mail to the store's addresses arrives through Cloudflare Email Routing, with a rule per address and the catch-all sending it to this Worker's `email` handler. See [Email](../../docs/review.md#email).

## Secrets

Set with `cf workers secrets update <name> --worker schelf-api`.

| Secret                                     | What it is                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                       | Random string for sessions.                                                                                                                  |
| `UPLOAD_SECRET`                            | Random string that signs upload tokens.                                                                                                      |
| `STORE_SIGNING_KEY`                        | The store signing key (Ed25519 seed, base64). Its public half must be in `trust/v1/store-keys.json`.                                         |
| `SEALING_KEY`                              | 32 random bytes in base64 that seal store keys made for a rotation.                                                                          |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app for signing in, callback `https://schelf.store/api/auth/callback/github`.                                                   |
| `GITHUB_TOKEN`                             | Fine-grained token with Contents read and write on Lantharos/Store, to start the checks workflow. Without it releases go straight to review. |
| `ANALYTICS_TOKEN`                          | API token with Account Analytics Read, for the nightly download counts.                                                                      |
| `PULT_KEY`                                 | The `schelf` project's Pult key. Without it nothing reaches Pult.                                                                            |

## Store keys

`scripts/store-keys.ts` signs `trust/v1/store-keys.json` with the root key: `init` for the first key, `add` to rotate in a new one, `revoke` to drop a leaked one. A new key comes from Prepare a new store key in Pult, and the signed file goes live with Publish store keys, which also re-signs everything.

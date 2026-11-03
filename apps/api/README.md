# api

The schelf.store api Worker: publishing, checks, review, signing, downloads on `dl.schelf.store`, search, the dashboard API and the Pult back office. It serves `schelf.store/api/*` and `dl.schelf.store`; the site Worker reaches it through a service binding.

## Run it

```sh
cp .dev.vars.example .dev.vars   # fill in at least the first three
bun run db:migrate
bun run dev
bun run test
```

`STORE_SIGNING_KEY` is a base64 Ed25519 seed; any 32 random bytes work locally.

## Deploy

```sh
bun run deploy
```

It builds the Pult definitions, applies D1 migrations and deploys. Lantharos's own listings come from `scripts/seed-lantharos.ts` (`OWNER_EMAIL=… REVIEWER_TOKEN=… bun scripts/seed-lantharos.ts --remote`).

## Secrets

Set with `wrangler secret put <name>`.

| Secret | What it is |
| --- | --- |
| `BETTER_AUTH_SECRET` | Random string for sessions. |
| `UPLOAD_SECRET` | Random string that signs upload tokens. |
| `STORE_SIGNING_KEY` | The store signing key (Ed25519 seed, base64). Its public half must be in `trust/v1/store-keys.json`. |
| `REVIEWER_TOKEN` | Bearer token for `/api/v1/review/*`, used by the review command. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app for signing in, callback `https://schelf.store/api/auth/callback/github`. |
| `GITHUB_TOKEN` | Fine-grained token with Contents read and write on Lantharos/schelf-store, to start the checks workflow. Without it releases go straight to review. |
| `ANALYTICS_TOKEN` | API token with Account Analytics Read, for the nightly download counts. |
| `PULT_KEY` | The `schelf` project's Pult key. Without it nothing reaches Pult. |

## Store keys

`scripts/store-keys.ts` signs `trust/v1/store-keys.json` with the root key: `init` for the first key, `add` to rotate in a new one, `revoke` to drop a leaked one. Upload the three files it writes to the bucket, then `POST /api/v1/review/resign` re-signs every index file and feed.

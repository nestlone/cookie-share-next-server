# Cookie Share Next Server

Cookie Share Next Server is the self-hostable Node.js, Express, and SQLite backend for [Cookie Share Next](https://github.com/nestlone/cookie-share-next). It is an opaque storage service: bucket encryption and bucket passwords remain in the browser extension, while the server stores encrypted envelopes and enforces account quotas.

## Security model

Users authenticate through GitHub, Google, or LinuxDo OAuth. Provider identities are keyed by provider and subject; matching email addresses are never merged automatically. A signed-in user may manually link additional providers.

Bucket passwords are never submitted to this server. Stored records contain a bucket ID, encrypted envelope, ciphertext byte size, and timestamps. This does not conceal account identities, bucket counts, approximate ciphertext sizes, or request timing. See [the protocol and threat model](docs/protocol.md) for the data model and cryptographic format.

## Requirements

- Node.js 22.5 or newer, including `node:sqlite` support.
- SQLite storage available to the Node.js process.
- For public OAuth deployments, HTTPS must be provided by the surrounding infrastructure.
- At least one configured OAuth client.

## Quick start

```bash
cp .env.example .env
npm ci
npm run build
npm start
```

Edit `.env` before starting. Set a long random `ADMIN_TOKEN`, the public HTTPS origin, and complete client ID/client secret pairs for one or more OAuth providers.

```dotenv
PUBLIC_BASE_URL=https://cookie.nestlone.com
ADMIN_TOKEN=replace-with-a-long-random-secret
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINUXDO_CLIENT_ID=
LINUXDO_CLIENT_SECRET=
```

`PUBLIC_BASE_URL` determines OAuth callback URLs. For the official deployment it is `https://cookie.nestlone.com`.

## Configuration

| Variable | Default | Description |
| --- | ---: | --- |
| `HOST` | `0.0.0.0` | HTTP listen host. |
| `PORT` | `3000` | HTTP listen port. |
| `DB_PATH` | `./data/cookie-share-next.db` | SQLite database path. |
| `ADMIN_TOKEN` | required | Token required by the admin quota API. |
| `PUBLIC_BASE_URL` | required | Public origin used for OAuth callbacks. |
| `DEFAULT_QUOTA_BYTES` | `104857600` | Storage allowance for newly created accounts. |
| `DEFAULT_DAILY_REQUEST_LIMIT` | `1000` | Requests allowed per account per UTC day. |
| `SESSION_TTL_HOURS` | `720` | Session lifetime. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional pair | Enables GitHub OAuth. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional pair | Enables Google OAuth. |
| `LINUXDO_CLIENT_ID` / `LINUXDO_CLIENT_SECRET` | optional pair | Enables LinuxDo OAuth. |

The application refuses to start when no complete OAuth provider configuration is available.

## OAuth setup

Register each provider client with a callback URL under:

```text
<PUBLIC_BASE_URL>/api/v1/auth/oauth/<provider>/callback
```

The extension starts OAuth using PKCE and exchanges a short-lived, single-use result code for a session token. Do not include client secrets in the extension, logs, source control, or client-visible configuration.

## Docker deployment

Docker Compose runs one backend container and persists the SQLite database in the `cookie-share-next-data` named volume. It does not configure a reverse proxy or TLS termination.

1. Copy and configure the environment file:

   ```bash
   cp .env.example .env
   ```

   Set `ADMIN_TOKEN`, `PUBLIC_BASE_URL`, and a complete OAuth client ID/secret pair. `PUBLIC_BASE_URL` must be the externally reachable HTTPS origin, because it determines the OAuth callback URL.

2. Build and start the service:

   ```bash
   docker compose up -d --build
   ```

   The service listens on host port `3000` by default. Set `HOST_PORT` before starting Compose to publish a different host port:

   ```bash
   HOST_PORT=8080 docker compose up -d
   ```

3. Verify readiness:

   ```bash
   curl http://127.0.0.1:3000/api/v1/health
   docker compose ps
   ```

   For a public deployment, provide HTTPS outside this Compose stack and register the OAuth callback URL as:

   ```text
   <PUBLIC_BASE_URL>/api/v1/auth/oauth/<provider>/callback
   ```

### Data and upgrades

The SQLite database is stored in the `cookie-share-next-data` volume. Do not run `docker compose down -v` unless intentionally deleting all service data.

Before upgrading, create a backup while the service is stopped:

```bash
docker compose stop
docker run --rm \
  -v cookie-share-next-data:/data:ro \
  -v "$(pwd)":/backup \
  alpine tar -C /data -czf /backup/cookie-share-next-data-backup.tgz .
```

Then rebuild and start the updated version:

```bash
docker compose up -d --build
```

Keep `.env`, the database volume, and backups protected as sensitive service data. `ADMIN_TOKEN` and OAuth client secrets must never be committed or exposed to clients.

The service exposes an administrative quota API authenticated by `X-Admin-Token`:

- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id` with `{ "quotaBytes": 104857600, "dailyRequestLimit": 1000 }`

## Cloudflare Workers + D1 deployment

Workers is a separate deployment target with the same `/api/v1` HTTP contract as the Node and Docker server. It uses D1 rather than the SQLite file, so existing SQLite accounts, sessions, and buckets are **not migrated** automatically.

1. Fork this repository. In your fork, create a D1 database in the Cloudflare Dashboard, copy its ID, then replace `database_id` in `wrangler.toml`. The ID committed in this repository belongs to the upstream deployment and is not usable from another Cloudflare account.

2. Connect the fork to **Cloudflare Workers & Pages** and deploy it from the Cloudflare Dashboard. Later pushes to your fork's `main` branch will then deploy automatically.

3. In the D1 database's **Console** tab, paste and execute the complete contents of [`migrations/0001_initial.sql`](migrations/0001_initial.sql). This initializes the tables required by the Worker. Confirm that the D1 overview no longer reports zero tables before attempting sign-in.

4. In the Worker dashboard's Variables and Secrets UI, configure at least one complete OAuth client pair. Do not commit secrets or upload `.env` files.

   When using the Cloudflare dashboard's **Workers & Pages → Settings → Variables and Secrets** UI, use these binding types:

   | Binding | Type |
   | --- | --- |
   | `PUBLIC_BASE_URL`, `GITHUB_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `LINUXDO_CLIENT_ID` | Text |
   | `ADMIN_TOKEN`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `LINUXDO_CLIENT_SECRET` | Secret |
   | `DEFAULT_QUOTA_BYTES`, `DEFAULT_DAILY_REQUEST_LIMIT`, `SESSION_TTL_HOURS`, `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW_MIN`, `REQUEST_LOG_RETENTION_DAYS` | Text |

   No binding in this application uses the JSON type. `DB` is not created in this UI: it is the D1 binding declared in `wrangler.toml`. This project sets `keep_vars = true`, so future Git-driven deployments preserve dashboard-configured text variables such as `PUBLIC_BASE_URL` and `GITHUB_CLIENT_ID`.

For local Worker development, create an uncommitted `backend/.dev.vars` containing the same bindings, then run:

```bash
npm run worker:db:migrate:local
npm run worker:dev
```

`PUBLIC_BASE_URL` must be the externally visible Worker origin. Register each provider callback as `<PUBLIC_BASE_URL>/api/v1/auth/oauth/<provider>/callback`. A daily Worker cron removes expired sessions, OAuth records, login-attempt records, and retained request logs. D1 and Workers service limits apply; the quota values in this application are logical ciphertext-storage limits, not a reservation of D1 capacity.

## Development

```bash
npm ci
npm run build
npm test
npm run worker:typecheck
```

For a local development server:

```bash
npm run dev
```

`contract/vectors.json` and `docs/protocol.md` are intentionally maintained copies of the frontend repository's contract. Update both repositories when the protocol changes and run both contract suites.

## Repository layout

```text
.github/       Backend continuous integration
contract/      Fixed protocol fixtures used by server tests
docs/          Protocol and threat-model documentation
src/           Express application, OAuth, storage, and crypto validation
test/          Unit, route, and contract tests
```

## License

Cookie Share Next Server is licensed under the [GNU General Public License v3.0](LICENSE).

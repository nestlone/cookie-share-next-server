# Cookie Share Next Server

Cookie Share Next Server is the self-hostable Node.js, Express, and SQLite backend for [Cookie Share Next](https://github.com/nestlone/cookie-share-next). It is an opaque storage service: bucket encryption and bucket passwords remain in the browser extension, while the server stores encrypted envelopes and enforces account quotas.

## Security model

Users authenticate through GitHub, Google, or LinuxDo OAuth. Provider identities are keyed by provider and subject; matching email addresses are never merged automatically. A signed-in user may manually link additional providers.

Bucket passwords are never submitted to this server. Stored records contain a bucket ID, encrypted envelope, ciphertext byte size, and timestamps. This does not conceal account identities, bucket counts, approximate ciphertext sizes, or request timing. See [the protocol and threat model](docs/protocol.md) for the data model and cryptographic format.

## Requirements

- Node.js 22.5 or newer, including `node:sqlite` support.
- SQLite storage available to the Node.js process.
- An HTTPS reverse proxy for public deployment.
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

## Deployment

Run the service behind an HTTPS reverse proxy that forwards the public host and terminates TLS. Keep the SQLite database and `.env` readable only by the service account. Back up the database as opaque encrypted user data, and protect `ADMIN_TOKEN` as an administrative secret.

The service exposes an administrative quota API authenticated by `X-Admin-Token`:

- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id` with `{ "quotaBytes": 104857600, "dailyRequestLimit": 1000 }`

## Development

```bash
npm ci
npm run build
npm test
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
# Contributing

## Scope

Contributions must preserve the zero-knowledge storage boundary. The server stores encrypted bucket envelopes and must never receive a bucket password or decrypted Cookie data.

## Development workflow

1. Create a focused branch from `main` named `feat/*`, `fix/*`, `docs/*`, `test/*`, or `chore/*`.
2. Use English Conventional Commit messages, for example `fix(oauth): reject expired exchange code`.
3. Run the backend checks before opening a pull request:

   ```bash
   npm ci
   npm run build
   npm test
   ```

4. Add or update tests for behavior changes. Protocol, encryption, validation, and API changes must be synchronized with the frontend repository's protocol documentation and contract vectors.

## Pull requests

Describe behavior, deployment implications, and verification. Never commit `.env`, SQLite databases, OAuth client secrets, `ADMIN_TOKEN`, session tokens, Cookie values, bucket passwords, or exported bucket files.

## Local integration check

When the sibling frontend repository is available:

```bash
npm run build
node ../frontend/e2e/run.mjs
```

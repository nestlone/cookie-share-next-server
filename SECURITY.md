# Security Policy

## Reporting a vulnerability

Do not report security vulnerabilities through public issues, pull requests, application logs, test fixtures, or database exports. Use the repository's private security-reporting channel when it is available; otherwise contact the repository maintainer privately.

Provide a minimal reproduction, affected version or commit, impact, and a proposed mitigation if available. Never include OAuth client secrets, `ADMIN_TOKEN`, bearer tokens, Cookie values, bucket passwords, database files, or unredacted encrypted bucket exports.

## Security boundary

The service is intentionally an opaque storage backend. It authenticates users, enforces quotas, and stores encrypted envelopes, but must not receive or derive bucket passwords or decrypted Cookie data. Changes to OAuth, authorization, storage access control, crypto validation, or protocol handling require security review and test coverage.

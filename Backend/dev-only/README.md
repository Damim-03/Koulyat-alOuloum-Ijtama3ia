# dev-only — never on a real server

Files here are for a developer's own machine only.

- `seed-accounts.sql` creates demo accounts (an administrator, a professor,
  three students) whose password is written **in this repository**. Anyone
  who has seen the code knows it. Never run it against a production database.

This folder is excluded from the Docker build context (`Backend/.dockerignore`
and the root `.dockerignore`), so it cannot end up in an image. On startup in
production, the server also warns if any account still carries the demo
password from this file (`src/core/security/startup-checks.ts`).

The first administrator of a real server is created with:

```bash
ADMIN_EMAIL=… node dist/cli/create-admin.js
```

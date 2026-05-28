# Claude Coding Instructions — TT360-Dev

This file governs how Claude operates in this repository. All five rules below are **non-negotiable** and must be enforced on every task, without exception.

---

## 1. Branch Protection

- **Never push directly to `main` or `master`.**
- All changes must be made on a feature branch following the naming convention `claude/<short-description>`.
- Every merge into `main` requires a pull request. PR must have at least one review approval before merging.
- Force-push (`--force`) to any protected branch is forbidden unless the user gives explicit written permission for that specific push.

## 2. Automated Testing

- Before committing any code change, confirm that existing tests still pass: run the project's test suite (`npm test`, `node scripts/`, or the documented test command).
- If a change introduces new logic, add or update tests to cover it.
- Do not skip, bypass, or comment out failing tests to make CI green — fix the root cause.
- If no test runner is configured, flag this to the user before proceeding with significant changes.

## 3. Staged Rollout

- **No big-bang deploys.** Changes that affect live store data, theme files, or customer-facing content must be deployed in stages:
  1. Deploy to a preview/staging environment (Shopify dev store or theme preview) first.
  2. Validate correctness and performance in staging before touching production.
  3. For theme changes: use `shopify theme push --theme <theme-id>` targeting a non-published theme, verify, then publish.
- Document what was deployed and when in the commit message or a `releases/` entry.

## 4. Backup Before Deploy

- Before overwriting or publishing any live theme file, product data, or store configuration, take a backup:
  - Theme: `shopify theme pull --path backups/<date>-pre-deploy` or equivalent snapshot.
  - Data changes: export the relevant records (CSV, JSON) to `backups/` with a timestamp prefix.
- Backups must be committed or stored locally before the deploy command runs — not after.
- Never skip this step on the grounds of time pressure.

## 5. One-Click Rollback

- Every deployment must have a documented rollback path that can be executed in a single command or a single button press:
  - Theme: keep the previous published theme ID noted; rollback = `shopify theme publish <previous-id>`.
  - Scripts / data: keep the pre-deploy backup path noted; rollback = restore from that backup.
- Record the rollback command in the `releases/` log entry for the deployment.
- Test the rollback path in staging before deploying to production.

---

## General Coding Standards

- Default branch for all new work: `claude/claud-coding-instructions-xmj8g` (or a new `claude/<name>` branch per task).
- Commit messages must be clear and in the imperative mood ("Add", "Fix", "Update").
- No credentials, API tokens, or secrets committed to the repo — use environment variables.
- Keep `backups/` and `releases/` directories up to date as a living deployment log.

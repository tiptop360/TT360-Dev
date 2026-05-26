# TipTop360 Theme Release Pipeline

This repo is the source of truth for TT360 theme releases.

## Repo roles

- `theme-files/` deployable Shopify theme source
- `scripts/theme-release.mjs` guarded Shopify CLI workflow
- `releases/` release note drafts for GitHub Releases
- `.theme-release.json` local store/theme mapping, kept out of Git

## Branch model

- `main` production-ready theme state
- `dev` integration branch for validated work
- `feature/*` one task per branch
- `hotfix/*` emergency repair path

## First-time setup

1. Confirm `.env` has `SHOPIFY_STORE` and `SHOPIFY_ACCESS_TOKEN`.
2. Confirm `.theme-release.json` has live and staging theme IDs.
3. Review remote themes:
   - `npm run theme:list`
4. Review local pipeline status:
   - `npm run theme:status`
5. Create `dev` branch after the working tree is clean:
   - `npm run gitflow:init`

## Daily workflow

1. Branch from `dev`.
2. Pull latest staging theme:
   - `npm run theme:pull:staging`
3. Implement local changes in `theme-files/`.
4. Validate:
   - `npm run theme:check`
5. Push to staging only:
   - `npm run theme:push:staging`
   - optional targeted push: `node scripts/theme-release.mjs push-staging sections/foo.liquid templates/bar.json`
6. Open preview:
   - `npm run theme:preview`
   - or `node scripts/theme-release.mjs preview products/handle`
7. Smoke test on desktop and mobile.
8. Open PR into `dev`.
9. Merge `dev` into `main` only after preview passes.
10. Generate release notes:
   - `npm run theme:release-note -- "homepage trust strip + faq schema"`
11. Create Git tag and GitHub Release from the tested `main` commit.
12. Publish staging theme:
   - `npm run theme:publish:staging`

## Hard rules

- Never push directly to the live theme during normal work.
- Never set staging theme ID equal to live theme ID.
- If a manual Shopify editor change happens, pull it back before new branch work.
- Keep one feature branch and one release note entry per task.
- Publish only the theme that was preview-tested.

## Rollback

Fastest rollback:

1. Republish the previous live theme in Shopify Admin.
2. Log the incident in the matching release note.

Controlled rollback:

1. Checkout the prior Git tag locally.
2. Push that code to staging.
3. Re-test preview.
4. Publish staging.

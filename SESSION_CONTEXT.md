# TipTop360 — Session Context (2026-05-02)

## Current State
- Branch: rabih
- Commits: 213f813 (latest)
- Phase 5 GEO: COMPLETE — 56/56 pass, 3/3 pipeline green
- llms.txt: live, 50.3KB, 130 URLs, Pydantic 100/100

## Pending Tasks (in order)
1. node optimizer.js apply meta --execute       (title + meta desc)
2. node optimizer.js apply images --execute     (fix alt text "gids" typo)
3. node optimizer.js apply sticky-atc --execute (biggest CRO win)
4. node optimizer.js apply trust --execute
5. Author schema on blogs (add-author-schema --pages=blog)
6. Microsoft Clarity install (paste script before </head> in theme.liquid)
7. FAQPage schema — not in optimizer, needs manual or API approach
8. AggregateRating — wait 24h for Judge.me propagation
9. GSC + Bing sitemap submit (manual)
10. Shopify Admin: fix title tag, meta desc, alt text "gids" on toothbrush

## Warnings from last regression
- FAQPage schema not found on toothbrush PDP
- AggregateRating not found (Judge.me lag)

## Key Files
- validators/llms_txt_validator.py
- validate-llms-txt.cjs
- regression-geo.sh
- geo-validation-loop.sh

## Run validation anytime
bash geo-validation-loop.sh --skip-ai

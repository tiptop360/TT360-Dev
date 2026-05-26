# Week 1 SEO Execution Plan

## Summary
- Working folder: `/Users/rabiharabi/tiptop360-optimizer`
- Theme source: `/Users/rabiharabi/tiptop360-optimizer/theme-files`
- Goal: complete the Week 1 SEO and GEO fixes safely, validate each step, and prepare the store for staging review
- Current blockers:
  - No GitHub `origin` remote configured yet
  - `shopify theme check --path theme-files` still needs a confirmed clean run

## Step 1: Baseline and release gate
- Confirm current branch, `git status`, and release note target
- Review `/Users/rabiharabi/tiptop360-optimizer/releases/theme-v2026-05-14-1.md`
- Confirm staging theme ID, live theme ID, and preview URL

### Validation
- Baseline captured before edits
- Release note exists and reflects current execution scope
- No unrelated changes are mixed into this task

## Step 2: Audit current SEO structure before changing anything
- Review:
  - `/Users/rabiharabi/tiptop360-optimizer/theme-files/layout/theme.liquid`
  - `/Users/rabiharabi/tiptop360-optimizer/theme-files/templates/index.json`
  - `/Users/rabiharabi/tiptop360-optimizer/theme-files/snippets/product-faq-schema.liquid`
  - `/Users/rabiharabi/tiptop360-optimizer/theme-files/snippets/lazy-image.liquid`
- Confirm what already exists:
  - Homepage H1
  - Title and canonical logic
  - Organization and WebSite schema
  - FAQ schema
  - Hero image preload
  - Lazy-loading behavior

### Validation
- Real gaps documented before edits
- No duplicate work planned for already-fixed items
- All changes tied to actual files in `theme-files`

## Step 3: Fix homepage H1 and supporting copy
- Keep exactly one homepage H1
- Refine the existing homepage H1 in `index.json` if needed to match the target SEO intent
- Align nearby homepage copy with the H1 so the page tells one clear story

### Validation
- `rg "<h1"` confirms one homepage H1 path only
- Homepage preview shows one clear primary heading
- Updated copy supports the same keyword/entity direction

## Step 4: Fix homepage FAQ schema
- Add or refine homepage-only `FAQPage` schema in `theme.liquid`
- Use only verified store facts and current policy language
- Remove any unsupported claims from the guide if they are not backed by the store

### Validation
- JSON-LD is valid
- Only intended FAQ schema appears on homepage
- Rich Results/schema check passes
- FAQ answers match visible store messaging or verified policy

## Step 5: Strengthen Organization and entity schema
- Improve the existing `@graph` in `theme.liquid`
- Verify:
  - Brand name
  - Legal name
  - Logo URL
  - Social links
  - Phone
  - Language
  - UAE address details
  - Site description
- Use `NAP_SUBMISSIONS.md` as a supporting source for consistency

### Validation
- One clean `Organization` node remains
- One clean `WebSite` node remains
- Brand entity details are consistent across schema and site copy
- No duplicate organization scripts are introduced

## Step 6: Improve GEO content on priority surfaces
- Add or refine fact-first, quotable copy where needed
- Prioritize homepage first, then any directly impacted PDP or collection surfaces
- Make sure FAQ answers, schema, and visible copy all say the same thing
- Keep UAE, AED, delivery, and support claims consistent and verified

### Validation
- Each updated page has clear fact-based language
- No invented claims, reviews, or certifications
- On-page content and schema agree
- Copy is easy to quote and easy to verify

## Step 7: Fix image loading and performance details
- Verify homepage preload targets the actual LCP image
- Review reusable image output in `lazy-image.liquid`
- Ensure below-the-fold images use lazy loading
- Ensure changed image markup includes width and height values to reduce CLS

### Validation
- LCP preload matches the real hero/LCP image
- Changed image markup includes dimensions
- Lazy loading is not applied to critical above-the-fold LCP content
- No obvious CLS or loading regression in preview

## Step 8: Run static validation
- Run `shopify theme check --path theme-files`
- Re-run until clean or until only explicitly accepted warnings remain
- Run targeted repo checks for H1 count, schema presence, canonical logic, and image markup

### Validation
- Theme check completes successfully
- No unresolved blocking errors remain
- Repo search confirms intended SEO structure is present

## Step 9: Run preview validation on staging theme
- Preview the staging theme on desktop
- Preview the staging theme on mobile
- Check homepage, one priority PDP, and one priority collection

### Validation
- H1 renders correctly
- Canonical tag is correct
- Meta description is present
- Schema appears in source as expected
- Images load correctly and layout remains stable
- No visible UX regression on tested surfaces

## Step 10: Unblock GitHub release flow
- Add the missing GitHub `origin` remote to the repo
- Confirm branch push, PR flow, and release flow are ready for later ship steps

### Validation
- `git remote -v` shows `origin`
- PR/release workflow is no longer blocked
- Repo is ready for proper handoff and review

## Step 11: Prepare ship-ready handoff without publishing live
- Update the release note and validation checklist
- Record what changed, what passed, and what still needs follow-up
- Stop at staging-ready unless live publish is explicitly requested later

### Validation
- Release note reflects actual completed work
- Validation results are documented
- No live publish occurs in this pass
- Remaining risks or open items are listed clearly

## Final acceptance criteria
- One homepage H1 only
- Homepage FAQ schema valid and grounded in real store facts
- Organization/WebSite schema is clean, consistent, and non-duplicated
- Priority GEO copy is fact-first and quote-friendly
- Image loading changes do not introduce CLS or LCP regressions
- `shopify theme check --path theme-files` completes cleanly
- Staging preview passes desktop and mobile smoke checks
- GitHub remote and release flow are unblocked for next steps

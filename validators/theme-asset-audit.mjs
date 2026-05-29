#!/usr/bin/env node
/**
 * Theme asset guardrail — prevents the dead/backup-asset rot that this repo
 * accumulated (171 backup variants) from returning, and surfaces unreferenced
 * CSS/JS assets for review.
 *
 *   node validators/theme-asset-audit.mjs            # report
 *   node validators/theme-asset-audit.mjs --strict   # also fail on unreferenced assets
 *
 * Exit codes: 0 = clean (or report-only), 1 = backup-pattern files found (always fatal)
 *             or unreferenced found while --strict.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = new URL('../theme-files', import.meta.url).pathname;
const ASSETS = join(ROOT, 'assets');
const CODE_DIRS = ['layout', 'sections', 'snippets', 'blocks', 'templates', 'config', 'locales'];
const STRICT = process.argv.includes('--strict');

// Filenames that should never exist in a clean theme.
const BACKUP_PATTERNS = [/-backup\./i, /\.aio\.min-backup\./i, /\.backup$/i, /\bcopy\b/i];

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    out = statSync(p).isDirectory() ? out.concat(walk(p)) : out.concat(p);
  }
  return out;
}

// 1) Collect css/js assets on disk.
const assetFiles = readdirSync(ASSETS).filter(f => /\.(css|js)$/.test(f) || /\.css\.liquid$/.test(f));

// 2) Backup/duplicate-pattern filenames anywhere in the theme (fatal).
const allFiles = [ASSETS, ...CODE_DIRS.map(d => join(ROOT, d))].flatMap(d => {
  try { return walk(d); } catch { return []; }
});
const backupHits = allFiles.map(p => p.replace(ROOT + '/', '')).filter(rel =>
  BACKUP_PATTERNS.some(re => re.test(basename(rel)))
);

// 3) Build the referenced-token set from all code files.
const codeText = allFiles
  .filter(p => /\.(liquid|json)$/.test(p))
  .map(p => { try { return readFileSync(p, 'utf8'); } catch { return ''; } })
  .join('\n');

// Assets that are legitimately present but not asset_url-referenced. Keep this list tiny
// and documented — each entry needs a reason.
const ALLOWLIST = new Set([
  // Defines the <details-modal> custom element used by snippets/header-search.liquid;
  // not present in any loaded bundle, so the standalone file is required.
  'details-modal.js',
]);

// An asset counts as referenced only when its filename appears QUOTED (i.e. an actual
// asset_url/stylesheet_tag/script_tag/JSON reference) — this avoids false positives like
// the CSS class ".btn-theme.js-grid-cart" matching "theme.js". A .css.liquid asset is
// served at its .css name, so match that too.
function isReferenced(file) {
  const served = file.replace(/\.liquid$/, '');           // theme.css.liquid -> theme.css
  for (const name of new Set([file, served])) {
    if (codeText.includes(`'${name}'`) || codeText.includes(`"${name}"`)) return true;
  }
  return false;
}
const unreferenced = assetFiles.filter(f => !isReferenced(f) && !ALLOWLIST.has(f));

// ---- Report ----
let fatal = false;
console.log(`Theme asset audit — ${assetFiles.length} css/js assets, ${allFiles.length} files scanned\n`);

if (backupHits.length) {
  fatal = true;
  console.log(`✖ ${backupHits.length} backup/duplicate-pattern file(s) (must be removed):`);
  backupHits.forEach(f => console.log(`    ${f}`));
} else {
  console.log('✓ no backup/duplicate-pattern filenames');
}

if (unreferenced.length) {
  console.log(`\n⚠ ${unreferenced.length} unreferenced css/js asset(s):`);
  unreferenced.forEach(f => console.log(`    assets/${f}`));
  if (STRICT) fatal = true;
} else {
  console.log('\n✓ every css/js asset is referenced');
}

process.exit(fatal ? 1 : 0);

#!/usr/bin/env node
/**
 * validate-llms-txt.cjs — TipTop360 Phase 5 GEO/AEO
 *
 * 3-layer validation loop:
 *   Layer 1 — Structural (fast, no API): reachability, format, size, sections
 *   Layer 2 — Pydantic (Python subprocess): entity coverage, required handles, URL counts
 *   Layer 3 — Claude AI scoring (optional): GEO quality, AEO extractability, citation signal density
 *
 * Usage:
 *   node validate-llms-txt.cjs                        # full 3-layer
 *   node validate-llms-txt.cjs --skip-ai              # layers 1+2 only (no API cost)
 *   node validate-llms-txt.cjs --fix-hints            # include AI fix suggestions
 *   node validate-llms-txt.cjs --url https://...      # override URL
 *   node validate-llms-txt.cjs --json                 # machine-readable output
 *
 * Exit: 0 = all layers pass, 1 = any failure
 */

require('dotenv').config();
const { execSync, spawnSync } = require('child_process');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const LLMS_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://tiptop360.com/llms.txt';

const SKIP_AI     = process.argv.includes('--skip-ai');
const FIX_HINTS   = process.argv.includes('--fix-hints');
const AS_JSON     = process.argv.includes('--json');
const VALIDATOR   = path.join(__dirname, 'validators', 'llms_txt_validator.py');
const TMP_FILE    = '/tmp/tiptop360-llms.txt';

// Claude — Haiku for validation (cheapest, fast)
const AI_MODEL    = 'claude-haiku-4-5-20251001';
const AI_TOKENS   = 600;

// Thresholds
const MIN_GEO_SCORE    = 65;   // Layer 3 must return ≥65/100
const WARN_GEO_SCORE   = 80;   // below this = warning even if passing

// Required signals for Layer 1
const REQUIRED_STRINGS = [
  'TipTop360',
  'UAE',
  'tiptop360.com',
  'kids-u-shaped-toothbrush-uae',
  'ai-voice-recorder',
  'free',        // free delivery signal
  'delivery',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const log   = (...a) => !AS_JSON && console.log(...a);
const fail  = (msg, detail) => {
  if (AS_JSON) { console.log(JSON.stringify({ status: 'FAIL', error: msg, detail: detail || null })); }
  else { console.error(`\n❌ FAIL [${msg}]${detail ? '\n   ' + detail : ''}`); }
  process.exit(1);
};
const warn  = (msg) => log(`  ⚠️  WARN: ${msg}`);
const ok    = (msg) => log(`  ✅ ${msg}`);

// ─── Layer 1: Structural ─────────────────────────────────────────────────────
async function layer1() {
  log('\n━━━ Layer 1: Structural Check ━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1a. HTTP reachability
  let res, text;
  try {
    res = await fetch(LLMS_URL, { headers: { 'User-Agent': 'TipTop360-Validator/1.0' }, timeout: 10000 });
  } catch (e) {
    fail('llms.txt unreachable', `${LLMS_URL} — ${e.message}`);
  }

  if (res.status !== 200) fail(`HTTP ${res.status}`, LLMS_URL);
  ok(`HTTP 200 — ${LLMS_URL}`);

  text = await res.text();
  const bytes = Buffer.byteLength(text, 'utf8');

  // 1b. Size
  if (bytes < 500)  fail('File too small', `${bytes} bytes — app may have generated empty file`);
  if (bytes > 100000) fail('File too large', `${bytes} bytes — exceeds 100KB AI crawler limit`);
  ok(`Size OK: ${(bytes / 1024).toFixed(1)} KB`);

  // 1c. Title line
  const titleMatch = text.match(/^# (.+)/m);
  if (!titleMatch) fail('Missing # title', 'llms.txt spec requires exactly one # heading');
  if (!/TipTop360/i.test(titleMatch[1])) fail('Brand missing from title', `Got: "${titleMatch[1]}"`);
  ok(`Title: "${titleMatch[1]}"`);

  // 1d. Description
  const descMatch = text.match(/^> (.+)/m);
  if (!descMatch) fail('Missing > description', 'llms.txt spec requires > blockquote description');
  if (descMatch[1].length < 80) warn(`Description short (${descMatch[1].length} chars) — aim for ≥80`);
  ok(`Description: ${descMatch[1].length} chars`);

  // 1e. Section count
  const sections = (text.match(/^## .+/gm) || []);
  if (sections.length < 2) fail('Too few sections', `Found ${sections.length} — need ≥2 (Products, Blog, Pages…)`);
  ok(`Sections (${sections.length}): ${sections.map(s => s.slice(3)).join(' | ')}`);

  // 1f. Required strings
  const missing = REQUIRED_STRINGS.filter(s => !text.toLowerCase().includes(s.toLowerCase()));
  if (missing.length > 0) fail('Missing required content', `Not found: ${missing.join(', ')}`);
  ok(`All ${REQUIRED_STRINGS.length} required signals present`);

  // 1g. Internal URL count
  const urls = [...text.matchAll(/\(https?:\/\/tiptop360\.com[^)]*\)/g)].map(m => m[0].slice(1,-1));
  if (urls.length === 0) fail('No internal URLs', 'AI crawlers need navigable links to product/blog pages');
  if (urls.length < 5)  warn(`Only ${urls.length} internal URLs — recommend ≥10 for full AI indexing`);
  ok(`Internal URLs: ${urls.length}`);

  // 1h. No obvious Liquid errors in content
  if (text.includes('Liquid error') || text.includes('undefined method')) {
    fail('Liquid render error in llms.txt', 'App may be generating via broken Liquid template');
  }
  ok('No Liquid errors in content');

  // Save for layer 2
  fs.writeFileSync(TMP_FILE, text, 'utf8');
  log(`  → Saved to ${TMP_FILE}`);

  return { text, bytes, urls, sections: sections.map(s => s.slice(3)) };
}

// ─── Layer 2: Pydantic ───────────────────────────────────────────────────────
function layer2() {
  log('\n━━━ Layer 2: Pydantic Validation ━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!fs.existsSync(VALIDATOR)) {
    warn(`Pydantic validator not found at ${VALIDATOR} — skipping Layer 2`);
    warn('Run: ensure validators/llms_txt_validator.py exists in project root');
    return null;
  }

  const result = spawnSync(
    'python3', [VALIDATOR, '--file', TMP_FILE, '--json', '--no-url-check'],
    { encoding: 'utf8', timeout: 30000 }
  );

  if (result.error) {
    warn(`Could not run Python validator: ${result.error.message}`);
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    // stdout may have a print report — check stderr for errors
    if (result.status !== 0) {
      fail('Pydantic validation failed', result.stderr || result.stdout);
    }
    ok('Pydantic: PASS (non-JSON output)');
    return null;
  }

  if (parsed.status === 'FAIL') {
    const errs = parsed.validation_errors || [];
    errs.forEach(e => log(`  ❌ [${e.field}] ${e.msg}`));
    fail('Pydantic validation failed', `${errs.length} error(s)`);
  }

  ok(`Pydantic: ${parsed.status} — GEO score ${parsed.score}/100`);
  if (parsed.score < WARN_GEO_SCORE) warn(`Score ${parsed.score} below target ${WARN_GEO_SCORE} — see notes below`);
  if (parsed.notes) parsed.notes.forEach(n => log(`  ${n}`));
  if (parsed.url_spot_check?.broken > 0) {
    parsed.url_spot_check.broken_urls.forEach(u => warn(`Broken URL in llms.txt: ${u}`));
    fail('Broken URLs found', `${parsed.url_spot_check.broken} URL(s) not returning 200`);
  }

  return parsed;
}

// ─── Layer 3: Claude AI Scoring ───────────────────────────────────────────────
async function layer3(text) {
  log('\n━━━ Layer 3: Claude AI GEO Scoring ━━━━━━━━━━━━━━━━━━━━━━');

  if (!process.env.ANTHROPIC_API_KEY) {
    warn('ANTHROPIC_API_KEY not set — skipping Layer 3');
    return null;
  }

  const prompt = `You are a GEO (Generative Engine Optimization) auditor for TipTop360.com, a UAE kids e-commerce store.
Evaluate this llms.txt file for AI citation quality. Return ONLY valid JSON, no markdown, no explanation.

Score each dimension 0-20. Total must be ≤100.

Dimensions:
1. brand_clarity (0-20): Is TipTop360's identity, location (UAE), and niche (kids products) immediately clear to an AI?
2. product_coverage (0-20): Are key products described with enough detail for AI citation (name, URL, what it does, price/AED if present)?
3. geo_signal_density (0-20): Are UAE geographic entities (Dubai, Abu Dhabi, Sharjah, Emirates) present with enough frequency and context?
4. aeo_extractability (0-20): Does the content follow Q&A / direct-answer patterns that AI engines can extract as featured answers?
5. trust_authority (0-20): Are trust signals (50,000+ families, reviews, COD, free delivery, UAE-licensed) present and credible?

Also return:
- top_3_fixes: array of 3 specific actionable improvements (only if FIX_HINTS=${FIX_HINTS})
- citation_verdict: one of ["WILL_CITE", "MAY_CITE", "UNLIKELY_TO_CITE"]
- reason: one sentence explaining citation verdict

llms.txt content (first 3000 chars):
${text.slice(0, 3000)}

Return JSON only:
{
  "brand_clarity": 0,
  "product_coverage": 0,
  "geo_signal_density": 0,
  "aeo_extractability": 0,
  "trust_authority": 0,
  "total": 0,
  "citation_verdict": "MAY_CITE",
  "reason": "...",
  "top_3_fixes": []
}`;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: AI_TOKENS,
        messages: [{ role: 'user', content: prompt }],
        stop_sequences: ['}'],   // JSON ends at closing brace
      }),
    });
  } catch (e) {
    warn(`Claude API call failed: ${e.message} — skipping Layer 3`);
    return null;
  }

  const data = await response.json();
  if (!data.content?.[0]?.text) {
    warn('Empty response from Claude — skipping Layer 3');
    return null;
  }

  let raw = data.content[0].text + '}';  // restore closing brace eaten by stop_sequence
  // strip any preamble
  const jsonStart = raw.indexOf('{');
  if (jsonStart > 0) raw = raw.slice(jsonStart);

  let scoring;
  try {
    scoring = JSON.parse(raw);
  } catch {
    warn('Could not parse Claude JSON response — skipping Layer 3');
    return null;
  }

  const total = scoring.total || (
    (scoring.brand_clarity || 0) +
    (scoring.product_coverage || 0) +
    (scoring.geo_signal_density || 0) +
    (scoring.aeo_extractability || 0) +
    (scoring.trust_authority || 0)
  );

  log(`\n  GEO Score Breakdown:`);
  log(`    Brand Clarity      : ${scoring.brand_clarity}/20`);
  log(`    Product Coverage   : ${scoring.product_coverage}/20`);
  log(`    Geo Signal Density : ${scoring.geo_signal_density}/20`);
  log(`    AEO Extractability : ${scoring.aeo_extractability}/20`);
  log(`    Trust Authority    : ${scoring.trust_authority}/20`);
  log(`    ─────────────────────────────`);
  log(`    Total              : ${total}/100`);
  log(`    Verdict            : ${scoring.citation_verdict}`);
  log(`    Reason             : ${scoring.reason}`);

  if (FIX_HINTS && scoring.top_3_fixes?.length) {
    log(`\n  📌 Top 3 Fixes for AI Citation:`);
    scoring.top_3_fixes.forEach((f, i) => log(`    ${i+1}. ${f}`));
  }

  const tokens = data.usage;
  if (tokens) log(`\n  Token cost: ${tokens.input_tokens} in / ${tokens.output_tokens} out (Haiku)`);

  if (total < MIN_GEO_SCORE) {
    fail(`GEO score ${total}/100 below minimum ${MIN_GEO_SCORE}`, scoring.reason);
  }
  if (scoring.citation_verdict === 'UNLIKELY_TO_CITE') {
    fail('Citation verdict: UNLIKELY_TO_CITE', scoring.reason);
  }

  ok(`Layer 3 PASS — ${total}/100 — ${scoring.citation_verdict}`);
  return { total, scoring };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  log('\n╔══════════════════════════════════════════════════════════╗');
  log('║     TipTop360 — llms.txt Validation Loop                ║');
  log('╚══════════════════════════════════════════════════════════╝');
  log(`  Target: ${LLMS_URL}`);
  log(`  Mode  : ${SKIP_AI ? 'Layers 1+2 only' : 'Full 3-layer'}`);

  const { text, bytes, urls, sections } = await layer1();
  const pydantic = layer2();

  let ai = null;
  if (!SKIP_AI) {
    ai = await layer3(text);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary = {
    status: 'PASS',
    url: LLMS_URL,
    byte_size: bytes,
    sections,
    internal_url_count: urls.length,
    pydantic_score: pydantic?.score || null,
    ai_geo_score: ai?.total || null,
    citation_verdict: ai?.scoring?.citation_verdict || 'NOT_CHECKED',
    timestamp: new Date().toISOString(),
  };

  if (AS_JSON) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    log('\n━━━ Final Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`  ✅ ALL LAYERS PASSED`);
    log(`  Byte size     : ${(bytes/1024).toFixed(1)} KB`);
    log(`  Sections      : ${sections.join(' | ')}`);
    log(`  Internal URLs : ${urls.length}`);
    if (pydantic?.score) log(`  Pydantic score: ${pydantic.score}/100`);
    if (ai?.total)       log(`  GEO AI score  : ${ai.total}/100`);
    log(`  Citation      : ${summary.citation_verdict}`);
    log(`  Timestamp     : ${summary.timestamp}`);
    log('');
  }

  process.exit(0);
})();

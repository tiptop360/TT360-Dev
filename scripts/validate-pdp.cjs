#!/usr/bin/env node
/*
 * validate-pdp.cjs — source validation for the bespoke TipTop360 PDPs.
 * Checks the two product templates + sections for: valid JSON templates with
 * the recommendations section wired, balanced Liquid tags, valid JSON-LD
 * (FAQPage = Question/Answer objects, never raw HTML), valid {% schema %} JSON,
 * and the content-integrity rules from CLAUDE.md (no unconfirmed claims).
 * Exit 0 = clean, 1 = problems found. Safe to run anytime / in CI / the hook.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SECTIONS = ['theme-files/sections/gymbag-pdp.liquid', 'theme-files/sections/aivox-pdp.liquid'];
const TEMPLATES = ['theme-files/templates/product.gymbag.json', 'theme-files/templates/product.aivox.json'];

// Claims that are not confirmed true and must never ship (UAE consumer law + ad policy).
const BANNED = [
  /weatherproof/i, /waterproof/i,
  /no questions asked/i, /for any reason/i, /risk-?free/i,
  /\btabby\b/i, /\btamara\b/i, /installments?/i, /pay in 4/i, /pay later/i, /postpay/i,
];

let fails = 0;
const pass = m => console.log('  PASS  ' + m);
const fail = m => { fails++; console.log('  FAIL  ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1. Product templates: valid JSON + recommendations section wired.
for (const f of TEMPLATES) {
  try {
    const j = JSON.parse(read(f));
    const rec = j.sections && j.sections.recommendations;
    if (rec && rec.type === 'product-recommendations' && (j.order || []).includes('recommendations')) pass(`${f}: valid JSON + recommendations wired`);
    else fail(`${f}: recommendations section not wired`);
  } catch (e) { fail(`${f}: JSON parse error -> ${e.message}`); }
}

// helper: strip Liquid + dangling commas so embedded JSON-LD can be parsed.
const liquidSafe = b => b
  .replace(/\{\{[\s\S]*?\}\}/g, '1')
  .replace(/\{%-?[\s\S]*?-?%\}/g, '')
  .replace(/,(\s*[\]}])/g, '$1');

for (const f of SECTIONS) {
  const s = read(f);
  const c = re => (s.match(re) || []).length;

  // 2. Balanced Liquid control tags.
  c(/\{%-?\s*if\b/g) === c(/\{%-?\s*endif\s*-?%\}/g) ? pass(`${f}: if/endif balanced`) : fail(`${f}: if/endif unbalanced`);
  c(/\{%-?\s*for\b/g) === c(/\{%-?\s*endfor\s*-?%\}/g) ? pass(`${f}: for/endfor balanced`) : fail(`${f}: for/endfor unbalanced`);
  for (const [o, cl] of [['{%- comment -%}', '{%- endcomment -%}'], ['{% schema %}', '{% endschema %}']]) {
    (s.split(o).length - 1) === (s.split(cl).length - 1) ? pass(`${f}: ${o} balanced`) : fail(`${f}: ${o} unbalanced`);
  }

  // 3. JSON-LD blocks: valid JSON, FAQPage uses Question objects (no raw HTML).
  const ld = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  ld.forEach((block, i) => {
    if (block.includes('<div') || block.includes('<span')) { fail(`${f}: ld+json[${i}] contains raw HTML`); return; }
    try {
      const parsed = JSON.parse(liquidSafe(block));
      const graph = parsed['@graph'] || [parsed];
      const faq = graph.find(n => n['@type'] === 'FAQPage');
      if (faq) {
        const okQ = Array.isArray(faq.mainEntity) && faq.mainEntity.every(q => q['@type'] === 'Question' && q.acceptedAnswer && q.acceptedAnswer.text);
        okQ ? pass(`${f}: ld+json[${i}] FAQPage valid (${faq.mainEntity.length} questions)`) : fail(`${f}: ld+json[${i}] FAQPage malformed`);
      } else pass(`${f}: ld+json[${i}] valid JSON`);
    } catch (e) { fail(`${f}: ld+json[${i}] invalid JSON -> ${e.message}`); }
  });

  // 4. {% schema %} block parses as JSON.
  const sch = s.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (sch) { try { JSON.parse(sch[1]); pass(`${f}: {% schema %} valid JSON`); } catch (e) { fail(`${f}: {% schema %} invalid JSON -> ${e.message}`); } }

  // 5. Content integrity — no unconfirmed claims anywhere in the file.
  const hits = BANNED.filter(re => re.test(s)).map(re => re.source);
  hits.length ? fail(`${f}: banned claim(s) present -> ${hits.join(', ')}`) : pass(`${f}: content integrity clean`);
}

console.log(`\n${fails === 0 ? 'PDP VALIDATION PASSED' : fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);

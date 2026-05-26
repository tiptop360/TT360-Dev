'use strict';
/**
 * TipTop360 — Full Sales Funnel Test + RFM Segmentation
 * Branch: claude/sales-funnel-test-RFM7p
 *
 * Stages:
 *   1. Funnel Page Health  (HTTP checks on key URLs)
 *   2. Conversion Metrics  (ShopifyQL: sessions → cart → checkout → order)
 *   3. Product Performance (top 10 by gross sales)
 *   4. RFM Segmentation    (all customers with ≥1 order, 1-5 scoring per axis)
 *   5. Klaviyo Flow Audit  (live vs draft vs broken)
 *
 * Usage:
 *   KLAVIYO_PRIVATE_KEY=pk_xxx node sales-funnel-test.cjs [--json]
 *
 * Env vars required: SHOPIFY_STORE + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
 *                    (or SHOPIFY_ACCESS_TOKEN for token-based auth)
 *                    Optional: KLAVIYO_PRIVATE_KEY
 */

require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const fs = require('fs');

const STORE = process.env.SHOPIFY_STORE || 'zrhgzw-xt.myshopify.com';
const JSON_MODE = process.argv.includes('--json');
const TODAY = new Date();
const REPORT_DATE = TODAY.toISOString().slice(0, 10);

// ─── Thresholds ──────────────────────────────────────────────────────────────
const BENCHMARKS = {
  addToCartRate:      { warn: 0.03, fail: 0.01 },  // 3% industry avg, <1% critical
  checkoutRate:       { warn: 0.50, fail: 0.20 },  // of sessions with cart
  completionRate:     { warn: 0.60, fail: 0.30 },  // of sessions that reached checkout
  overallCVR:         { warn: 0.01, fail: 0.005 }, // 1% industry min, <0.5% critical
  returningCustRate:  { warn: 0.15, fail: 0.05 },  // 15% healthy, <5% critical
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getShopifyToken() {
  if (process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN;
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) throw new Error(`Shopify auth failed: ${r.status}`);
  return (await r.json()).access_token;
}

async function shopifyGraphQL(token, query, variables = {}) {
  const r = await fetch(`https://${STORE}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rate(n, d) { return d > 0 ? n / d : 0; }
function pct(n, d) { return d > 0 ? ((n / d) * 100).toFixed(1) + '%' : 'n/a'; }
function fmtAED(n) { return 'AED ' + Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0 }); }
function daysSince(dateStr) {
  return Math.floor((TODAY - new Date(dateStr)) / 86400000);
}

function status(value, bench) {
  if (value >= bench.warn) return '✅';
  if (value >= bench.fail) return '⚠️ ';
  return '❌';
}

// ─── Stage 1: Funnel Page Health ──────────────────────────────────────────────
const KEY_PAGES = [
  { label: 'Homepage',          url: 'https://tiptop360.com/' },
  { label: 'Collection: Kids',  url: 'https://tiptop360.com/collections/kids' },
  { label: 'PDP: Toothbrush',   url: 'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift' },
  { label: 'PDP: Gym Bag',      url: 'https://tiptop360.com/products/magnetic-hands-free-gym-bag' },
  { label: 'PDP: Drawing Robot',url: 'https://tiptop360.com/products/kids-stem-drawing-robot' },
  { label: 'Cart',              url: 'https://tiptop360.com/cart' },
  { label: 'Sitemap',           url: 'https://tiptop360.com/sitemap.xml' },
  { label: 'Robots.txt',        url: 'https://tiptop360.com/robots.txt' },
];

async function checkPageHealth() {
  const results = [];
  for (const page of KEY_PAGES) {
    try {
      const cb = `?x=${Date.now()}`;
      const r = await fetch(page.url + cb, { redirect: 'follow', timeout: 10000 });
      const body = await r.text();
      const ok = r.ok;
      const issues = [];
      if (body.includes('Liquid error')) issues.push('Liquid error in response');
      if (body.includes('githubfix')) issues.push('MALWARE: githubfix snippet');
      if (page.label === 'Homepage' && (body.match(/<h1\b/gi) || []).length !== 1)
        issues.push(`H1 count = ${(body.match(/<h1\b/gi) || []).length} (expected 1)`);
      results.push({ label: page.label, url: page.url, status: ok ? 'ok' : 'error', httpStatus: r.status, issues });
    } catch (e) {
      results.push({ label: page.label, url: page.url, status: 'unreachable', httpStatus: 0, issues: [e.message] });
    }
  }
  return results;
}

// ─── Stage 2: Conversion Funnel (ShopifyQL via REST Analytics API) ─────────────
async function fetchShopifyQL(token, query) {
  const r = await fetch(`https://${STORE}/admin/api/2024-10/reports/shopifyql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`ShopifyQL error ${r.status}: ${err}`);
  }
  return r.json();
}

async function getConversionFunnel(token) {
  const sessionQ = `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout, conversion_rate SINCE -30d UNTIL today`;
  const data = await fetchShopifyQL(token, sessionQ);
  const rows = data?.result?.data?.rows || [];

  let totalSessions = 0, totalCart = 0, totalCheckout = 0, totalCompleted = 0;
  let zeroDays = 0;
  for (const row of rows) {
    totalSessions  += Number(row[0]) || 0;
    totalCart      += Number(row[1]) || 0;
    totalCheckout  += Number(row[2]) || 0;
    totalCompleted += Number(row[3]) || 0;
    if ((Number(row[3]) || 0) === 0) zeroDays++;
  }
  return { totalSessions, totalCart, totalCheckout, totalCompleted, zeroDays, days: rows.length };
}

// ─── Stage 3: Product Performance ─────────────────────────────────────────────
async function getProductPerformance(token) {
  const q = `FROM sales SHOW gross_sales, net_sales, orders GROUP BY product_title ORDER BY gross_sales DESC LIMIT 10`;
  const data = await fetchShopifyQL(token, q);
  const rows = data?.result?.data?.rows || [];
  return rows.map(r => ({
    title:       r[0],
    grossSales:  Number(r[1]) || 0,
    netSales:    Number(r[2]) || 0,
    orders:      Number(r[3]) || 0,
  }));
}

// ─── Stage 4: RFM Segmentation ────────────────────────────────────────────────
async function fetchAllCustomersWithOrders(token) {
  const customers = [];
  let cursor = null;

  do {
    const query = `
      query ($after: String) {
        customers(first: 250, after: $after, query: "orders_count:>=1") {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              firstName lastName email
              ordersCount
              totalSpentV2 { amount }
              lastOrder { createdAt }
              createdAt
            }
          }
        }
      }`;
    const res = await shopifyGraphQL(token, query, { after: cursor });
    const conn = res?.data?.customers;
    if (!conn) break;
    for (const { node } of conn.edges) {
      customers.push({
        id:          node.id,
        name:        [node.firstName, node.lastName].filter(Boolean).join(' ') || 'Unknown',
        email:       node.email || '',
        orders:      node.ordersCount || 0,
        totalSpent:  parseFloat(node.totalSpentV2?.amount || 0),
        lastOrderAt: node.lastOrder?.createdAt || node.createdAt,
        joinedAt:    node.createdAt,
      });
    }
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    if (cursor) await new Promise(r => setTimeout(r, 500));
  } while (cursor);

  return customers;
}

function scoreR(daysSinceLast) {
  if (daysSinceLast <=  30) return 5;
  if (daysSinceLast <=  60) return 4;
  if (daysSinceLast <=  90) return 3;
  if (daysSinceLast <= 180) return 2;
  return 1;
}
function scoreF(orders) {
  if (orders >= 10) return 5;
  if (orders >=  5) return 4;
  if (orders >=  3) return 3;
  if (orders >=  2) return 2;
  return 1;
}
function scoreM(spent) {
  if (spent >= 1000) return 5;
  if (spent >=  500) return 4;
  if (spent >=  250) return 3;
  if (spent >=  100) return 2;
  return 1;
}

function rfmSegment(r, f, m) {
  const avg = (r + f + m) / 3;
  if (r >= 4 && f >= 4 && m >= 4)          return 'Champion';
  if (f >= 3 && m >= 3)                     return 'Loyal';
  if (r >= 3 && f <= 2)                     return 'Potential Loyalist';
  if (r === 5 && f === 1)                   return 'New Customer';
  if (r <= 2 && m >= 3)                     return 'At Risk';
  if (r <= 2 && f >= 3)                     return "Can't Lose";
  if (avg <= 2)                             return 'Hibernating';
  return 'Needs Attention';
}

function computeRFM(customers) {
  const scored = customers.map(c => {
    const recency = daysSince(c.lastOrderAt);
    const R = scoreR(recency);
    const F = scoreF(c.orders);
    const M = scoreM(c.totalSpent);
    return { ...c, recency, R, F, M, rfmScore: R * 100 + F * 10 + M, segment: rfmSegment(R, F, M) };
  });

  scored.sort((a, b) => b.rfmScore - a.rfmScore);

  const segments = {};
  for (const c of scored) {
    segments[c.segment] = (segments[c.segment] || 0) + 1;
  }

  const totalCustomers = scored.length;
  const avgRecency    = Math.round(scored.reduce((s, c) => s + c.recency, 0) / totalCustomers);
  const avgOrders     = +(scored.reduce((s, c) => s + c.orders, 0) / totalCustomers).toFixed(1);
  const avgLTV        = +(scored.reduce((s, c) => s + c.totalSpent, 0) / totalCustomers).toFixed(0);
  const top10         = scored.slice(0, 10);

  return { scored, segments, totalCustomers, avgRecency, avgOrders, avgLTV, top10 };
}

// ─── Stage 5: Klaviyo Flow Audit ──────────────────────────────────────────────
async function auditKlaviyoFlows() {
  const key = process.env.KLAVIYO_PRIVATE_KEY;
  if (!key) return { skipped: true, reason: 'KLAVIYO_PRIVATE_KEY not set' };

  const r = await fetch('https://a.klaviyo.com/api/flows?fields[flow]=name,status,trigger_type&page[size]=50', {
    headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: '2024-10-15' },
  });
  if (!r.ok) return { skipped: true, reason: `Klaviyo API error ${r.status}` };
  const data = await r.json();
  const flows = (data.data || []).map(f => ({
    id:     f.id,
    name:   f.attributes.name,
    status: f.attributes.status,
    trigger: f.attributes.trigger_type,
  }));

  const live  = flows.filter(f => f.status === 'live');
  const draft = flows.filter(f => f.status === 'draft');

  // Critical flow coverage check
  const criticalFlows = [
    'welcome',
    'abandoned cart',
    'abandoned checkout',
    'browse abandonment',
    'winback',
    'thank you',
  ];
  const liveNames = live.map(f => f.name.toLowerCase());
  const missing = criticalFlows.filter(cf => !liveNames.some(n => n.includes(cf)));

  return { flows, live: live.length, draft: draft.length, missing, skipped: false };
}

// ─── Reporting ────────────────────────────────────────────────────────────────
function printHeader(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printCheck(label, ok, detail = '') {
  const icon = ok === true ? '✅' : ok === false ? '❌' : '⚠️ ';
  console.log(`  ${icon} ${label}${detail ? '  → ' + detail : ''}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const report = {
    generatedAt: new Date().toISOString(),
    store: STORE,
    stages: {},
  };

  console.log(`\n🏪 TipTop360 Full Sales Funnel Test — ${REPORT_DATE}`);
  console.log(`   Store: ${STORE}\n`);

  // ── Auth ──
  let token;
  try {
    token = await getShopifyToken();
  } catch (e) {
    console.error('❌ Shopify auth failed:', e.message);
    console.error('   Set SHOPIFY_ACCESS_TOKEN or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET in .env');
    process.exit(1);
  }

  // ── Stage 1: Page Health ──
  printHeader('STAGE 1 — Funnel Page Health');
  let pageResults;
  try {
    pageResults = await checkPageHealth();
    report.stages.pageHealth = pageResults;
    for (const p of pageResults) {
      const ok = p.status === 'ok' && p.issues.length === 0;
      const warn = p.status === 'ok' && p.issues.length > 0;
      printCheck(p.label, ok ? true : warn ? null : false,
        p.issues.length ? p.issues.join('; ') : `HTTP ${p.httpStatus}`);
    }
  } catch (e) {
    console.log('  ⚠️  Page health check failed:', e.message);
  }

  // ── Stage 2: Conversion Funnel ──
  printHeader('STAGE 2 — Conversion Funnel (Last 30 Days)');
  let funnel;
  try {
    funnel = await getConversionFunnel(token);
    report.stages.conversionFunnel = funnel;

    const atcRate       = rate(funnel.totalCart, funnel.totalSessions);
    const checkoutRate  = rate(funnel.totalCheckout, funnel.totalCart);
    const completionRate= rate(funnel.totalCompleted, funnel.totalCheckout);
    const overallCVR    = rate(funnel.totalCompleted, funnel.totalSessions);

    console.log(`\n  Sessions         : ${funnel.totalSessions.toLocaleString()}`);
    console.log(`  → Add to Cart    : ${funnel.totalCart}  (${pct(funnel.totalCart, funnel.totalSessions)}) ${status(atcRate, BENCHMARKS.addToCartRate)}`);
    console.log(`  → Reached Chkout : ${funnel.totalCheckout}  (${pct(funnel.totalCheckout, funnel.totalCart)} of cart) ${status(checkoutRate, BENCHMARKS.checkoutRate)}`);
    console.log(`  → Completed      : ${funnel.totalCompleted}  (${pct(funnel.totalCompleted, funnel.totalCheckout)} of checkout) ${status(completionRate, BENCHMARKS.completionRate)}`);
    console.log(`\n  Overall CVR      : ${(overallCVR * 100).toFixed(3)}%  ${status(overallCVR, BENCHMARKS.overallCVR)}`);
    console.log(`  Days with 0 conv : ${funnel.zeroDays}/${funnel.days}`);

    if (funnel.zeroDays > 7) {
      console.log(`\n  ❌ CRITICAL: ${funnel.zeroDays} days with zero conversions in last 30 days.`);
      console.log(`     Investigate: ad spend gaps, product page issues, checkout errors.`);
    }

    const atcGap = ((BENCHMARKS.addToCartRate.warn - atcRate) * funnel.totalSessions);
    if (atcRate < BENCHMARKS.addToCartRate.warn) {
      console.log(`\n  ⚠️  Add-to-cart gap: ${atcRate.toFixed(4)} vs ${BENCHMARKS.addToCartRate.warn} benchmark.`);
      console.log(`     Closing to benchmark = ~${Math.round(atcGap)} more cart additions / 30 days.`);
    }

    Object.assign(report.stages.conversionFunnel, { atcRate, checkoutRate, completionRate, overallCVR });
  } catch (e) {
    console.log('  ⚠️  Conversion funnel query failed:', e.message);
    console.log('     (ShopifyQL requires Shopify Analytics access — Basic plan may need upgrade)');
  }

  // ── Stage 3: Product Performance ──
  printHeader('STAGE 3 — Product Performance (All Time Top 10)');
  try {
    const products = await getProductPerformance(token);
    report.stages.productPerformance = products;

    const totalGross = products.reduce((s, p) => s + p.grossSales, 0);
    console.log(`\n  ${'Product'.padEnd(45)} Orders  Gross Sales   Net Sales`);
    console.log(`  ${'-'.repeat(80)}`);
    for (const p of products) {
      const share = ((p.grossSales / totalGross) * 100).toFixed(0);
      console.log(
        `  ${p.title.slice(0, 44).padEnd(44)}  ${String(p.orders).padStart(4)}  ${fmtAED(p.grossSales).padStart(12)}  ${fmtAED(p.netSales).padStart(10)}  (${share}%)`
      );
    }

    const hero = products[0];
    const tail = products.filter(p => p.orders < 5);
    if (hero && (hero.grossSales / totalGross) > 0.35) {
      console.log(`\n  ⚠️  Hero dependency: "${hero.title.slice(0, 40)}" = ${((hero.grossSales/totalGross)*100).toFixed(0)}% of total revenue.`);
      console.log(`     Risk: any PDP issue on this product directly impacts store revenue.`);
    }
    if (tail.length > 0) {
      console.log(`  ℹ️  ${tail.length} products with <5 orders — consider bundle/promotion focus.`);
    }
  } catch (e) {
    console.log('  ⚠️  Product performance query failed:', e.message);
  }

  // ── Stage 4: RFM Segmentation ──
  printHeader('STAGE 4 — RFM Customer Segmentation (7-Point)');
  try {
    console.log('  Fetching all customers with orders...');
    const customers = await fetchAllCustomersWithOrders(token);
    const rfm = computeRFM(customers);
    report.stages.rfm = {
      totalCustomers: rfm.totalCustomers,
      avgRecencyDays: rfm.avgRecency,
      avgOrdersPerCustomer: rfm.avgOrders,
      avgLTVaed: rfm.avgLTV,
      segments: rfm.segments,
      top10: rfm.top10.map(c => ({
        name: c.name, orders: c.orders, totalSpent: c.totalSpent, segment: c.segment, rfmScore: c.rfmScore
      })),
    };

    console.log(`\n  Customers with ≥1 order : ${rfm.totalCustomers}`);
    console.log(`  Avg recency             : ${rfm.avgRecency} days since last order`);
    console.log(`  Avg orders / customer   : ${rfm.avgOrders}`);
    console.log(`  Avg LTV                 : ${fmtAED(rfm.avgLTV)}`);

    console.log(`\n  Segment Breakdown:`);
    const segOrder = ['Champion','Loyal','Potential Loyalist','New Customer','Needs Attention','At Risk',"Can't Lose",'Hibernating'];
    for (const seg of segOrder) {
      const count = rfm.segments[seg] || 0;
      if (count === 0) continue;
      const bar = '█'.repeat(Math.round((count / rfm.totalCustomers) * 20));
      const icons = { Champion:'🏆', Loyal:'💛', 'Potential Loyalist':'🌱', 'New Customer':'🆕', 'At Risk':'⚠️', "Can't Lose":'🔴', Hibernating:'💤', 'Needs Attention':'📣' };
      console.log(`    ${(icons[seg]||'  ') + ' ' + seg.padEnd(22)} ${String(count).padStart(3)}  ${bar}`);
    }

    const atRisk = rfm.scored.filter(c => ['At Risk', "Can't Lose"].includes(c.segment));
    if (atRisk.length > 0) {
      console.log(`\n  🔴 At Risk / Can't Lose — priority Klaviyo winback targets:`);
      for (const c of atRisk.slice(0, 5)) {
        console.log(`     • ${c.name.padEnd(30)} ${fmtAED(c.totalSpent).padStart(12)}  last order ${c.recency}d ago`);
      }
    }

    console.log(`\n  🏆 Top 10 customers by RFM score:`);
    for (const c of rfm.top10) {
      console.log(`     ${c.segment.padEnd(22)}  ${c.name.padEnd(28)}  ${String(c.orders).padStart(2)} orders  ${fmtAED(c.totalSpent).padStart(10)}`);
    }

    // Repeat customer health
    const singleBuyers = rfm.scored.filter(c => c.orders === 1).length;
    const repeatRate = rate(rfm.totalCustomers - singleBuyers, rfm.totalCustomers);
    console.log(`\n  Repeat purchase rate    : ${pct(rfm.totalCustomers - singleBuyers, rfm.totalCustomers)}  ${status(repeatRate, BENCHMARKS.returningCustRate)}`);
    console.log(`  Single-order customers  : ${singleBuyers} (${pct(singleBuyers, rfm.totalCustomers)})`);

    if (repeatRate < BENCHMARKS.returningCustRate.warn) {
      console.log(`\n  ⚠️  Repeat purchase rate below ${(BENCHMARKS.returningCustRate.warn * 100).toFixed(0)}% benchmark.`);
      console.log(`     Action: activate Klaviyo post-purchase + repeat purchase reminder flows.`);
    }
  } catch (e) {
    console.log('  ⚠️  RFM segmentation failed:', e.message);
  }

  // ── Stage 5: Klaviyo Flows ──
  printHeader('STAGE 5 — Klaviyo Flow Audit');
  try {
    const kl = await auditKlaviyoFlows();
    report.stages.klaviyo = kl;

    if (kl.skipped) {
      console.log(`  ℹ️  Skipped: ${kl.reason}`);
      console.log(`     Set KLAVIYO_PRIVATE_KEY in .env for live flow audit.`);
      console.log(`\n  Known live flows from last scan (2026-05-26):`);
      const knownLive = [
        'Email Welcome - TT360',
        'Abandoned Checkout - TT360',
        'Abandoned Cart - TT360',
        'Browse Abandonment | TT360',
        'Abandoned Site | TT360',
        'Customer Thank You | TT360',
        'Customer Winback | TT360',
        'Back in Stock Alert | TT360',
        'Repeat Purchase Reminder | TT360',
        'Sunset / Re-engagement | TT360',
      ];
      const knownDraft = [
        'Essential Flow Recommendation_ (×3 — unconfigured, safe to delete)',
      ];
      for (const f of knownLive) console.log(`  ✅ ${f}`);
      for (const f of knownDraft) console.log(`  🟡 ${f}`);
    } else {
      console.log(`\n  Live flows  : ${kl.live}`);
      console.log(`  Draft flows : ${kl.draft}`);
      for (const f of kl.flows) {
        const icon = f.status === 'live' ? '✅' : '🟡';
        console.log(`  ${icon} ${f.name.padEnd(40)}  [${f.trigger || 'no trigger'}]`);
      }
      if (kl.missing.length > 0) {
        console.log(`\n  ❌ Missing critical live flows: ${kl.missing.join(', ')}`);
      }
    }
  } catch (e) {
    console.log('  ⚠️  Klaviyo audit failed:', e.message);
  }

  // ── Summary ──
  printHeader('SUMMARY & PRIORITY ACTIONS');

  const summaryActions = [];

  // Funnel CVR
  if (report.stages.conversionFunnel?.overallCVR !== undefined) {
    const cvr = report.stages.conversionFunnel.overallCVR;
    if (cvr < BENCHMARKS.overallCVR.fail) {
      summaryActions.push({ priority: 'P0', action: `CVR is ${(cvr*100).toFixed(3)}% — critically below 0.5% floor. Investigate: product page CTA, mobile UX, checkout errors.` });
    }
    if (report.stages.conversionFunnel?.zeroDays > 7) {
      summaryActions.push({ priority: 'P0', action: `${report.stages.conversionFunnel.zeroDays} of last 30 days had zero orders. Diagnose ad traffic gaps or checkout breakage in that window.` });
    }
  }

  // ATC
  if (report.stages.conversionFunnel?.atcRate !== undefined) {
    if (report.stages.conversionFunnel.atcRate < BENCHMARKS.addToCartRate.warn) {
      summaryActions.push({ priority: 'P1', action: 'Add-to-cart rate <3%. Enable sticky ATC button on all PDPs (optimizer.js apply sticky-atc --execute).' });
    }
  }

  // RFM
  if (report.stages.rfm) {
    const repeatRate = (report.stages.rfm.totalCustomers - (report.stages.rfm.top10?.filter(c => c.orders === 1).length || 0)) / report.stages.rfm.totalCustomers;
    summaryActions.push({ priority: 'P1', action: 'Send Klaviyo "Repeat Purchase Reminder" to all Potential Loyalist + Needs Attention segments.' });
    const champions = report.stages.rfm.segments?.Champion || 0;
    if (champions > 0) summaryActions.push({ priority: 'P2', action: `${champions} Champion customers — enroll in VIP Flash Sale campaign (draft ready in Klaviyo).` });
  }

  // Campaigns
  summaryActions.push({ priority: 'P1', action: 'Schedule 5 draft Klaviyo campaigns: Back to School, Social Proof, Summer Oral Care, VIP Flash, New Arrivals.' });
  summaryActions.push({ priority: 'P2', action: 'Collect real customer reviews via Klaviyo post-purchase flow (template ready in PHASE2_PLAN.md).' });

  console.log('');
  for (const { priority, action } of summaryActions) {
    const icon = priority === 'P0' ? '🔴' : priority === 'P1' ? '🟡' : '🟢';
    console.log(`  ${icon} [${priority}] ${action}`);
  }

  console.log(`\n  Report saved to: sales-funnel-report-${REPORT_DATE}.json`);
  console.log('═'.repeat(60) + '\n');

  report.priorityActions = summaryActions;

  if (JSON_MODE || true) {
    fs.writeFileSync(
      `sales-funnel-report-${REPORT_DATE}.json`,
      JSON.stringify(report, null, 2)
    );
  }
})();

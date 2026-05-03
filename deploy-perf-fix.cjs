require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const LAYOUT = 'theme-files/layout/theme.liquid';
const TS = Date.now();

console.log('\n Performance Fix — Single Push\n' + '='.repeat(50));

fs.copyFileSync(LAYOUT, `${LAYOUT}.PRE-PERF-${TS}.bak`);
console.log('Backup created');

let layout = fs.readFileSync(LAYOUT, 'utf8');

const PRECONNECTS = `
  <link rel="preconnect" href="https://www.googletagmanager.com">
  <link rel="preconnect" href="https://www.google-analytics.com">
  <link rel="preconnect" href="https://static.klaviyo.com">
  <link rel="preconnect" href="https://code.jquery.com">`;

if (!layout.includes('static.klaviyo.com')) {
  layout = layout.replace(
    '<link rel="preconnect" href="https://cdn.shopify.com"',
    PRECONNECTS + '\n  <link rel="preconnect" href="https://cdn.shopify.com"'
  );
  console.log('Preconnects added');
} else {
  console.log('Preconnects already present');
}

const LCP_PRELOAD = `
  {%- if template == 'index' -%}
  {%- assign lcp_product = collections['new-arrivals-top-selling-products-in-uae'].products.first -%}
  {%- if lcp_product and lcp_product.featured_image -%}
  <link rel="preload" as="image"
    href="{{ lcp_product.featured_image | image_url: width: 600 }}"
    imagesrcset="{{ lcp_product.featured_image | image_url: width: 300 }} 300w, {{ lcp_product.featured_image | image_url: width: 600 }} 600w"
    imagesizes="(max-width: 768px) 100vw, 600px">
  {%- endif -%}
  {%- endif -%}`;

if (!layout.includes('LCP hero')) {
  layout = layout.replace('</head>', LCP_PRELOAD + '\n</head>');
  console.log('LCP preload injected');
}

const jqueryPattern = /(<script[^>]*src="https:\/\/code\.jquery\.com\/[^"]*"[^>]*)>/;
if (jqueryPattern.test(layout)) {
  layout = layout.replace(jqueryPattern, (match, p1) => {
    if (p1.includes('defer') || p1.includes('async')) return match;
    return p1 + ' defer>';
  });
  console.log('jQuery deferred');
} else {
  console.log('jQuery not in theme.liquid');
}

const klaviyoPattern = /(<script[^>]*src="https:\/\/static\.klaviyo\.com\/[^"]*"[^>]*)>/;
if (klaviyoPattern.test(layout)) {
  layout = layout.replace(klaviyoPattern, (match, p1) => {
    if (p1.includes('defer') || p1.includes('async')) return match;
    return p1 + ' defer>';
  });
  console.log('Klaviyo deferred');
} else {
  console.log('Klaviyo not in theme.liquid');
}

fs.writeFileSync(LAYOUT, layout);

const CRITICAL_SNIPPET = 'theme-files/snippets/critical-css.liquid';
const criticalCss = `{%- comment -%} Critical CSS {%- endcomment -%}
<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
img { max-width: 100%; height: auto; }
@media (max-width: 768px) {
  html, body { overflow-x: clip; max-width: 100vw; }
  h1 { font-size: 24px; line-height: 1.25; }
}
.product-form__cart-submit {
  background: #12395e; color: #fff5e6; font-weight: 700;
  min-height: 56px; border-radius: 8px; border: none;
  cursor: pointer; width: 100%; font-size: 16px;
}
</style>`;

fs.writeFileSync(CRITICAL_SNIPPET, criticalCss);
console.log('Critical CSS snippet written');

let finalLayout = fs.readFileSync(LAYOUT, 'utf8');
if (!finalLayout.includes("'critical-css'")) {
  finalLayout = finalLayout.replace('</head>', "{%- render 'critical-css' -%}\n</head>");
  fs.writeFileSync(LAYOUT, finalLayout);
  console.log('Critical CSS wired into theme.liquid');
}

console.log('\nPushing...');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files --only layout/theme.liquid --only snippets/critical-css.liquid --allow-live`,
    { stdio: 'inherit', cwd: '/Users/rabiharabi/tiptop360-optimizer' }
  );
  console.log('\nPERFORMANCE FIX COMPLETE');
  console.log('Expected: LCP -0.4-0.8s | TBT -80-230ms | CLS stable');
} catch(e) {
  fs.copyFileSync(`${LAYOUT}.PRE-PERF-${TS}.bak`, LAYOUT);
  console.log('Push failed — rolled back');
  process.exit(1);
}

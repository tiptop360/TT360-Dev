require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const SNIPPET = 'theme-files/snippets/blog-author-schema.liquid';
const TS = Date.now();

console.log('🚀 Author Schema Deploy\n' + '='.repeat(50));

if (fs.existsSync(SNIPPET)) fs.copyFileSync(SNIPPET, `${SNIPPET}.PRE-${TS}.bak`);

const snippet = `{%- comment -%} Author + Article JSON-LD — blog posts {%- endcomment -%}
{%- if template == 'article' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": {{ article.title | json }},
  "description": {{ article.excerpt_or_content | strip_html | truncate: 200 | json }},
  "datePublished": "{{ article.published_at | date: '%Y-%m-%dT%H:%M:%SZ' }}",
  "dateModified": "{{ article.updated_at | date: '%Y-%m-%dT%H:%M:%SZ' }}",
  "url": "{{ shop.url }}{{ article.url }}",
  "image": {%- if article.image -%}"{{ article.image | image_url: width: 1200 }}"{%- else -%}"{{ shop.url }}/cdn/shop/files/Logo.png"{%- endif -%},
  "author": {
    "@type": "Organization",
    "name": "TipTop360",
    "url": "{{ shop.url }}",
    "logo": "{{ shop.url }}/cdn/shop/files/Logo.png",
    "description": "UAE-based kids and family e-commerce store. Trusted by 50,000+ UAE families.",
    "areaServed": {
      "@type": "Country",
      "name": "United Arab Emirates"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "TipTop360",
    "url": "{{ shop.url }}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{ shop.url }}/cdn/shop/files/Logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "{{ shop.url }}{{ article.url }}"
  }
}
</script>
{%- endif -%}`;

fs.writeFileSync(SNIPPET, snippet);
console.log('✅ Snippet written');

// Wire into theme.liquid before </head> if not present
const LAYOUT = 'theme-files/layout/theme.liquid';
let layout = fs.readFileSync(LAYOUT, 'utf8');
if (!layout.includes("'blog-author-schema'")) {
  fs.copyFileSync(LAYOUT, `${LAYOUT}.PRE-${TS}.bak`);
  layout = layout.replace('</head>', "{%- render 'blog-author-schema' -%}\n</head>");
  fs.writeFileSync(LAYOUT, layout);
  console.log('✅ Wired into theme.liquid');
} else {
  console.log('✅ Already wired — skipping');
}

console.log('\n📤 Pushing...');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files ` +
    `--only snippets/blog-author-schema.liquid ` +
    `--only layout/theme.liquid --allow-live`,
    { stdio: 'inherit', cwd: '/Users/rabiharabi/tiptop360-optimizer' }
  );
  console.log('\n✅ Author schema deployed to all blog posts');
} catch(e) {
  console.log('❌ Push failed — rolling back');
  if (fs.existsSync(`${SNIPPET}.PRE-${TS}.bak`)) fs.copyFileSync(`${SNIPPET}.PRE-${TS}.bak`, SNIPPET);
  if (fs.existsSync(`${LAYOUT}.PRE-${TS}.bak`)) fs.copyFileSync(`${LAYOUT}.PRE-${TS}.bak`, LAYOUT);
  process.exit(1);
}

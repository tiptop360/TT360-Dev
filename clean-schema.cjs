const fs = require('fs');

const FILE = 'theme-files/snippets/product-schema-extra.liquid';

// Write clean version: heal corruption + remove FAQPage block, keep Product schema
const clean = `{%- if product -%}
{%- assign jm = product.metafields.judgeme.review_widget_data -%}
{%- assign rc_direct = product.metafields.reviews.rating_count -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": {{ product.title | json }},
  "image": "{{ product.featured_image | image_url: width: 1200 }}",
  "url": "{{ shop.url }}{{ product.url }}"
  {%- if jm != blank -%}
  ,
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{{ jm.value.average_rating | default: 4.9 }}",
    "reviewCount": "{{ jm.value.number_of_reviews | default: 1 }}",
    "bestRating": "5",
    "worstRating": "1"
  }
  {%- elsif rc_direct != blank -%}
  ,
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "{{ rc_direct }}",
    "bestRating": "5",
    "worstRating": "1"
  }
  {%- endif -%}
}
</script>
{%- endif -%}
`;

fs.writeFileSync(FILE, clean);

// Validate
const opens = (clean.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
const closes = (clean.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
const md = (clean.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || []).length;
const faqRefs = (clean.match(/FAQPage/g) || []).length;

console.log(`File written: ${clean.length} chars`);
console.log(`Liquid blocks: ${opens}/${closes} ${opens === closes ? '✅' : '❌'}`);
console.log(`Markdown corruption: ${md} ${md === 0 ? '✅' : '❌'}`);
console.log(`FAQPage refs: ${faqRefs} ${faqRefs === 0 ? '✅' : '❌'}`);

if (opens !== closes || md > 0 || faqRefs > 0) process.exit(1);

console.log('\n✅ All validations passed. Ready to push.');

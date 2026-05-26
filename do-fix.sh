#!/bin/bash
set -e

# Center comparison title — write Liquid via node (no zsh)
node -e "
const fs = require('fs');
let s = fs.readFileSync('theme-files/snippets/product-comparison-table.liquid','utf8');
const before = s.length;
s = s.split('text-align:center;margin:0 0 16px;color:#12395e;font-size:20px').join('text-align:center;margin:0 auto 16px;color:#12395e;font-size:20px;display:block;width:100%');
fs.writeFileSync('theme-files/snippets/product-comparison-table.liquid', s);
console.log('Comparison file updated:', before, '->', s.length);
"

# Force cache flush
echo ' ' >> theme-files/layout/theme.liquid

# Push
shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only snippets/product-comparison-table.liquid --only layout/theme.liquid --only snippets/mobile-first-css.liquid --only sections/product-template-1.liquid --allow-live

# Wait + verify
sleep 60

node -e "
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
(async () => {
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now(), {headers:{'User-Agent':'Mozilla/5.0 iPhone'}})).text();
  const vp = (html.match(/<meta name=\"viewport\"[^>]*>/i) || [''])[0];
  const checks = [
    ['Viewport zoom OK', !/user-scalable=no|maximum-scale=[01](?!\.)/.test(vp)],
    ['Mobile CSS loaded', html.includes('MOBILE-FIRST FONT SIZES')],
    ['Swiper CSS loaded', html.includes('SWIPER FIX')],
    ['Trust band', html.includes('cro-trust-band')],
    ['Risk reversal', html.includes('cro-risk-reversal')],
    ['Comparison rendered', html.includes('cro-comparison')],
    ['FBT rendered', html.includes('cro-fbt')],
    ['Rating badge rendered', html.includes('cro-rating-badge')]
  ];
  let p=0,f=0;
  checks.forEach(([n,ok])=>{console.log(' '+(ok?'OK':'FAIL')+' '+n);ok?p++:f++;});
  console.log(p+'/'+checks.length+' passed');
})();
"

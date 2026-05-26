require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const ROOT  = '/Users/rabiharabi/tiptop360-optimizer';
const FILE  = ROOT + '/theme-files/sections/aivox-pdp.liquid';

fs.copyFileSync(FILE, FILE + '.PRE-REMOVEWAFAB.bak');

let liquid = fs.readFileSync(FILE, 'utf8');

// Remove WA FAB CSS block
liquid = liquid.replace(/.aivox-wa-fab\{[^}]+\}/g, '');
liquid = liquid.replace(/.aivox-wa-fab:hover\{[^}]+\}/g, '');

// Remove WA FAB HTML element
liquid = liquid.replace(/<a href="https:\/\/wa\.me\/971585156033" class="aivox-wa-fab"[\s\S]*?<\/a>/g, '');

fs.writeFileSync(FILE, liquid);
console.log('✅ WA FAB removed');

execSync(
  'shopify theme push --store ' + STORE + ' --theme ' + THEME + ' --path ./theme-files --only sections/aivox-pdp.liquid --allow-live',
  { stdio: 'inherit', cwd: ROOT }
);
console.log('✅ Pushed — WA FAB gone');

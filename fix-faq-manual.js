#!/usr/bin/env node
/**
 * fix-faq-manual.js — surgical FAQ removal using exact string match
 * Run from tiptop360-optimizer/ folder:  node fix-faq-manual.js
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, 'theme-files', 'layout', 'theme.liquid');

if (!existsSync(filePath)) {
  console.error('❌ theme-files/layout/theme.liquid not found');
  process.exit(1);
}

// Backup first
const backupDir = join(__dirname, 'local-backups', 'fix-faq-manual');
mkdirSync(backupDir, { recursive: true });
copyFileSync(filePath, join(backupDir, 'layout__theme.liquid'));
console.log('📦 Backup saved to local-backups/fix-faq-manual/');

const content = readFileSync(filePath, 'utf8');

// The EXACT string to remove (from comma after WebSite's `}` through FAQPage's closing `}`)
const TARGET = `},
          {
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How long does shipping take?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Orders are processed within 1\u20133 business days. Delivery is usually 2\u20135 business days in the UAE."
                }
              },
              {
                "@type": "Question",
                "name": "Can I return an item?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. Items may be returned within 14 days if unused and in original packaging."
                }
              }
            ]
          }`;

// Replace with just `}` (closing WebSite without trailing comma)
const REPLACEMENT = `}`;

if (!content.includes(TARGET)) {
  console.error('❌ Could not find the exact FAQ block.');
  console.error('   Possible reasons:');
  console.error('   1. File was already modified (check with grep "FAQPage")');
  console.error('   2. Whitespace/indentation differs from expected');
  console.error('   3. Different shipping/return text');
  console.error('\n   File was NOT modified. Backup is in local-backups/fix-faq-manual/');
  process.exit(1);
}

const updated = content.replace(TARGET, REPLACEMENT);

// Sanity check the result before writing
const beforeFAQCount = (content.match(/FAQPage/g) || []).length;
const afterFAQCount = (updated.match(/FAQPage/g) || []).length;
const beforeOrgCount = (content.match(/Organization/g) || []).length;
const afterOrgCount = (updated.match(/Organization/g) || []).length;
const beforeWebsiteCount = (content.match(/WebSite/g) || []).length;
const afterWebsiteCount = (updated.match(/WebSite/g) || []).length;

console.log('\n📊 Verification:');
console.log(`   FAQPage:      ${beforeFAQCount} → ${afterFAQCount}  ${afterFAQCount === beforeFAQCount - 1 ? '✅' : '❌'}`);
console.log(`   Organization: ${beforeOrgCount} → ${afterOrgCount}  ${afterOrgCount === beforeOrgCount ? '✅' : '❌'}`);
console.log(`   WebSite:      ${beforeWebsiteCount} → ${afterWebsiteCount}  ${afterWebsiteCount === beforeWebsiteCount ? '✅' : '❌'}`);

if (afterFAQCount !== beforeFAQCount - 1) {
  console.error('\n❌ FAQ count change unexpected. NOT writing file.');
  process.exit(1);
}
if (afterOrgCount !== beforeOrgCount || afterWebsiteCount !== beforeWebsiteCount) {
  console.error('\n❌ Organization or WebSite was affected. NOT writing file.');
  process.exit(1);
}

writeFileSync(filePath, updated);
console.log('\n✅ File updated successfully.');
console.log('✅ FAQPage removed from layout/theme.liquid');
console.log('✅ Organization and WebSite preserved');
console.log('\n💡 Verify the JSON structure:');
console.log('   sed -n \'/<script type="application\\/ld+json">/,/<\\/script>/p\' theme-files/layout/theme.liquid | tail -20');

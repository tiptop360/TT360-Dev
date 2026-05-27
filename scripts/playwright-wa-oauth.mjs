/**
 * TipTop360 — Open Klaviyo WhatsApp Settings in Chrome
 * Run: node scripts/playwright-wa-oauth.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

const KLAVIYO_WA_URL = 'https://www.klaviyo.com/settings/channels/whatsapp';

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer); });
  });
}

async function openUrl(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    await execAsync(`open -a "Google Chrome" "${url}"`);
  } else if (platform === 'win32') {
    await execAsync(`start chrome "${url}"`);
  } else {
    await execAsync(`google-chrome "${url}" || chromium "${url}"`);
  }
}

console.log('━━━ TipTop360 WhatsApp × Klaviyo Setup ━━━\n');
console.log(`Opening Chrome at:\n  ${KLAVIYO_WA_URL}\n`);

await openUrl(KLAVIYO_WA_URL);

console.log('Chrome should now be open at the Klaviyo WhatsApp settings page.\n');
console.log('In the browser, complete these steps:');
console.log('  1. Click  "Connect with Meta"');
console.log('  2. Log in to Facebook/Meta if prompted');
console.log('  3. Select your WhatsApp Business Account');
console.log('  4. Select phone number +971585156033');
console.log('  5. Click Connect / Finish\n');

await ask('Press ENTER when the WhatsApp channel is connected…');

console.log('\n✅  OAuth complete!');
console.log('Next step — create Klaviyo flows + deploy opt-in popup:');
console.log('  node scripts/klaviyo-wa-setup.mjs');

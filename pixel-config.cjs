require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

(async () => {
  const html = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  
  // Find webPixelsConfigList — extract entire array
  const startIdx = html.indexOf('webPixelsConfigList:');
  if (startIdx === -1) { console.log('webPixelsConfigList not found'); return; }
  
  // Read forward to find matching closing bracket
  let depth = 0, started = false, endIdx = startIdx;
  for (let i = startIdx; i < html.length; i++) {
    const c = html[i];
    if (c === '[') { depth++; started = true; }
    if (c === ']') { depth--; if (started && depth === 0) { endIdx = i; break; } }
  }
  
  const configList = html.slice(startIdx, endIdx + 1);
  console.log('=== webPixelsConfigList raw size:', configList.length, 'bytes ===\n');
  
  // Find each pixel object (each starts with {"id":")
  const pixels = [];
  let idx = 0;
  while ((idx = configList.indexOf('{"id":"', idx)) !== -1) {
    // Find end of this pixel object
    let d = 0, end = idx;
    for (let i = idx; i < configList.length; i++) {
      if (configList[i] === '{') d++;
      if (configList[i] === '}') { d--; if (d === 0) { end = i + 1; break; } }
    }
    pixels.push(configList.slice(idx, end));
    idx = end;
  }
  
  console.log('Total pixels registered:', pixels.length, '\n');
  
  pixels.forEach((p, i) => {
    const id = p.match(/"id":"(\d+)"/)?.[1];
    const tagIds = [...p.matchAll(/G[T-]-?[A-Z0-9]{8,}|GTM-[A-Z0-9]+|AW-\d+/g)].map(m => m[0]);
    const uniqueTags = [...new Set(tagIds)];
    
    console.log('Pixel ' + (i+1) + ': ID=' + id);
    console.log('  Google tags: ' + (uniqueTags.length ? uniqueTags.join(', ') : 'none'));
    
    // Try to identify which app this belongs to
    const namespace = p.match(/"namespace":"([^"]+)"/)?.[1] || p.match(/namespace[\\"]+([a-z_-]+)/i)?.[1];
    const account = p.match(/"account_id":"([^"]+)"/)?.[1] || p.match(/account_id[\\"]+([^\\"]+)/)?.[1];
    
    if (namespace) console.log('  Namespace: ' + namespace);
    if (account) console.log('  Account: ' + account);
    
    // Print first 250 chars
    console.log('  Preview: ' + p.slice(0, 250).replace(/\s+/g, ' '));
    console.log('');
  });
})();

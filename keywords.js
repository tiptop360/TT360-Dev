/**
 * TipTop360 — Approved Keyword Strategy
 * ─────────────────────────────────────────────────────────────
 * This file maps every product to its priority + secondary keywords.
 * The optimizer reads this when generating AI metas and title tags.
 *
 * To update: edit this file, save, then re-run any fix.
 * The optimizer always reads the latest version.
 */

export const KEYWORDS = {
  // ─────────────────────────────────────────
  // TOP 10 PRIORITY KEYWORDS (the focus list)
  // ─────────────────────────────────────────
  priority: [
    'kids electric toothbrush UAE',
    'u-shaped toothbrush kids',
    'screen-free birthday gift UAE',
    'kids drawing robot Dubai',
    'smoke bubble machine UAE',
    'kids party bubble machine',
    'STEM toys for kids UAE',
    'fluoride-free kids toothpaste',
    'magnetic gym bag Dubai',
    'AI voice recorder Dubai',
  ],

  // ─────────────────────────────────────────
  // PRODUCT → KEYWORD MAPPING
  // Each product gets: primary keyword + gift angle + secondary cluster
  // ─────────────────────────────────────────
  products: {
    // U-Shaped Toothbrush
    'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift': {
      primary: 'kids electric toothbrush UAE',
      gift: 'screen-free birthday gift UAE',
      secondary: [
        'u-shaped toothbrush kids',
        'best toothbrush for toddlers Dubai',
        '60-second toothbrush kids',
        'BPA-free kids toothbrush UAE',
        'automatic toothbrush kids',
      ],
      titleFormula: '{title} UAE | Best Kids Gift | TipTop360',
    },

    // Drawing Robot
    'kids-drawing-robot': {
      primary: 'kids drawing robot Dubai',
      gift: 'STEM birthday gift UAE',
      secondary: [
        'STEM toys for kids UAE',
        'educational robot for kids',
        'screen-free learning toy',
        'best gift for 5 year old UAE',
        'drawing toy for kids 3-10',
      ],
      titleFormula: '{title} | STEM Birthday Gift UAE | TipTop360',
    },

    // Smoke Bubble Machine
    'smoke-bubble-machine': {
      primary: 'smoke bubble machine UAE',
      gift: 'kids birthday gifts UAE',
      secondary: [
        'kids party bubble machine',
        'magic bubble machine kids',
        'party gadget kids UAE',
        'bubble machine birthday party',
        'viral bubble toy Dubai',
      ],
      titleFormula: '{title} | Magic Party Gadget UAE | TipTop360',
    },

    // Strawberry Foam Toothpaste
    'kids-strawberry-foam-toothpaste-uae-approved': {
      primary: 'fluoride-free kids toothpaste',
      gift: 'kids dental gift UAE',
      secondary: [
        'strawberry toothpaste kids UAE',
        'safe kids toothpaste',
        'fun toothpaste for toddlers',
        'ages 3+ toothpaste Dubai',
        'foam toothpaste kids',
      ],
      titleFormula: '{title} | Fluoride-Free UAE | TipTop360',
    },

    // Magnetic Gym Bag
    'magnetic-gym-bag': {
      primary: 'magnetic gym bag Dubai',
      gift: 'gym lover gift UAE',
      secondary: [
        'smart gym bag UAE',
        'hands-free gym bag',
        'best gym bag Dubai',
        'fitness bag with magnets',
        'gym essentials UAE',
      ],
      titleFormula: '{title} | Smart Fitness Gift UAE | TipTop360',
    },

    // AI Voice Recorder
    'ai-voice-recorder': {
      primary: 'AI voice recorder Dubai',
      gift: 'professional gift UAE',
      secondary: [
        'AI transcription device Dubai',
        'meeting recorder UAE',
        'GPT-4 voice recorder',
        'note-taking device Dubai',
        'best dictaphone UAE',
      ],
      titleFormula: '{title} | AI Transcription Device UAE | TipTop360',
    },
  },

  // ─────────────────────────────────────────
  // FALLBACK — used when product is not in the map above
  // ─────────────────────────────────────────
  fallback: {
    primary: 'kids gifts UAE',
    gift: 'birthday gifts UAE',
    secondary: [
      'best kids gifts Dubai',
      'unique gifts UAE',
      'fast delivery gifts UAE',
    ],
    titleFormula: '{title} | UAE Fast Delivery | TipTop360',
  },

  // ─────────────────────────────────────────
  // GIFT CLUSTER (for collection pages + homepage)
  // ─────────────────────────────────────────
  giftCluster: [
    'birthday gifts kids UAE',
    'best gift for kids Dubai',
    'Eid gifts for kids',
    'Christmas gifts kids UAE',
    'last-minute gift Dubai',
    'educational gifts UAE',
    'screen-free gifts UAE',
  ],

  // ─────────────────────────────────────────
  // BRAND-WIDE TERMS (for homepage + organization schema)
  // ─────────────────────────────────────────
  brand: [
    'TipTop360',
    'feel-good finds UAE',
    'kids gadgets Dubai',
    'family essentials UAE',
    'curated kids products UAE',
  ],
};

// ─────────────────────────────────────────
// HELPER — get keywords for a product by handle
// ─────────────────────────────────────────
export function getKeywordsForProduct(handle) {
  // Try exact match first
  if (KEYWORDS.products[handle]) return KEYWORDS.products[handle];

  // Try partial match (e.g. handle contains "toothbrush")
  for (const [key, value] of Object.entries(KEYWORDS.products)) {
    if (handle.includes(key.split('-')[0]) || key.includes(handle.split('-')[0])) {
      return value;
    }
  }

  // Smart fallback by keyword detection in handle
  if (handle.includes('toothbrush')) return KEYWORDS.products['kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift'];
  if (handle.includes('drawing') || handle.includes('robot')) return KEYWORDS.products['kids-drawing-robot'];
  if (handle.includes('bubble')) return KEYWORDS.products['smoke-bubble-machine'];
  if (handle.includes('toothpaste') || handle.includes('foam')) return KEYWORDS.products['kids-strawberry-foam-toothpaste-uae-approved'];
  if (handle.includes('gym') || handle.includes('magnetic')) return KEYWORDS.products['magnetic-gym-bag'];
  if (handle.includes('voice') || handle.includes('recorder') || handle.includes('aivox')) return KEYWORDS.products['ai-voice-recorder'];

  // Default fallback
  return KEYWORDS.fallback;
}

// Build the AI prompt for meta description with target keywords
export function buildMetaPrompt(product) {
  const kw = getKeywordsForProduct(product.handle || '');
  return `Write a Shopify meta description for this UAE e-commerce product.

Product: ${product.title}
Type: ${product.product_type || ''}
Tags: ${product.tags || ''}

REQUIRED KEYWORDS (must include both naturally):
- Primary: "${kw.primary}"
- Gift angle: "${kw.gift}"

Style rules:
- Maximum 155 characters TOTAL (strict)
- Lead with the main customer benefit (not the product feature)
- Include "UAE" or "Dubai" naturally
- End with a soft CTA: "Shop now", "Order today", "Free delivery"
- No quotes, no emojis, no hype words ("amazing", "incredible", "ultimate")
- Sound human, not AI-generated
- Active voice

Return ONLY the meta description text. No preamble, no quotes around it, no explanation.`;
}

// Build the title tag using the product's formula
export function buildTitleTag(product) {
  const kw = getKeywordsForProduct(product.handle || '');
  const baseTitle = (product.title || '').replace(/\s*\|.*$/, '').trim();
  // Google displays ~60 chars but Shopify allows up to 70 — keep under 65 for safety
  return kw.titleFormula.replace('{title}', baseTitle).substring(0, 65);
}

// Build the AI prompt for full product description (600-800 words, 8 sections)
// Tone: friendly + premium hybrid, mobile-first, GEO/AEO optimized
export function buildDescriptionPrompt(product) {
  const kw = getKeywordsForProduct(product.handle || '');
  const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400);
  const existingDesc = stripHtml(product.body_html);

  return `You are a senior conversion copywriter and SEO expert for TipTop360, a UAE-based premium kids/family/lifestyle e-commerce store. Write a production-grade product description.

PRODUCT DETAILS:
- Title: ${product.title}
- Type: ${product.product_type || ''}
- Tags: ${product.tags || ''}
- Existing description excerpt (for context, do NOT copy): ${existingDesc || '(none)'}

KEYWORD STRATEGY (must embed naturally throughout, NOT keyword-stuffed):
- Primary keyword: "${kw.primary}"
- Gift-angle keyword: "${kw.gift}"
- Secondary keywords (use 2-3 throughout): ${(kw.secondary || []).slice(0, 4).join(' | ')}

OUTPUT FORMAT — Return clean HTML using these EXACT 8 sections (use <h2>, <h3>, <ul>, <li>, <p>, <strong>):

<h2>[Hook headline with primary keyword + UAE context]</h2>
<p>[60-90 word emotional/practical opener. Mobile users see this first. Address the parent's pain or aspiration. Mention the gift angle subtly. End with a transition into the bullets.]</p>

<h3>Why UAE Families Love It</h3>
<ul>
  <li><strong>[Benefit 1]:</strong> [specific number or detail — e.g., "60-second auto-cycle ends brushing battles"]</li>
  <li><strong>[Benefit 2]:</strong> [specific detail with one secondary keyword]</li>
  <li><strong>[Benefit 3]:</strong> [specific detail with another secondary keyword]</li>
  <li><strong>[Benefit 4]:</strong> [specific detail]</li>
  <li><strong>[Benefit 5]:</strong> [specific detail]</li>
</ul>

<h3>Perfect Screen-Free Gift</h3>
<p>[60-80 words. Specifically mention birthday, Eid, Ramadan, back-to-school as occasions. Mention age range. Talk to gift-givers (parents, grandparents, aunties). Use "Dubai parents" or "UAE families" for social proof.]</p>

<h3>Why Shop With TipTop360</h3>
<ul>
  <li>✅ <strong>Free UAE delivery</strong> on every order</li>
  <li>✅ <strong>Cash on Delivery (COD)</strong> available</li>
  <li>✅ <strong>14-day returns</strong> — try it risk-free</li>
  <li>✅ <strong>WhatsApp support</strong> — message us +971 58 515 6033</li>
  <li>✅ <strong>UAE-based business</strong> — fast, local, trusted</li>
</ul>

<h3>Specifications</h3>
<ul>
  <li><strong>[Spec 1 with keyword variant]</strong></li>
  <li><strong>[Spec 2]</strong></li>
  <li><strong>[Spec 3]</strong></li>
  <li><strong>[Spec 4]</strong></li>
</ul>

<h3>Frequently Asked Questions</h3>
<p><strong>[FAQ 1 — long-tail question, e.g., "Is X safe for toddlers under 3?"]</strong><br>
[Definitive 2-3 sentence answer. Include specific ages/numbers/conditions. AI engines will cite this verbatim.]</p>

<p><strong>[FAQ 2 — comparison/practical, e.g., "How does this compare to a regular X?"]</strong><br>
[2-3 sentences with concrete differences. Mention the product name once.]</p>

<p><strong>[FAQ 3 — age/use case, e.g., "Is this good for a 10-year-old?"]</strong><br>
[2-3 sentences. Be specific about age range and use cases.]</p>

<p><strong>[FAQ 4 — UAE-specific, e.g., "Do you ship to Abu Dhabi/Sharjah/Ajman?"]</strong><br>
[Confirm UAE-wide free delivery + delivery time. Mention COD.]</p>

<p><strong>[FAQ 5 — buying decision, e.g., "What's the best age to start using this?"]</strong><br>
[Helpful answer that builds confidence to buy.]</p>

<h3>Honest Note</h3>
<p>[ONE specific limitation or consideration — 25-40 words. e.g., "This works best for ages 3-10. Toddlers under 3 may need adult assistance during use." Building trust by being honest BOOSTS conversion.]</p>

<h3>Order Now</h3>
<p>[40-60 words. Strong CTA. Reinforce the main benefit + UAE delivery + gift angle. End with clear action verb.]</p>

CRITICAL STYLE RULES:
- Tone: warm + elevated (not stuffy, not childish) — like a thoughtful curator who happens to be a parent
- Active voice ALWAYS
- Specific numbers, not vague claims ("60 seconds" not "quick", "ages 2-12" not "for kids")
- NO hype words: amazing, incredible, ultimate, revolutionary, best-in-class, game-changing
- NO em-dashes used as a stylistic flourish
- NO emojis except the ✅ in the trust section
- Use UAE-specific language: dirhams (if pricing), Eid, Ramadan, Dubai, Abu Dhabi, Sharjah
- Embed primary keyword 2-3 times naturally
- Embed gift keyword 1-2 times naturally
- Sound like a UAE-based premium boutique, not a global mass-market brand
- TARGET LENGTH: 600-800 words total

Return ONLY the HTML content. No preamble, no markdown code fences, no explanation. Start with <h2> and end with the closing </p> of the CTA section.`;
}

// Build the AI prompt for FAQ schema (5 Q&As as JSON array)
// Used to update Shopify metafield for product-specific FAQ rich results
export function buildFAQSchemaPrompt(product) {
  const kw = getKeywordsForProduct(product.handle || '');
  return `You are an SEO expert generating Schema.org FAQPage JSON for a UAE Shopify product.

PRODUCT: ${product.title}
PRIMARY KEYWORD: ${kw.primary}
SECONDARY KEYWORDS: ${(kw.secondary || []).slice(0, 3).join(', ')}

Generate exactly 5 question-and-answer pairs targeting LONG-TAIL search queries that real UAE customers would ask. Examples of good question patterns:
- "Is [product] safe for [specific age]?"
- "How does [product] compare to [common alternative]?"
- "What age is [product] for?"
- "Can I use [product] with [common related thing]?"
- "Do you ship [product] to [UAE city]?"

ANSWER RULES:
- 60-120 words per answer
- Definitive (no hedging, no "it depends" without explanation)
- Include specific numbers, ages, or conditions
- Mention the full product name once per answer
- Suitable for AI engines (ChatGPT, Perplexity) to cite verbatim
- No emojis, no markdown, no hype words

Return ONLY a valid JSON array with this exact structure (no preamble, no code fences):
[
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."}
]`;
}

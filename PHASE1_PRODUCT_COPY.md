# Phase 1 — Production-ready product copy (for review before publishing)

This is the rewritten copy implementing the Phase 1 CRITICAL fixes (C-1, C-2, C-3, C-4, H-3) plus the confirmed Phase 0 facts (next-day delivery, no installments, dry-only, water-resistant). Phase 2/3 items are intentionally **not** here yet because they depend on still-open facts (real reviews for UGC, neodymium confirmation for the technical safety claim, warranty term).

**Status:** ✅ PUBLISHED to the live Shopify product (`gid://shopify/Product/8082816827507`) on 2026-05-25 — both title and description are live.

### Consistency leftovers — ✅ RESOLVED (2026-05-25, via GraphQL)
Both metadata leftovers have been cleaned on the live product:
- **Tags** (`productUpdate`): removed `Magnetic Closure` and `Waterproof Gym Bag`; added `Magnetic Mount`, `Water-Resistant Gym Bag`, `Hands-Free Gym Bag`. Final set keeps the SEO-relevant `Magnetic Gym Bag` / `Gym Bag Dubai` drivers.
- **Image alt-text** (`fileUpdate`, 6 images): removed the false **"wet dry compartment"** claim and the "waterproof" / "neodymium closure" wording; reworded to "mounted" / "water-resistant". Two stray alts also tidied (leading-tab text and an empty alt).

> Caveat: if any *automated (smart) collection* was keyed on the exact tags `Magnetic Closure` or `Waterproof Gym Bag`, the product would drop out of it. The main drivers (`Magnetic Gym Bag`, `Gym Bag Dubai`, product type) were preserved, so risk is low — worth a quick check in Shopify admin → Collections.

---

## Proposed product title

Current:
```
Magnetic Hands-Free Gym Bag
```
Proposed (keeps it short enough for cart/checkout while adding the mechanism):
```
Magnetic Hands-Free Gym Bag — Sticks to Any Metal Rack
```

---

## Proposed `descriptionHtml`

```html
<p><strong>The hands-free magnetic gym bag that snaps onto any metal rack or machine — so your phone, keys and bottle stay at arm's reach, never on a sweaty bench or the dirty floor. Water-resistant. AED 110. Free next-day delivery across the UAE. Cash on Delivery available.</strong></p>
<h2>The Gym Bag That Sticks to Your Rack — Magnetic Mount, Hands-Free, Off the Dirty Floor</h2>
<p>Mid-set, where does your phone go? On the floor. On a bench someone wants. In your pocket, digging in while you lift. The magnetic mount fixes that: the bag snaps onto any metal rack, machine or locker and holds up to 2.5&nbsp;kg without slipping — so your essentials stay exactly where you can grab them, and off the dirty gym floor. Whether you train at a commercial gym, a home setup or an outdoor spot across the Emirates, it keeps your space clear and your focus on the work.</p>
<h3>Why lifters in the UAE use it</h3>
<ul>
<li><strong>Magnetic mount — sticks to any metal rack, holds 2.5&nbsp;kg:</strong> Snap the bag onto your squat rack, cable machine or locker and it stays put through your whole session. No bench space taken, no holding your phone between sets.</li>
<li><strong>Truly hands-free:</strong> Attaches in a second to any standard metal gym equipment — nothing balanced on benches, nothing left on the ground.</li>
<li><strong>Holds your essentials, nothing more:</strong> phone, keys, wallet, a small towel, snacks and a slim 350&ndash;500&nbsp;ml bottle. Compact by design — it's a mount, not a duffel.</li>
<li><strong>Water-resistant &amp; easy to clean:</strong> Wipes down in seconds and shrugs off UAE humidity, sweat and splashes.</li>
<li><strong>Sticks anywhere there's metal:</strong> locker door, car frame, treadmill console — wherever you need your gear within reach.</li>
</ul>
<h3>Why shop with TipTop360</h3>
<ul>
<li>✅ <strong>Free next-day delivery across the UAE</strong></li>
<li>✅ <strong>Cash on Delivery (COD)</strong> available</li>
<li>✅ <strong>14-day returns</strong> — try it risk-free</li>
<li>✅ <strong>WhatsApp support</strong> — message us +971 58 515 6033</li>
<li>✅ <strong>UAE-based business</strong> — fast, local, trusted</li>
</ul>
<h3>Specifications</h3>
<ul>
<li><strong>Magnetic mount:</strong> industrial-grade magnets rated to hold up to 2.5&nbsp;kg</li>
<li><strong>Material:</strong> water-resistant fabric with reinforced stitching</li>
<li><strong>Dimensions:</strong> 25&nbsp;cm W × 18&nbsp;cm H × 10&nbsp;cm D</li>
<li><strong>Compatibility:</strong> works on standard ferromagnetic (steel) gym racks, machines and equipment</li>
</ul>
<h3>Frequently Asked Questions</h3>
<p><strong>Will the magnet damage my phone or cards?</strong><br>No. The magnets hold the bag to metal equipment — not your devices. Modern phones, smartwatches and fitness trackers are unaffected, and contactless bank cards (which use chips/NFC) are safe. Keep any older magnetic-stripe cards in the front pocket to be doubly sure.</p>
<p><strong>How is this different from a regular gym bag?</strong><br>A standard bag takes up bench or locker space and ends up on a dusty floor. This one mounts straight onto your equipment, keeping everything within reach while freeing up your training space — built for active gym users who value organisation and efficiency.</p>
<p><strong>Do you deliver to all Emirates, and how fast?</strong><br>Yes — free next-day delivery across Dubai, Abu Dhabi, Sharjah, Ajman and the rest of the UAE. Cash on Delivery (COD) is available, making checkout simple and secure.</p>
<p><strong>How do I get the most out of it?</strong><br>Attach it to your chosen equipment at the start of your session, load your essentials into the pockets, and train hands-free. Most users mount it at chest or eye level for quick access between sets.</p>
<h3>Honest note</h3>
<p>The magnetic mount works best on standard steel gym equipment. Extremely lightweight aluminium machines and non-ferrous metals won't hold it — always check your equipment is magnetic before relying on the attachment.</p>
<h3>Order now</h3>
<p>Keep your essentials organised, within reach and off the floor. <strong>Get the hands-free magnetic gym bag</strong> — AED 110, with free next-day UAE delivery, Cash on Delivery and 14-day returns. Add it to your cart and train the way you want to.</p>
```

---

## What changed vs. the live copy

| Fix | Change made |
|---|---|
| **C-1** | Deleted the entire "Perfect Screen-Free Gift" section and all parents / grandparents / aunties / back-to-school / Ramadan / "ages 14 and up" / gift-framing language. Removed the "suitable for teenagers" FAQ. The page now speaks to one buyer: the lifter. |
| **C-2** | "magnetic closure" → "magnetic mount" everywhere (lead, first bullet, specs, FAQ, honest note). The mechanism is now unambiguous: it sticks the bag to metal, it doesn't shut the bag. |
| **C-3** | FAQ "2–4 business days" replaced with **next-day**; lead and FAQ now agree. |
| **C-4** | Closing CTA is now value-loaded ("Get the hands-free magnetic gym bag") with the COD + free next-day + 14-day-returns reassurance. No installment copy (none available). |
| **H-3** | New benefit-led H1/H2 leading with the mount + off-the-floor payoff; "Magnetic" retained in the headline. |
| **H-4** | Capacity stated honestly (phone/keys/wallet/small towel/snacks/slim bottle; "a mount, not a duffel"). |
| **H-5** | "wet/dry compartment" deleted (dry only); "weatherproof" → consistent "water-resistant". |
| **M-3** | Dropped the unverifiable "UAE's only" absolute. |

## Deliberately held for later phases (need open facts)
- **UGC / reviews block (H-1)** — needs real customer reviews.
- **Technical neodymium safety claim (H-2)** — current FAQ is truthful without naming the magnet type; strengthen once V-3 confirms neodymium.
- **Warranty line (M-4)** — N/A: confirmed **no warranty**, so no warranty claim will be added; durability reassurance stays on the 14-day returns + proof.
- **Magnet hold-strength demo image, flat-lay "what fits" image** — creative assets, not copy.

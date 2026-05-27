#!/usr/bin/env python3
import os
import json

BASE = "/home/user/TT360-Dev/policy-redesign"
APPLIED = os.path.join(BASE, "applied")
VARS = os.path.join(BASE, "vars")
os.makedirs(VARS, exist_ok=True)

# vars_handle | gid | title | isPublished | title_tag | description_tag | applied source file
PAGES = [
    ("refund-policy", "gid://shopify/Page/121299042419",
     "Refund & Return Policy | TipTop360 UAE", True,
     "Refund & Return Policy UAE | TipTop360",
     "TipTop360 refund & return policy for the UAE: 3-day returns on unused sealed items, refunds in 5-7 days, COD bank-transfer refunds. UAE Federal Law No. 15 of 2020.",
     "refund-policy.html"),
    ("shipping-policy-page", "gid://shopify/Page/119006494835",
     "Shipping & Delivery Policy | TipTop360 UAE", True,
     "Shipping & Delivery Policy UAE | TipTop360",
     "TipTop360 delivers to all 7 Emirates with 1-2 day delivery and Cash on Delivery. Processing times, fees, tracking and delivery details.",
     "shipping-policy.html"),
    ("gdpr-privacy-policy", "gid://shopify/Page/108536496243",
     "Privacy Policy | TipTop360 UAE", True,
     "Privacy Policy | TipTop360 UAE (GDPR-ready)",
     "How TipTop360 collects, uses and protects your personal data. UAE PDPL aligned and GDPR-ready. We never sell your data - request access or deletion anytime.",
     "gdpr-privacy-policy.html"),
    ("lgpd-privacy-policy", "gid://shopify/Page/108536529011",
     "Privacy Policy | TipTop360", True,
     "Privacy Policy | TipTop360",
     "TipTop360 privacy policy: what data we collect, why, and your rights (UAE PDPL, GDPR, LGPD). We never sell your personal data.",
     "lgpd-privacy-policy.html"),
    ("ccpa-privacy-policy", "gid://shopify/Page/108536561779",
     "Privacy Policy (California / CCPA) | TipTop360", False,
     "Privacy Policy - California CCPA | TipTop360",
     "TipTop360 privacy policy with California CCPA/CPRA rights. We never sell your personal information.",
     "ccpa-privacy-policy.html"),
    ("appi-privacy-policy", "gid://shopify/Page/108536463475",
     "Privacy Policy (Japan / APPI) | TipTop360", False,
     "Privacy Policy - Japan APPI | TipTop360",
     "TipTop360 privacy policy with Japan APPI rights. We never sell your personal data.",
     "appi-privacy-policy.html"),
    ("pipeda-privacy-policy", "gid://shopify/Page/108536430707",
     "Privacy Policy (Canada / PIPEDA) | TipTop360", False,
     "Privacy Policy - Canada PIPEDA | TipTop360",
     "TipTop360 privacy policy with Canada PIPEDA rights. We never sell your personal data.",
     "pipeda-privacy-policy.html"),
]

for vh, gid, title, pub, ttag, dtag, src in PAGES:
    with open(os.path.join(APPLIED, src), "r", encoding="utf-8") as f:
        body = f.read()
    variables = {
        "id": gid,
        "page": {
            "title": title,
            "body": body,
            "isPublished": pub,
            "metafields": [
                {"namespace": "global", "key": "title_tag", "value": ttag, "type": "single_line_text_field"},
                {"namespace": "global", "key": "description_tag", "value": dtag, "type": "single_line_text_field"},
            ],
        },
    }
    out = os.path.join(VARS, vh + ".json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(variables, f, ensure_ascii=False)
    print(f"{vh}: body={len(body.encode('utf-8'))}B pub={pub} -> {out}")

print("DONE")

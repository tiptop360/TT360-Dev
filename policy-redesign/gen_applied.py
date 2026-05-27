#!/usr/bin/env python3
import os
import sys

BASE = "/home/user/TT360-Dev/policy-redesign"
APPLIED = os.path.join(BASE, "applied")
os.makedirs(APPLIED, exist_ok=True)

SUB_A = "and, for international shoppers, with the EU GDPR."
SUB_B = "<p>To exercise any of these rights, contact us using the details below."

# Non-privacy pages: straight copies
COPIES = {
    "refund-policy": "refund-policy.html",
    "shipping-policy": "shipping-policy.html",
}

# Privacy variants
VARIANTS = {
    "gdpr-privacy-policy": {
        "A": "and, for international shoppers, with the EU General Data Protection Regulation (GDPR).",
        "B": "<p><strong>EU &amp; EEA visitors (GDPR):</strong> If you are in the European Union or EEA, you also have the right to object to or restrict processing, to data portability, and to lodge a complaint with your local data protection authority under the General Data Protection Regulation.</p>",
    },
    "lgpd-privacy-policy": {
        "A": "and, for international shoppers, with frameworks such as the EU GDPR and Brazil&rsquo;s LGPD.",
        "B": "<p><strong>Brazil (LGPD):</strong> If you are in Brazil, the Lei Geral de Prote&ccedil;&atilde;o de Dados (Law No. 13.709/2018) also gives you the right to confirm processing and to access, correct, anonymise, port, or delete your personal data, and to be told with whom we share it.</p>",
    },
    "ccpa-privacy-policy": {
        "A": "and, for international shoppers, with frameworks such as the EU GDPR and California&rsquo;s CCPA/CPRA.",
        "B": "<p><strong>California (CCPA/CPRA):</strong> If you are a California resident, you have the right to know what personal information we collect, to request its deletion or correction, and to opt out of the sale or sharing of personal information. We do not sell your personal information.</p>",
    },
    "appi-privacy-policy": {
        "A": "and, for international shoppers, with frameworks such as the EU GDPR and Japan&rsquo;s APPI.",
        "B": "<p><strong>Japan (APPI):</strong> If you are in Japan, the Act on the Protection of Personal Information gives you the right to request disclosure, correction, and the cessation of use of your personal data.</p>",
    },
    "pipeda-privacy-policy": {
        "A": "and, for international shoppers, with frameworks such as the EU GDPR and Canada&rsquo;s PIPEDA.",
        "B": "<p><strong>Canada (PIPEDA):</strong> If you are in Canada, the Personal Information Protection and Electronic Documents Act gives you the right to access your personal information and to challenge its accuracy.</p>",
    },
}

errors = []

# Copies
for handle, src in COPIES.items():
    with open(os.path.join(BASE, src), "r", encoding="utf-8") as f:
        content = f.read()
    out = os.path.join(APPLIED, handle + ".html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"COPY  {handle}: {len(content.encode('utf-8'))} bytes -> {out}")

# Privacy source
with open(os.path.join(BASE, "privacy-policy.html"), "r", encoding="utf-8") as f:
    privacy = f.read()

# Sanity: each substring must appear exactly once in the source
ca = privacy.count(SUB_A)
cb = privacy.count(SUB_B)
print(f"Source occurrences -> SUB_A: {ca}, SUB_B: {cb}")
if ca != 1:
    errors.append(f"SUB_A appears {ca} times in source (expected 1)")
if cb != 1:
    errors.append(f"SUB_B appears {cb} times in source (expected 1)")

for handle, cfg in VARIANTS.items():
    text = privacy
    if SUB_A not in text:
        errors.append(f"{handle}: SUB_A not found")
        continue
    if SUB_B not in text:
        errors.append(f"{handle}: SUB_B not found")
        continue
    # Replacement A
    text = text.replace(SUB_A, cfg["A"], 1)
    # Replacement B: insert CLAUSE_B immediately before SUB_B
    text = text.replace(SUB_B, cfg["B"] + "\n" + SUB_B, 1)
    # Verify results
    ok_a = cfg["A"] in text
    ok_b = (cfg["B"] + "\n" + SUB_B) in text
    leftover_a = SUB_A in text  # original A clause should be gone
    if not ok_a:
        errors.append(f"{handle}: CLAUSE_A not present after replace")
    if not ok_b:
        errors.append(f"{handle}: CLAUSE_B not inserted correctly")
    out = os.path.join(APPLIED, handle + ".html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"VARIANT {handle}: {len(text.encode('utf-8'))} bytes | A_ok={ok_a} B_ok={ok_b} origA_gone={not leftover_a} -> {out}")

if errors:
    print("\nERRORS:")
    for e in errors:
        print("  - " + e)
    sys.exit(1)
else:
    print("\nALL OK")

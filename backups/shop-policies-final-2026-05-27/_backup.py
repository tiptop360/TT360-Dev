import json, sys

raw = open('/home/user/TT360-Dev/backups/shop-policies-final-2026-05-27/_raw.json').read()
data = json.loads(raw)
policies = data['data']['shop']['shopPolicies']
outdir = '/home/user/TT360-Dev/backups/shop-policies-final-2026-05-27/'
for p in policies:
    t = p['type'].lower()
    fn = outdir + 'shop-' + t + '.html'
    with open(fn, 'w') as f:
        f.write(p['body'])
    print(fn, len(p['body']))

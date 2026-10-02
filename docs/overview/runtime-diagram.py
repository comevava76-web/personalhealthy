# Generates docs/overview/runtime-flow.svg: how a request travels, from the phone to the database and the backup.
# Run from the repository root; pasted into overview.html section 4.
W, H = 720, 330
o = [f'<svg viewBox="0 0 {W} {H}" width="100%" font-family="Arial" font-size="8" style="margin:4pt 0 2pt">',
     '<defs><marker id="rf" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#5B6B88"/></marker></defs>']
C = {'person': ('#EDE9FB', '#6D5BD0'), 'cf': ('#E6EEFA', '#2E66AE'), 'data': ('#E2F5F2', '#0F9C8E'), 'once': ('#FFF4DE', '#B7860B'), 'ext': ('#EEF1F5', '#5B6B88')}
def box(x, y, w, h, kind, lines, dashed=False):
    f, s = C[kind]; d = ' stroke-dasharray="4 3"' if dashed else ''
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{f}" stroke="{s}" stroke-width="1.2"{d}/>')
    ty = y + h / 2 - (len(lines) - 1) * 5.4 + 3
    for i, l in enumerate(lines):
        b = ' font-weight="bold" font-size="8.6"' if i == 0 else ''
        o.append(f'<text x="{x + w / 2}" y="{ty + i * 10.8}" text-anchor="middle" fill="#13223F"{b}>{l}</text>')
def arrow(pts, dashed=False):
    d = ' stroke-dasharray="4 3"' if dashed else ''
    o.append(f'<path d="M{" L".join(f"{a} {b}" for a, b in pts)}" fill="none" stroke="#5B6B88" stroke-width="1.2"{d} marker-end="url(#rf)"/>')
def label(x, y, t, anchor='middle'):
    o.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="7.4" fill="#5B6B88">{t}</text>')
# blocks
box(10, 70, 130, 70, 'person', ['1 · App on the phone', 'Android (from Google Play)', 'iPhone (App Store, later)', 'the person'])
box(10, 175, 130, 62, 'person', ['1 · Web browser', 'Web Dashboard', 'the person, the doctor\'s link'])
box(200, 18, 150, 50, 'once', ['Domain (bought on GoDaddy)', 'its name servers point to Cloudflare'], dashed=True)
box(200, 110, 150, 96, 'cf', ['2 · Cloudflare network', 'DNS: name → address', 'HTTPS: certificate, encryption', 'protection, the nearest', 'data centre answers'])
box(400, 110, 140, 96, 'cf', ['3 · Worker = our server', 'the program in TypeScript:', 'API for the app and', 'the Web Dashboard pages', 'no Tomcat, no nginx'])
box(590, 110, 120, 96, 'data', ['4 · D1 database (EU)', 'accounts, readings,', 'lab results, settings', '+ copy of acceptances', 'Time Travel: 7 days'])
box(590, 250, 120, 66, 'data', ['5 · Nightly backup', '01:40 UTC, encrypted', 'vault database (EU)', 'last 30 nights'])
box(400, 250, 140, 66, 'ext', ['Outside services', 'Google: sign-in, Play', 'Anthropic: reads the', 'Scan photo (AI)'], dashed=True)
# arrows and labels in the gaps
arrow([(140, 105), (170, 105), (170, 140), (198, 140)]); label(170, 99, 'HTTPS')
arrow([(140, 206), (170, 206), (170, 176), (198, 176)]); label(170, 222, 'HTTPS')
arrow([(275, 68), (275, 108)], dashed=True); label(280, 92, 'set once', 'start')
arrow([(350, 158), (398, 158)]); label(374, 152, 'request')
arrow([(540, 158), (588, 158)]); label(564, 152, 'SQL')
arrow([(650, 206), (650, 248)]); label(655, 230, 'every night', 'start')
arrow([(470, 206), (470, 248)], dashed=True); label(475, 230, 'when needed', 'start')
o.append('</svg>')
open('docs/overview/runtime-flow.svg', 'w').write('\n'.join(o))
print('ok')

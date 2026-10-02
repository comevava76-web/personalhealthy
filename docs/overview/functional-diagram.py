# Generates the functional workflow of HINT 365 (what a person can do, as actions, no technology), in the app's
# palette, never red: docs/overview/functional-flow.svg (used in overview section 3 and architecture page 1) and
# docs/overview/HINT365-workflow.png (1600x900, for presentations and LinkedIn: python3 + playwright render).
# Run from the repository root.
W, H = 1200, 675
o = []
add = o.append
add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="100%" font-family="Inter, Segoe UI, Roboto, Arial, sans-serif">')
add('''<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1630"/><stop offset="1" stop-color="#14305A"/></linearGradient>
 <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8C7BF2"/><stop offset="1" stop-color="#1FC7B5"/></linearGradient>
 <linearGradient id="accv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8C7BF2"/><stop offset="1" stop-color="#1FC7B5"/></linearGradient>
 <linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".10"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".04"/></linearGradient>
 <linearGradient id="diary" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1FC7B5" stop-opacity=".30"/><stop offset="1" stop-color="#8C7BF2" stop-opacity=".18"/></linearGradient>
 <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1FC7B5" stop-opacity=".35"/><stop offset="1" stop-color="#1FC7B5" stop-opacity="0"/></radialGradient>
 <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#FFFFFF" fill-opacity=".05"/></pattern>
 <marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#1FC7B5"/></marker>
</defs>''')
add(f'<rect width="{W}" height="{H}" fill="url(#bg)"/><rect width="{W}" height="{H}" fill="url(#dots)"/>')
add('<circle cx="615" cy="330" r="230" fill="url(#glow)"/>')
# header
add('<text x="30" y="58" font-size="34" font-weight="800" fill="#FFFFFF" letter-spacing="2">HINT 365</text>')
add('<rect x="30" y="70" width="128" height="4" rx="2" fill="url(#acc)"/>')
add('<text x="212" y="57" font-size="19" fill="#C9D4EA">Your blood-pressure and lab-results diary · how it works</text>')
for i, t in enumerate(['Private', 'Data in the EU', 'No diagnosis']):
    x = 885 + i * 100 - (8 if i == 2 else 0)
    w = 92 if i != 1 else 112
    x = [890, 990, 1110][i] - 0
    add(f'<rect x="{x}" y="38" width="{[92,112,62][i]+0}" height="26" rx="13" fill="none" stroke="#1FC7B5" stroke-opacity=".7"/>')
for x, t in [(936, 'Private'), (1046, 'Data in the EU'), (1141, 'No ads')]:
    add(f'<text x="{x}" y="56" text-anchor="middle" font-size="12" fill="#BDF3EC">{t}</text>')

ICON = {
 'phone': '<rect x="-7" y="-11" width="14" height="22" rx="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="0" cy="7" r="1.4" fill="#fff"/>',
 'user': '<circle cx="0" cy="-4" r="4.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M-8,9 C-8,2 8,2 8,9" fill="none" stroke="#fff" stroke-width="2"/>',
 'terms': '<path d="M-7,-11 H4 L8,-7 V11 H-7 Z" fill="none" stroke="#fff" stroke-width="2"/><path d="M-3,2 L0,5 L5,-1" fill="none" stroke="#fff" stroke-width="2"/>',
 'mic': '<rect x="-4" y="-11" width="8" height="13" rx="4" fill="none" stroke="#fff" stroke-width="2"/><path d="M-8,-1 C-8,8 8,8 8,-1 M0,7 V11" fill="none" stroke="#fff" stroke-width="2"/>',
 'lab': '<path d="M-7,-11 H4 L8,-7 V11 H-7 Z" fill="none" stroke="#fff" stroke-width="2"/><path d="M-3,-3 H4 M-3,1 H4 M-3,5 H2" stroke="#fff" stroke-width="2"/>',
 'shield': '<path d="M0,-12 L10,-8 V0 C10,7 5,11 0,13 C-5,11 -10,7 -10,0 V-8 Z" fill="none" stroke="#fff" stroke-width="2"/><path d="M-4,0 L-1,3 L5,-3" fill="none" stroke="#fff" stroke-width="2"/>',
 'chart': '<path d="M-9,10 H9" stroke="#fff" stroke-width="2"/><rect x="-7" y="0" width="4" height="8" fill="#fff"/><rect x="-1" y="-6" width="4" height="14" fill="#fff"/><rect x="5" y="-2" width="4" height="10" fill="#fff"/>',
 'down': '<path d="M0,-10 V5 M-6,-1 L0,5 L6,-1 M-9,10 H9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
 'share': '<circle cx="-6" cy="0" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="6" cy="-7" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="6" cy="7" r="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M-3,-1.5 L3,-5.5 M-3,1.5 L3,5.5" stroke="#fff" stroke-width="2"/>',
 'doc': '<circle cx="0" cy="0" r="10" fill="none" stroke="#fff" stroke-width="2"/><path d="M0,-5 V5 M-5,0 H5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
 'trash': '<path d="M-7,-6 H7 M-3,-6 V-9 H3 V-6 M-5,-6 L-4,10 H4 L5,-6" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
}
def card(x, y, w, h, icon, title, lines, tone='#8C7BF2', num=None, fill='url(#card)'):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" stroke="{tone}" stroke-opacity=".55" stroke-width="1.3"/>')
    cx, cy = x + 34, y + 36
    add(f'<circle cx="{cx}" cy="{cy}" r="19" fill="url(#acc)"/><g transform="translate({cx},{cy})">{ICON[icon]}</g>')
    if num: add(f'<circle cx="{x + w - 18}" cy="{y + 18}" r="10" fill="#FFFFFF" fill-opacity=".12"/><text x="{x + w - 18}" y="{y + 22}" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">{num}</text>')
    add(f'<text x="{x + 62}" y="{y + 41}" font-size="16.5" font-weight="700" fill="#FFFFFF">{title}</text>')
    for i, l in enumerate(lines):
        add(f'<text x="{x + 18}" y="{y + 72 + i * 17}" font-size="12.6" fill="#C9D4EA">{l}</text>')
def stage(x, w, t):
    add(f'<text x="{x + w / 2}" y="128" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="2.4" fill="#1FC7B5">{t}</text>')
def arrow(pts):
    add(f'<path d="M{" L".join(f"{a} {b}" for a, b in pts)}" fill="none" stroke="#1FC7B5" stroke-width="2" stroke-opacity=".85" marker-end="url(#ah)"/>')

X = {'start': 30, 'in': 268, 'diary': 520, 'out': 758, 'doc': 1000}
Wd = {'start': 210, 'in': 222, 'diary': 210, 'out': 212, 'doc': 170}
stage(X['start'], Wd['start'], 'GET STARTED'); stage(X['in'], Wd['in'], 'PUT DATA IN'); stage(X['diary'], Wd['diary'], 'YOUR DIARY')
stage(X['out'], Wd['out'], 'GET VALUE OUT'); stage(X['doc'], Wd['doc'], 'YOUR DOCTOR')
# column 1
cy = [148, 288, 428]
card(X['start'], cy[0], 210, 120, 'phone', 'Install', ['the app on Android', '(iPhone coming next)'], num=1)
card(X['start'], cy[1], 210, 120, 'user', 'Sign in', ['with your Google account:', 'same data on a new phone'], num=2)
card(X['start'], cy[2], 210, 120, 'terms', 'Accept the terms', ['read to the end,', 'save them as a PDF'], num=3)
arrow([(135, 268), (135, 286)]); arrow([(135, 408), (135, 426)])
# column 2
card(X['in'], 168, 222, 160, 'mic', 'Record a reading', ['Say it aloud, or snap the', 'monitor\'s display (AI Scan).', 'Check the three numbers,', 'then confirm.'])
card(X['in'], 368, 222, 160, 'lab', 'Import a lab report', ['Pick a PDF or a photo.', 'Read on your phone: only', 'the date and the values', 'are kept, never your name.'])
arrow([(240, 488), (254, 488), (254, 248), (266, 248)]); arrow([(240, 498), (258, 498), (258, 448), (266, 448)])
# diary
add(f'<rect x="{X["diary"]}" y="148" width="210" height="300" rx="20" fill="url(#diary)" stroke="#1FC7B5" stroke-width="2"/>')
add(f'<circle cx="625" cy="196" r="28" fill="url(#acc)"/><g transform="translate(625,196) scale(1.4)">{ICON["shield"]}</g>')
add('<text x="625" y="252" text-anchor="middle" font-size="19" font-weight="800" fill="#FFFFFF">Your data</text>')
add('<text x="625" y="272" text-anchor="middle" font-size="13" fill="#BDF3EC">kept safe in the EU</text>')
for i, (a, b) in enumerate([('Readings', 'kept 365 days'), ('Lab results', 'until you delete them'), ('Only yours', 'nobody else sees them'), ('Backed up', 'every night, encrypted')]):
    y = 300 + i * 36
    add(f'<circle cx="546" cy="{y - 4}" r="3.5" fill="#1FC7B5"/><text x="558" y="{y}" font-size="13" font-weight="700" fill="#FFFFFF">{a}</text><text x="558" y="{y + 15}" font-size="11.6" fill="#C9D4EA">{b}</text>')
arrow([(490, 248), (518, 248)]); arrow([(490, 448), (505, 448), (505, 420), (518, 420)])
# delete under the diary
add(f'<rect x="{X["diary"]}" y="470" width="210" height="58" rx="14" fill="url(#card)" stroke="#9AAACA" stroke-opacity=".5"/>')
add(f'<g transform="translate(548,499)">{ICON["trash"]}</g>')
add('<text x="568" y="494" font-size="14" font-weight="700" fill="#FFFFFF">Delete anytime</text>')
add('<text x="568" y="511" font-size="11.6" fill="#C9D4EA">a reading, a date, or all</text>')
add('<path d="M625,470 V452" stroke="#9AAACA" stroke-width="2" marker-end="url(#ah)"/>')
# column 4
oy = [148, 278, 408]
card(X['out'], oy[0], 212, 110, 'chart', 'See', ['your week at a glance,', 'charts and lab table'], tone='#1FC7B5')
card(X['out'], oy[1], 212, 110, 'down', 'Download', ['the report as a PDF,', 'saved on your phone'], tone='#1FC7B5')
card(X['out'], oy[2], 212, 120, 'share', 'Share', ['send the PDF and a', 'private link (7 days)', 'by email or WhatsApp'], tone='#1FC7B5')
for y in (203, 333, 463):
    arrow([(730, 300 if y != 463 else 400), (744, 300 if y != 463 else 400), (744, y), (756, y)])
# doctor
card(X['doc'], 408, 170, 120, 'doc', 'Doctor', ['opens the link,', 'reads only,', 'you can withdraw it'], tone='#8C7BF2')
arrow([(970, 468), (998, 468)])
# promise strip
add('<rect x="30" y="566" width="1140" height="74" rx="18" fill="#FFFFFF" fill-opacity=".06" stroke="url(#acc)" stroke-width="1.5"/>')
add('<text x="600" y="597" text-anchor="middle" font-size="21" font-weight="800" fill="#FFFFFF">Record in seconds · See your week · Share with your doctor</text>')
add('<text x="600" y="623" text-anchor="middle" font-size="13" fill="#C9D4EA">HINT 365 keeps track of what you record. It gives no diagnosis and no advice: your doctor decides.</text>')
add('<text x="1170" y="660" text-anchor="end" font-size="11" fill="#7F90B4">HINT 365 · HealthyInstantTracker</text>')
add('</svg>')
svg = '\n'.join(o)
open('docs/overview/functional-flow.svg', 'w').write(svg)
open('/tmp/hint365-workflow.html', 'w').write('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0B1630}</style>' + svg.replace('width="100%"', 'width="1600" height="900"'))
print('ok')

# Generates docs/overview/deploy-android.svg and deploy-ios.svg: the release of a new version, who does what and when.
# Swimlanes (one column per actor), time going down, the time each step takes on the left. Run from the repository root.
LANES = [('Owner (Human)', '#FFF4DE', '#B7860B'), ('Developer (Claude)', '#E2F5F2', '#0F9C8E'),
         ('GitHub', '#E6EEFA', '#2E66AE'), ('Cloudflare', '#E6EEFA', '#2E66AE'),
         ('Store', '#EEF1F5', '#5B6B88'), ('Phone of the person', '#EDE9FB', '#6D5BD0')]
GUT, LW, TOP, BH, GAP = 78, 110, 44, 42, 16
W = GUT + LW * len(LANES) + 6

def diagram(steps, path, store):
    LANES[4] = (store, LANES[4][1], LANES[4][2])
    H = TOP + len(steps) * (BH + GAP) + 10
    o = [f'<svg viewBox="0 0 {W} {H}" width="100%" font-family="Arial" font-size="7.4">',
         '<defs><marker id="ar" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#5B6B88"/></marker></defs>']
    # lanes
    for i, (name, f, s) in enumerate(LANES):
        x = GUT + i * LW
        o.append(f'<rect x="{x+2}" y="{TOP-6}" width="{LW-4}" height="{H-TOP+2}" fill="{f}" opacity=".35" rx="4"/>')
        o.append(f'<rect x="{x+2}" y="4" width="{LW-4}" height="26" rx="5" fill="{f}" stroke="{s}"/>')
        o.append(f'<text x="{x+LW/2}" y="20.5" text-anchor="middle" font-weight="bold" font-size="8" fill="#13223F">{name}</text>')
    o.append(f'<text x="4" y="20.5" font-weight="bold" font-size="8" fill="#13223F">When</text>')
    prev = None
    for k, (lane, lines, when, mark) in enumerate(steps):
        y = TOP + k * (BH + GAP); x = GUT + lane * LW + 7; w = LW - 14
        f, s = LANES[lane][1], LANES[lane][2]
        if prev:
            px, py = prev
            cx = x + w / 2
            if abs(px - cx) < 1: o.append(f'<path d="M{px} {py} L{cx} {y-1}" stroke="#5B6B88" fill="none" marker-end="url(#ar)"/>')
            else:
                my = py + GAP / 2
                o.append(f'<path d="M{px} {py} L{px} {my} L{cx} {my} L{cx} {y-1}" stroke="#5B6B88" fill="none" marker-end="url(#ar)"/>')
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{BH}" rx="5" fill="#fff" stroke="{s}" stroke-width="1.2"/>')
        o.append(f'<rect x="{x}" y="{y}" width="4" height="{BH}" rx="2" fill="{s}"/>')
        ty = y + BH / 2 - (len(lines) - 1) * 4.6 + 2.6
        for j, l in enumerate(lines):
            wt = ' font-weight="bold"' if j == 0 else ''
            o.append(f'<text x="{x+w/2+2}" y="{ty+j*9.2}" text-anchor="middle"{wt} fill="#13223F">{l}</text>')
        if mark:
            o.append(f'<circle cx="{x+w-3}" cy="{y+3}" r="8" fill="#0F9C8E"/><path d="M{x+w-7} {y+3} l3 3.4 l5.5 -6.4" stroke="#fff" stroke-width="1.8" fill="none"/>')
        o.append(f'<text x="4" y="{y+BH/2-1}" font-size="7" font-weight="bold" fill="#13223F">{when[0]}</text>')
        if len(when) > 1: o.append(f'<text x="4" y="{y+BH/2+8}" font-size="6.6" fill="#5B6B88">{when[1]}</text>')
        prev = (x + w / 2, y + BH)
    o.append('</svg>')
    open(path, 'w').write('\n'.join(o))

O, D, G, C, S, P = range(6)
android = [
    (O, ['Asks for a change', 'in the chat'], ['Day 0', 'start'], False),
    (D, ['Code, tests, docs', 'on a branch, PR'], ['+ min to hours', 'size of the change'], False),
    (G, ['Checks on the PR', 'tests · app · docs'], ['+ 10 min', 'all green'], True),
    (O, ['Says "go"', 'approves terms text'], ['when ready', 'binding texts: owner'], False),
    (D, ['Merges into main'], ['+ 1 min', ''], False),
    (G, ['Build', 'tests, signed APK + AAB'], ['+ 12 min', 'release v0.1.N kept'], False),
    (C, ['Server + Web live', 'web done: no update'], ['same minute', 'web users: nothing to do'], True),
    (O, ['Uploads the AAB', 'Play Console: production'], ['when ready', 'after testing it'], False),
    (S, ['Google review', 'Google Play checks it'], ['+ hours to 3 days', 'decided by Google'], True),
    (S, ['Published to all', 'rollout 20% → 100%'], ['+ 1-2 days', 'owner raises %'], False),
    (C, ['Version N required', 'read from Google Play'], ['within 1 hour', 'hourly check'], False),
    (P, ['Opens the app', 'Google update window'], ['next time', 'opened by the person'], False),
    (P, ['Update and install', 'data stay'], ['~ 1 minute', 'Wi-Fi or mobile'], False),
    (P, ['Accepts the terms', 'if they changed (scroll)'], ['~ 1 minute', 'recorded + backup'], False),
    (P, ['Works on version N'], ['done', ''], True),
]
ios = [
    (O, ['Says "go"', 'same as Android'], ['Day 0', 'after the checks'], False),
    (G, ['Build for iPhone', 'signed IPA'], ['+ 15 min', '(no iOS app yet)'], False),
    (O, ['Uploads the build', 'App Store Connect'], ['when ready', 'TestFlight test'], False),
    (S, ['Apple review', 'App Store checks it'], ['+ 1-2 days', 'decided by Apple'], True),
    (S, ['Published to all', 'phased release'], ['+ up to 7 days', 'Apple: 1% → 100%'], False),
    (C, ['Version N required', 'read from App Store'], ['within 1 hour', 'to be built'], False),
    (P, ['Opens the app', 'App Store update'], ['next time', ''], False),
    (P, ['Accepts the terms', 'if they changed'], ['~ 1 minute', ''], False),
    (P, ['Works on version N'], ['done', ''], True),
]
diagram(android, 'docs/overview/deploy-android.svg', 'Google Play')
diagram(ios, 'docs/overview/deploy-ios.svg', 'Apple App Store')
print('ok')

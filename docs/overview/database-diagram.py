# Generates docs/overview/database-diagram.svg (crow's foot notation), pasted into overview.html section 4. Run from the repository root.
RH, HH, FS = 10.6, 15, 7.2
T = {  # table: columns (PK = primary key, FK = foreign key declared, ~ = same id kept by the server, no constraint)
 'persons': ['id PK','public_key','google_sub (fingerprint)','email (always empty)','birth_date','sex','is_admin','pays','consent_at','sub_token','sub_until','sub_state','sub_checked_at','last_seen_at','app_version','created_at'],
 'measurements': ['id PK','person_id FK','kind (bp / lab)','taken_at, tz, period','data (the values)','source','scan_id ~','lab, city','created_at'],
 'lab_files': ['person_id FK','file_hash (HMAC)','measurement_id ~','created_at'],
 'scans': ['id PK','person_id FK','kind, result','taken_at','used','created_at'],
 'acceptances': ['id PK','person_id ~','device (fingerprint)','phone (model)','doc, version, lang','text_sha256','app_version','accepted_at'],
 'person_keys': ['person_id PK FK','sealed_key','status, checked_at','created_at'],
 'scan_usage': ['person_id PK ~','window_start','scans','micro_usd'],
 'acceptances_backup': ['id PK','person_id','google_fp','device, phone','doc, version, lang','text_sha256','accepted_at','copied_at'],
 'web_codes': ['code_hash PK','person_id ~','expires_at','owner'],
 'web_sessions': ['id_hash PK','person_id ~','expires_at','owner'],
 'web_shares': ['token_hash PK','person_id ~','date_from, date_to','expires_at'],
 'ledger': ['seq PK','person_id ~','kind, amount_micro','payer, scan_id ~','created_at'],
 'invites': ['code PK','type','created_by ~','used_by ~','expires_at, used_at'],
 'error_log': ['day, source, code, place','app_version  (PK)','count, first/last_at','message','person_id ~ (optional)'],
 'security_findings': ['kind, ref, name, location PK','version','severity, rating','fixed, summary','found_at'],
 'security_notes': ['kind, ref, name, location PK','first_at','reason'],
 'security_fixes': ['kind, ref, name, location PK','status, note (unused)'],
 'security_fix_requests': ['id PK','(unused: Fix button removed)'],
 'settings': ['key PK','value'],
 'seen_sigs': ['sig_hash PK','expires_at'],
 'scan_trials': ['fp PK (fingerprint)','started_at'],
 'rate_limits': ['key PK','window_start, count'],
 'ai_spend_daily': ['day PK','scans, micro_usd'],
 'sub_sales_daily': ['day PK','sales, gross_cents'],
 'event_log': ['day, code, place','app_version (PK)','count'],
}
pos = {}
def h(t): return HH + RH*len(T[t]) + 4
def place(t, x, y, w): pos[t] = (x, y, w, h(t))
W = 720
place('persons', 275, 40, 170)
place('measurements', 14, 40, 160); place('lab_files', 14, 40+h('measurements')+34, 160); place('scans', 14, pos['lab_files'][1]+h('lab_files')+34, 160)
place('acceptances', 540, 40, 160); place('person_keys', 540, 40+h('acceptances')+34, 160); place('scan_usage', 540, pos['person_keys'][1]+h('person_keys')+34, 160)
bot = max(pos[t][1]+pos[t][3] for t in pos)
yb = max(bot, 40+h('persons')) + 70
xs = [8, 128, 248, 368, 488, 608]
for x, t in zip(xs, ['web_codes','web_sessions','web_shares','ledger','invites','error_log']): place(t, x, yb, 104)
y2 = max(pos[t][1]+pos[t][3] for t in pos) + 62
place('acceptances_backup', 540, y2, 160)
place('security_findings', 14, y2, 150); place('security_notes', 214, y2, 140); place('security_fixes', 214, y2+h('security_notes')+24, 140)
place('security_fix_requests', 390, y2, 130)
y3 = max(pos[t][1]+pos[t][3] for t in pos) + 50
sa = ['settings','seen_sigs','scan_trials','rate_limits','ai_spend_daily','sub_sales_daily','event_log']
for i, t in enumerate(sa): place(t, 8 + (i % 4) * 178, y3 + (i // 4) * 62, 166)
H = max(pos[t][1]+pos[t][3] for t in pos) + 12

col = {'p':('#EDE9FB','#6D5BD0'), 'x':('#E6EEFA','#2E66AE'), 's':('#FFF4DE','#B7860B'), 'b':('#E2F5F2','#0F9C8E')}
kind = {t:'p' for t in T}
for t in ['security_findings','security_notes','security_fixes','security_fix_requests']: kind[t]='s'
for t in sa: kind[t]='x'
kind['acceptances_backup']='b'
out = [f'<svg viewBox="0 0 {W} {H}" width="100%" style="margin:4pt 0 2pt" font-family="Arial" font-size="{FS}">']
def sec(y, text): out.append(f'<text x="8" y="{y}" font-size="9" font-weight="bold" fill="#13223F">{text}</text>')
sec(24, 'Personal data: every table linked to persons (one account)')
sec(y2-22, 'Backup database · Security (Observability)')
sec(y3-14, 'Tables without relations')
for t,(x,y,w,hh) in pos.items():
    f, s = col[kind[t]]
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{hh}" rx="4" fill="#fff" stroke="{s}" stroke-width="1"/>')
    out.append(f'<path d="M{x} {y+4} a4 4 0 0 1 4 -4 h{w-8} a4 4 0 0 1 4 4 v{HH-4} h{-w} z" fill="{f}" stroke="{s}" stroke-width="1"/>')
    out.append(f'<text x="{x+6}" y="{y+10.5}" font-weight="bold" font-size="7.8" fill="#13223F">{t}</text>')
    for i, c in enumerate(T[t]):
        cy = y + HH + RH*i + 8
        fill = '#6D5BD0' if ' PK' in c else ('#0F9C8E' if ' FK' in c or ' ~' in c else '#3B4A66')
        out.append(f'<text x="{x+6}" y="{cy}" fill="{fill}">{c}</text>')
def end(x, y, dx, dy, many):
    # (x,y) on the box edge, (dx,dy) pointing into the box
    px, py = -dy, dx
    if many:
        bx, by = x - dx*9, y - dy*9
        for k in (-4.5, 0, 4.5):
            out.append(f'<line x1="{bx}" y1="{by}" x2="{x+px*k}" y2="{y+py*k}" stroke="#3B4A66" stroke-width="1"/>')
        cx, cy = x - dx*12, y - dy*12
        out.append(f'<line x1="{cx+px*4}" y1="{cy+py*4}" x2="{cx-px*4}" y2="{cy-py*4}" stroke="#3B4A66" stroke-width="1"/>')
    else:
        for o in (6, 10):
            cx, cy = x - dx*o, y - dy*o
            out.append(f'<line x1="{cx+px*4}" y1="{cy+py*4}" x2="{cx-px*4}" y2="{cy-py*4}" stroke="#3B4A66" stroke-width="1"/>')
def path(pts, dashed):
    d = 'M' + ' L'.join(f'{a} {b}' for a, b in pts)
    da = ' stroke-dasharray="4 3"' if dashed else ''
    out.append(f'<path d="{d}" fill="none" stroke="#3B4A66" stroke-width="1"{da}/>')
def lbl(x, y, s, anchor='middle'):
    out.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="6.6" fill="#5B6B88">{s}</text>')
px, py, pw, ph = pos['persons']
# persons -> left column (1 to many)
for i, (t, ex) in enumerate([('measurements', 250), ('lab_files', 236), ('scans', 222)]):
    x, y, w, hh = pos[t]; ey = py + 24 + i*16; cy = y + 24
    path([(px, ey), (ex, ey), (ex, cy), (x+w, cy)], False); end(px, ey, 1, 0, False); end(x+w, cy, -1, 0, True)
lbl(225, py+18, 'person_id')
# persons -> right column
for i, (t, ex, many, dashed) in enumerate([('acceptances', 470, True, True), ('person_keys', 484, False, False), ('scan_usage', 498, False, True)]):
    x, y, w, hh = pos[t]; ey = py + 24 + i*16; cy = y + 24
    path([(px+pw, ey), (ex, ey), (ex, cy), (x, cy)], dashed); end(px+pw, ey, -1, 0, False); end(x, cy, 1, 0, many)
lbl(495, py+18, 'person_id')
# measurements 1-1 lab_files, scans 1-1 measurements (left edge)
mx, my, mw, mh = pos['measurements']; lx, ly, lw, lh = pos['lab_files']; sx, sy, sw, sh = pos['scans']
path([(mx+40, my+mh), (mx+40, ly)], True); end(mx+40, my+mh, 0, -1, False); end(mx+40, ly, 0, 1, True); lbl(mx+44, my+mh+20, 'measurement_id', 'start')
path([(sx, sy+20), (6, sy+20), (6, my+20), (mx, my+20)], True); end(sx, sy+20, 1, 0, False); end(mx, my+20, 1, 0, False)
# persons -> bottom row through a bus
busy = yb - 30
cxp = px + pw/2
path([(cxp, py+ph), (cxp, busy)], False); end(cxp, py+ph, 0, -1, False)
path([(xs[0]+53, busy), (xs[-1]+53, busy)], True)
for x0, t in zip(xs, ['web_codes','web_sessions','web_shares','ledger','invites','error_log']):
    x, y, w, hh = pos[t]
    path([(x+53, busy), (x+53, y)], True); end(x+53, y, 0, 1, True)
lbl(cxp+4, busy-6, 'person_id (created_by, used_by in invites)', 'start')
# acceptances -> backup (copy, other database), along the right edge
ax, ay, aw, ah = pos['acceptances']; bx, by, bw, bh = pos['acceptances_backup']
path([(ax+aw, ay+20), (716, ay+20), (716, by+20), (bx+bw, by+20)], True); end(ax+aw, ay+20, -1, 0, False); end(bx+bw, by+20, -1, 0, False)
lbl(712, by-6, 'copy, every night and at once', 'end')
# security
fx, fy, fw, fh = pos['security_findings']
for t in ['security_notes', 'security_fixes']:
    x, y, w, hh = pos[t]; ey = y + 20
    path([(fx+fw, fy+20 if t=='security_notes' else fy+36), (190, fy+20 if t=='security_notes' else fy+36), (190, ey), (x, ey)], True)
    end(fx+fw, fy+20 if t=='security_notes' else fy+36, -1, 0, False); end(x, ey, 1, 0, False)
out.append('</svg>')
open('docs/overview/database-diagram.svg', 'w').write('\n'.join(out))
print(H)

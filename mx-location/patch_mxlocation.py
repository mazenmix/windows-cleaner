from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'Locus-src').resolve()

# Keep the upstream target/scheme names intact; only change installed app identity.
project = root / 'project.yml'
text = project.read_text(encoding='utf-8')
text = text.replace('PRODUCT_BUNDLE_IDENTIFIER: com.chrismack.locus', 'PRODUCT_BUNDLE_IDENTIFIER: com.mazenmix.mxlocation')
text = text.replace('PRODUCT_NAME: Locus', 'PRODUCT_NAME: MXLocation')
project.write_text(text, encoding='utf-8')

plist = root / 'Locus/Resources/Info.plist'
text = plist.read_text(encoding='utf-8')
text = text.replace('<string>Locus</string>', '<string>MX Location</string>')
text = text.replace('Locus uses your real location', 'MX Location uses your real location')
text = text.replace('Locus keeps a light location session alive', 'MX Location keeps a light location session alive')
text = text.replace('Locus uses the local network', 'MX Location uses the local network')
text = text.replace('com.chrismack.locus.rppairing', 'com.mazenmix.mxlocation.rppairing')
text = text.replace('<string>com.chrismack.locus</string>', '<string>com.mazenmix.mxlocation</string>')
text = text.replace('<string>locus</string>', '<string>mxlocation</string>')
plist.write_text(text, encoding='utf-8')

# Rebrand only user-visible Swift literals; do not rename classes/symbols.
string_re = re.compile(r'"(?:\\.|[^"\\])*"')

def repl_literal(m):
    s = m.group(0)
    if any(k in s for k in ('com.chrismack.locus', 'locus://', 'LocusApp', 'Locus.')):
        return s
    return s.replace('Locus', 'MX Location')

for p in (root / 'Locus').rglob('*.swift'):
    src = p.read_text(encoding='utf-8')
    p.write_text(string_re.sub(repl_literal, src), encoding='utf-8')

(root / 'MX_LOCATION_NOTICE.md').write_text('''# MX Location\n\nCustomized derivative of the MIT-licensed Locus project.\nOriginal project: ChrisMack32/Locus\nBundle ID: com.mazenmix.mxlocation\n\nThe upstream DVT location engine, iOS 27 on-device pairing path, LocalDevVPN support, map search, teleport, favorites, recents, joystick, routes and GPX support are retained.\n''', encoding='utf-8')

print('MX Location customization applied to', root)

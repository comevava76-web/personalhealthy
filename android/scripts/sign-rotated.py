#!/usr/bin/env python3
"""Sign the release APK with the public rotation lineage; never print signing passwords."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[2]
base = 'bc1301f8e74d0be4a15c6e310d9fbb36d2d7e508'
new_key = Path(os.environ['HINT_KEYSTORE_FILE']).resolve()
if not new_key.is_file():
    raise SystemExit('Private signing keystore is required')
new_password = os.environ['ANDROID_KEYSTORE_PASSWORD']
new_key_password = os.environ['ANDROID_KEY_PASSWORD']
sdk = Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
apksigner = sdk / 'build-tools' / '34.0.0' / 'apksigner'
source = repo / 'android/app/build/outputs/apk/release/app-release.apk'
lineage = repo / 'docs/signing/lineage.bin'
with tempfile.TemporaryDirectory(prefix='hint-sign-') as directory:
    temp = Path(directory)
    old_key = temp / 'legacy.keystore'
    old_key.write_bytes(subprocess.check_output(['git', 'show', f'{base}:android/app/personalhealthy.keystore'], cwd=repo))
    old_key.chmod(0o600)
    old_config = subprocess.check_output(['git', 'show', f'{base}:android/app/build.gradle.kts'], cwd=repo, text=True)
    old_password = re.search(r'storePassword = "([^"]+)"', old_config).group(1)
    env = os.environ.copy()
    env.update(HINT_LEGACY_PASS=old_password, HINT_NEW_PASS=new_password, HINT_NEW_KEY_PASS=new_key_password)
    output = temp / 'rotated.apk'
    subprocess.run([str(apksigner), 'sign', '--ks', str(old_key), '--ks-key-alias', 'battito',
                    '--ks-pass', 'env:HINT_LEGACY_PASS', '--next-signer', '--ks', str(new_key),
                    '--ks-key-alias', os.environ.get('ANDROID_KEY_ALIAS', 'hint365'),
                    '--ks-pass', 'env:HINT_NEW_PASS', '--key-pass', 'env:HINT_NEW_KEY_PASS',
                    '--lineage', str(lineage), '--rotation-min-sdk-version', '33',
                    '--v4-signing-enabled', 'false', '--out', str(output), str(source)], env=env, check=True)
    subprocess.run([str(apksigner), 'verify', '--verbose', '--print-certs', str(output)], env=env, check=True)
    shutil.copyfile(output, source)

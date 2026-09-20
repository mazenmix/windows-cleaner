from pathlib import Path
import base64, hashlib, lzma

ROOT = Path(__file__).resolve().parent
PARTS = ROOT / "release-v52"
OUT = ROOT / "MX_Fuel_Watch_PH.exe"
EXPECTED_SHA256 = "0ee79f26d190cb8192cc2cc3bdc3f595c9a2e2298c10efe082c44ee30249a0d9"

def main():
    parts = sorted(PARTS.glob("part*"))
    if len(parts) != 21:
        raise SystemExit(f"Expected 21 release parts, found {len(parts)}")
    encoded = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
    payload = base64.b64decode(encoded)
    exe = lzma.decompress(payload)
    digest = hashlib.sha256(exe).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(f"SHA256 mismatch: {digest}")
    OUT.write_bytes(exe)
    print(f"Built {OUT.name}: {len(exe)} bytes SHA256={digest}")

if __name__ == "__main__":
    main()

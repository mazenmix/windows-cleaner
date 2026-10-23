#!/usr/bin/env python3
# Production sync: commits from this updater intentionally trigger Cloudflare Pages deployment.
import io
import json
import re
import statistics
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import pdfplumber
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "gaswatch-lpg.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MXFuelWatch/5.0; +https://mxfuel.pages.dev/)",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}
TIMEOUT = 25

REGASCO_URL = "https://www.regascoexpress.com/Product/GetProductsBySubCategory?categoryName=11+Kg+Regasco"
SOLANE_URL = "https://order.solane.com.ph/landing"
DOE_ROOT = "https://doe.gov.ph/data-and-prices/lpg-monitor"

NAMES = ["Regasco", "Solane", "Petron Gasul", "SL Gas", "Phoenix LPG", "Total Gas"]


def fetch(url, binary=False):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
    r.raise_for_status()
    return r.content if binary else r.text


def money_number(value):
    if value is None:
        return None
    s = str(value).replace("\u00a0", " ").replace(",", "")
    m = re.search(r"(?:PHP|₱)?\s*([0-9]{3,5}(?:\.\d{1,2})?)", s, re.I)
    if not m:
        return None
    v = float(m.group(1))
    if 500 <= v <= 3000:
        return int(round(v))
    return None


def parse_regasco():
    html = fetch(REGASCO_URL)
    plain = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    patterns = [
        r"11\s*Kg\s*Regasco\s*-\s*Refill.{0,120}?[₱PHP\s]+([0-9,]{3,6})",
        r"11\s*Kg\s*Regasco\s*-\s*Refill.{0,120}?([0-9,]{3,6})",
    ]
    for p in patterns:
        m = re.search(p, plain, re.I | re.S)
        if m:
            v = money_number(m.group(1))
            if v:
                return v
    raise RuntimeError("Regasco 11kg refill price not found")


def parse_solane():
    html = fetch(SOLANE_URL)
    plain = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    patterns = [
        r"11\s*kg\s*AS\s*Refill.{0,100}?([0-9,]{3,6}(?:\.\d{1,2})?)",
        r"11\s*kg.{0,80}?Refill.{0,100}?([0-9,]{3,6}(?:\.\d{1,2})?)",
    ]
    for p in patterns:
        m = re.search(p, plain, re.I | re.S)
        if m:
            v = money_number(m.group(1))
            if v:
                return v
    raise RuntimeError("Solane 11kg refill price not found")


def latest_doe_ncr_pdf():
    root_html = fetch(DOE_ROOT)
    root = BeautifulSoup(root_html, "html.parser")
    ncr_url = None
    for a in root.find_all("a", href=True):
        label = a.get_text(" ", strip=True).lower()
        if "ncr lpg prices" in label:
            ncr_url = urljoin(DOE_ROOT, a["href"])
            break
    if not ncr_url:
        ncr_url = "https://doe.gov.ph/data-and-prices/lpg-monitor/ncr-lpg-prices"

    html = fetch(ncr_url)
    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    month_rank = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }
    for a in soup.find_all("a", href=True):
        label = a.get_text(" ", strip=True)
        href = urljoin(ncr_url, a["href"])
        blob = f"{label} {href}".lower()
        if "2026" not in blob:
            continue
        if "lpg" not in blob and "price" not in blob and ".pdf" not in blob:
            continue
        rank = 0
        for month, n in month_rank.items():
            if month in blob:
                rank = n
                break
        candidates.append((rank, href, label))
    if not candidates:
        raise RuntimeError("No DOE NCR 2026 LPG document link found")
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1], ncr_url, candidates[0][2]


def clean_cell(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def collect_prices(cell):
    vals = []
    # DOE rows use 1,430.00. Preserve the digit before the thousands comma.
    matches = re.findall(
        r"(?<![\d,])((?:[1-9]\d?,\d{3}|\d{3,4})(?:\.\d{1,2})?)(?![\d,])",
        clean_cell(cell),
    )
    for token in matches:
        value = float(token.replace(",", ""))
        if 500 <= value <= 3000:
            vals.append(value)
    return vals


def parse_doe_brand_medians(pdf_bytes):
    aliases = {
        "Petron Gasul": ["GASUL", "ELITE GASUL"],
        "Solane": ["SOLANE"],
        "Regasco": ["REGASCO"],
        "Phoenix LPG": ["PHOENIX", "PHOENIX SUPER LPG"],
        "Total Gas": ["TOTAL GAS", "TOTALGAZ", "TOTAL"],
        "SL Gas": ["SL GAS"],
    }
    found = {k: [] for k in aliases}

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables() or []
            for table in tables:
                header_idx = None
                col_map = {}
                for i, row in enumerate(table[:12]):
                    cells = [clean_cell(x).upper() for x in row]
                    local = {}
                    for brand, names in aliases.items():
                        # Gasul Elite differs from the standard Gasul column.
                        if brand == "Petron Gasul":
                            ordinary = next((j for j, c in enumerate(cells) if c == "GASUL"), None)
                            if ordinary is not None:
                                local[brand] = ordinary
                                continue
                        for j, cell in enumerate(cells):
                            if any(name in cell for name in names):
                                local[brand] = j
                                break
                    if len(local) >= 2:
                        header_idx = i
                        col_map = local
                        break
                if header_idx is None:
                    continue
                for row in table[header_idx + 1:]:
                    for brand, j in col_map.items():
                        if j >= len(row):
                            continue
                        found[brand].extend(collect_prices(row[j]))

    medians = {}
    for brand, vals in found.items():
        if vals:
            medians[brand] = int(round(statistics.median(vals)))
    return medians


def load_previous():
    if not OUT.exists():
        return {name: None for name in NAMES}, {}
    j = json.loads(OUT.read_text(encoding="utf-8"))
    prices = {x.get("name"): x.get("price") for x in j.get("lpg", []) if isinstance(x, dict)}
    return prices, j


def main():
    previous, previous_doc = load_previous()
    prices = {name: previous.get(name) for name in NAMES}
    verified = {}
    warnings = []
    doe_pdf_url = None
    doe_page_url = None
    doe_label = None

    try:
        doe_pdf_url, doe_page_url, doe_label = latest_doe_ncr_pdf()
        doe_pdf = fetch(doe_pdf_url, binary=True)
        doe_prices = parse_doe_brand_medians(doe_pdf)
        if not doe_prices:
            raise RuntimeError("DOE LPG PDF contains no extractable brand prices")
        for brand, value in doe_prices.items():
            if brand in prices and value:
                prices[brand] = value
                verified[brand] = "DOE NCR monitored median"
    except Exception as e:
        warnings.append(f"DOE: {e}")

    try:
        prices["Regasco"] = parse_regasco()
        verified["Regasco"] = "Regasco official ordering"
    except Exception as e:
        warnings.append(f"Regasco: {e}")

    try:
        prices["Solane"] = parse_solane()
        verified["Solane"] = "Solane official ordering"
    except Exception as e:
        warnings.append(f"Solane: {e}")

    missing = [name for name in NAMES if not isinstance(prices.get(name), (int, float))]
    if missing:
        raise RuntimeError("Missing LPG prices for: " + ", ".join(missing))

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    # Price verification is per brand. Rechecking six rows does not mean that
    # prices carried over from earlier snapshots were newly confirmed today.
    prior_by_brand = previous_doc.get("last_verified_at_by_brand", {})
    if not isinstance(prior_by_brand, dict):
        prior_by_brand = {}
    verified_at_by_brand = {name: prior_by_brand.get(name) for name in NAMES}
    for name in verified:
        verified_at_by_brand[name] = now

    payload = {
        "provider": "DOE Philippines + official brand ordering",
        "source_url": DOE_ROOT,
        "tank_kg": 11,
        "rendered_at": now,
        "checked_at": now,
        "verified_at": now if verified else previous_doc.get("verified_at"),
        "last_verified_at_by_brand": verified_at_by_brand,
        "verified_brand_count": len(verified),
        "carried_forward_brands": [name for name in NAMES if name not in verified],
        "doe_ncr_page": doe_page_url,
        "doe_document": doe_pdf_url,
        "doe_document_label": doe_label,
        "official_sources": {
            "Regasco": REGASCO_URL,
            "Solane": SOLANE_URL,
            "DOE": DOE_ROOT,
        },
        "verified": verified,
        "price_accuracy": "Current source readings only for brands in verified; other prices are carried-forward references",
        "warnings": warnings,
        "lpg": [{"name": name, "price": int(round(prices[name]))} for name in NAMES],
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    old = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
    if text != old:
        OUT.write_text(text, encoding="utf-8")
        print("Updated", OUT)
    else:
        print("No LPG price changes")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

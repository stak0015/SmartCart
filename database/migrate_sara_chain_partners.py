"""Promote branches of eight documented SARA chains under a chain-wide assumption.

Default is a read-only preview. --apply writes an audit with previous flags and
promotes matching premises. Existing verification and candidate flags are kept.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

import psycopg
from ingest_pricecatcher import load_local_env
from sara_chain_catalog import normalize_chain_text

ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://www.sara.gov.my/documents/sara2026_sus_faqs_final_20260209.pdf"
# These are the chains explicitly named in the official FAQ, not every local
# business in MyKasih's merchant directory. Match brand tokens, never substrings.
CHAIN_PREFIXES = {
    "MYDIN": ("MYDIN",), "GIANT": ("GIANT",), "ECONSAVE": ("ECONSAVE",),
    "THE STORE": ("THE", "STORE"), "PACIFIC": ("PACIFIC",),
    "MILIMEWA": ("MILIMEWA",), "99 SPEEDMART": ("99", "SPEEDMART"),
    "LOTUS'S / TESCO": ("LOTUSS",),
}
LEADING_DESCRIPTORS = {"PASARAYA", "PASAR", "RAYA", "MINI", "KEDAI", "PUSAT", "SYARIKAT", "HYPERMARKET", "SUPERMARKET"}


def partner_chain(name: str | None) -> str | None:
    tokens = normalize_chain_text(name).split()
    # Tenant food courts are not retail branches of the host supermarket.
    if "FOODCOURT" in tokens or "FOOD COURT" in " ".join(tokens):
        return None
    while tokens and tokens[0] in LEADING_DESCRIPTORS:
        tokens.pop(0)
    if tokens and tokens[0] == "LOTUS":
        tokens[0] = "LOTUSS"
    if tokens and tokens[0] == "99SPEEDMART":
        tokens[:1] = ["99", "SPEEDMART"]
    if tokens[:3] == ["99", "SPEED", "MART"]:
        tokens[:3] = ["99", "SPEEDMART"]
    if tokens[:2] == ["MY", "MYDIN"]:
        tokens.pop(0)
    if tokens and tokens[0] == "MILIMEWAH":
        tokens[0] = "MILIMEWA"
    for chain, prefix in CHAIN_PREFIXES.items():
        if tuple(tokens[:len(prefix)]) == prefix:
            return chain
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    load_local_env(ROOT / ".env")
    load_local_env(ROOT.parent / "backend" / ".env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    timestamp = datetime.now(timezone.utc)
    output = args.output or ROOT / "data" / "raw" / f"sara_chain_partner_{timestamp:%Y%m%dT%H%M%S%fZ}.json"
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        with connection.transaction(), connection.cursor() as cursor:
            cursor.execute("SELECT premise_id, premise_code, premise_name, sara_partner, sara_match_candidate FROM premise ORDER BY premise_id")
            matches = [(*row, partner_chain(row[2])) for row in cursor.fetchall() if partner_chain(row[2])]
            if args.apply and matches:
                cursor.execute("SELECT premise_id, premise_code, premise_name, sara_partner, sara_match_candidate FROM premise WHERE premise_id = ANY(%s) ORDER BY premise_id FOR UPDATE", ([row[0] for row in matches],))
                matches = [(*row, partner_chain(row[2])) for row in cursor.fetchall() if partner_chain(row[2])]
            pending = [row for row in matches if row[3] is not True]
            counts = Counter(row[5] for row in matches)
            pending_counts = Counter(row[5] for row in pending)
            for chain, count in sorted(counts.items()):
                print(f"{chain}: {count} branches, {pending_counts[chain]} to promote")
            # Written before updates so previous NULL/FALSE flags remain recoverable.
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps({
                "created_at": timestamp.isoformat(), "source_url": SOURCE_URL,
                "basis": "User-authorised assumption that all branches of these partner chains participate",
                "mode": "apply" if args.apply else "preview", "matched_count": len(matches),
                "promotion_count": len(pending),
                "premises": [{"premise_id": row[0], "premise_code": row[1], "name": row[2],
                    "previous_sara_partner": row[3], "sara_match_candidate": row[4], "chain": row[5]}
                    for row in matches],
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            updated = 0
            if args.apply and pending:
                cursor.execute("UPDATE premise SET sara_partner = TRUE WHERE premise_id = ANY(%s) AND sara_partner IS DISTINCT FROM TRUE", ([row[0] for row in pending],))
                updated = cursor.rowcount
                if updated != len(pending):
                    raise RuntimeError("Unexpected update count; transaction rolled back")
            cursor.execute("SELECT COUNT(*) FROM premise WHERE sara_partner IS TRUE AND premise_id = ANY(%s)", ([row[0] for row in matches],))
            verified = cursor.fetchone()[0]
            print(f"Matched: {len(matches)}; to promote: {len(pending)}; updated: {updated}; verified: {verified}")
            print(f"Audit: {output}")
    print("Applied and committed." if args.apply else "Preview only; database unchanged.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        # Connection exceptions can contain credential-bearing URLs.
        print(f"Migration failed ({type(error).__name__}); no successful commit confirmed.", file=sys.stderr)
        raise SystemExit(1) from None

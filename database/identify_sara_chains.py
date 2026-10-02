"""Create a recurring-chain catalog from the local SARA merchant snapshot."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.request import Request, urlopen

from sara_chain_catalog import build_chain_catalog


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "data" / "raw" / "google_place_candidates_sara_one_mykasih.json"
DEFAULT_OUTPUT = ROOT / "data" / "raw" / "sara_chain_catalog.json"
DEFAULT_OFFICIAL_URL = (
    "https://www.mykasih.com.my/en/about-us/merchant-partners/"
)


class _OfficialPartnerListParser(HTMLParser):
    """Extract list items from the page article, excluding site navigation."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.article_depth = 0
        self.list_item_depth = 0
        self.current_item: list[str] = []
        self.names: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "article" and attributes.get("id", "").startswith("post-"):
            self.article_depth += 1
        if self.article_depth and tag == "li":
            if self.list_item_depth == 0:
                self.current_item = []
            self.list_item_depth += 1

    def handle_data(self, data: str) -> None:
        if self.article_depth and self.list_item_depth:
            self.current_item.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.article_depth and tag == "li" and self.list_item_depth:
            self.list_item_depth -= 1
            if self.list_item_depth == 0:
                name = " ".join(" ".join(self.current_item).split())
                if name:
                    self.names.append(name)
        if tag == "article" and self.article_depth:
            self.article_depth -= 1


def fetch_official_partner_names(url: str) -> list[str]:
    request = Request(
        url,
        headers={
            "User-Agent": "SmartCart SARA catalogue importer/1.0",
            "Accept": "text/html",
        },
    )
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", errors="replace")
    parser = _OfficialPartnerListParser()
    parser.feed(html)
    names = list(dict.fromkeys(parser.names))
    if len(names) < 100:
        raise ValueError(
            f"official merchant-partner page returned only {len(names)} list items"
        )
    return names


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--official-url", default=DEFAULT_OFFICIAL_URL)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    body = json.loads(args.input.read_text(encoding="utf-8"))
    records = body.get("records") if isinstance(body, dict) else None
    if not isinstance(records, list):
        raise ValueError("SARA snapshot must contain a records list")
    official_partner_names = fetch_official_partner_names(args.official_url)
    catalog = build_chain_catalog(records, official_partner_names)
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(args.input),
        "official_source": {
            "url": args.official_url,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "description": "MyKasih Foundation official merchant-partner directory",
        },
        **catalog,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"SARA records: {catalog['summary']['records']:,}")
    print(f"Recurring chain candidates: {catalog['summary']['recurring_chain_groups']:,}")
    print(f"Official partner names: {catalog['summary']['official_partner_names']:,}")
    print(
        "Recurring groups with an official partner name: "
        f"{catalog['summary']['recurring_groups_with_official_partner']:,}"
    )
    print(f"Catalog: {args.output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error

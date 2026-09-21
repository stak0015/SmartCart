"""Temporary localhost-only fixture API for visual QA; remove after use."""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from urllib.parse import parse_qs, urlparse

ITEMS = [
    (101, "Long Grain Rice Family Pack", "5 kg", "Rice"),
    (102, "Sunflower Cooking Oil", "1 L", "Cooking Oil"),
    (103, "Whole Wheat Breakfast Cereal With a Long Product Name", "750 g", "Breakfast"),
    (104, "Dishwashing Liquid Refill", "950 ml", "Cleaning"),
    (105, "Laundry Powder Family Size", "2.3 kg", "Cleaning"),
    (106, "Facial Tissue Box", "200 sheets", "Household"),
    (107, "Instant Noodles Multipack", "5 x 79 g", "Food"),
    (108, "Fresh Milk Carton", "1 L", "Dairy"),
]


def store(index, basket):
    prices = []
    lines = []
    for entry in basket:
        item_id = str(entry["itemId"])
        item = next((row for row in ITEMS if str(row[0]) == item_id), None)
        name = item[1] if item else "Basket item"
        package = item[2] if item else "1 pack"
        quantity = entry["quantity"]
        price = round(6.5 + int(item_id) % 7 + index * 0.45, 2)
        prices.append(dict(itemId=item_id, itemName=name, packageSize=package,
                           quantity=quantity, unitPriceRm=price,
                           lineTotalRm=round(price * quantity, 2),
                           priceObservedDate="2026-09-01", priceSource="store",
                           saraEligible=None, saraCategoryCandidate=False))
        lines.append(dict(itemId=item_id, itemName=name, unit=package,
                          quantity=quantity, unitPriceRm=price,
                          lineTotalRm=round(price * quantity, 2),
                          observedDate="2026-09-01", priceSource="store"))
    subtotal = round(sum(line["lineTotalRm"] for line in lines), 2)
    travel = round(1.5 + index * 0.7, 2)
    return dict(premiseId=str(index), premiseCode=f"TEST{index}",
                name=["Fresh Choice Market", "Corner Family Grocer", "Everyday Value Supermarket", "The Neighbourhood Household Store"][index-1],
                address="Fixture address", district="Kuala Lumpur", state="Selangor",
                straightLineDistanceKm=1.5 + index, routeDistanceKm=1.8 + index,
                estimatedTravelMinutes=5 + index * 3, estimatedRoundTripCostRm=travel,
                basketCostRm=subtotal, estimatedTotalCostRm=round(subtotal + travel, 2),
                pricedItemCount=len(lines), basketItemCount=len(lines), isCompleteBasket=True,
                basketPrices=prices, storePriceCount=len(lines), medianPriceCount=0,
                saraStatus="unverified", basketSubtotalRm=subtotal, missingItems=[],
                pricedCount=len(lines), basketLineCount=len(lines), saraCreditRm=0,
                cashNeededRm=subtotal, priceObservedDaysAgo=1,
                combinedTotalRm=round(subtotal + travel, 2), basketLines=lines,
                exceedsLimit=False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, body):
        payload = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:3001")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.reply({})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/items/categories":
            return self.reply({"count": 6, "categories": ["Rice", "Cooking Oil", "Breakfast", "Cleaning", "Household", "Food"]})
        if parsed.path == "/api/items/search":
            q = parse_qs(parsed.query).get("q", [""])[0].lower()
            items = [dict(item_id=item_id, item_name=name, item_name_en=name,
                          item_name_ms=name, unit=package, item_category=category,
                          package_size=package, sara_eligible=None,
                          sara_category_candidate=False)
                     for item_id, name, package, category in ITEMS if q in name.lower()]
            return self.reply(dict(count=len(items), total=len(items), page=1,
                                   page_size=25, total_pages=1, items=items,
                                   sara_category_source={"url": "", "programmeYear": 2026,
                                                         "reviewedAt": "2026-09-01"}))
        if parsed.path == "/api/locations/autocomplete":
            return self.reply({"suggestions": [{"placeId": "test-origin", "mainText": "Test Origin",
                                                  "secondaryText": "Kuala Lumpur", "fullText": "Test Origin, Kuala Lumpur"}]})
        return self.reply({})

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(size) or b"{}")
        path = urlparse(self.path).path
        if path == "/api/locations/resolve":
            return self.reply({"placeId": "test-origin", "label": "Test Origin, Kuala Lumpur",
                               "latitude": 3.14, "longitude": 101.69})
        if path == "/api/locations/reverse":
            return self.reply({"label": "Test Origin, Kuala Lumpur"})
        if path == "/api/recommendations/prepare":
            return self.reply({"candidateCacheId": "fixture", "candidateCount": 4,
                               "reachableCount": 4, "generatedAt": "2026-09-01T00:00:00Z",
                               "expiresAt": "2026-09-01T01:00:00Z"})
        if path == "/api/recommendations":
            basket = body.get("basket", [])
            return self.reply({"recommendations": [store(index, basket) for index in range(1, 5)],
                               "totalCandidatesEvaluated": 4, "totalReachable": 4,
                               "generatedAt": "2026-09-01T00:00:00Z", "routeProvider": "straight_line",
                               "rankingMethod": "fixture", "costAssumptions": {},
                               "routeWarning": None, "expandedSearch": False})
        if path.startswith("/api/premises/") and path.endswith("/basket-alternatives"):
            lines = []
            for entry in body.get("basket", []):
                item_id = str(entry["itemId"])
                item = next((row for row in ITEMS if str(row[0]) == item_id), None)
                name = item[1] if item else "Basket item"
                package = item[2] if item else "1 pack"
                quantity = entry["quantity"]
                source = dict(itemId=item_id, itemName=name, unit=package, packageSize=package,
                              unitPriceRm=9.5, lineTotalRm=9.5 * quantity,
                              observedDate="2026-09-01", priceObservedDaysAgo=1,
                              priceSource="store", saraEligible=None,
                              saraCategoryCandidate=False, isSaraCreditCandidate=False)
                lines.append(dict(quantity=quantity, source=source, alternative=None,
                                  savingsRm=None, packOptions=[]))
            return self.reply({"premiseId": path.split("/")[3], "lines": lines,
                               "generatedAt": "2026-09-01T00:00:00Z"})
        return self.reply({})


HTTPServer(("127.0.0.1", 8001), Handler).serve_forever()

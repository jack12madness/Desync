"""Social boost products (unit pricing) + custom key durations E2E tests.

Boost model: ONE product per platform. Buyers pick followers/likes/views and an
amount; price = amount x unit price (e.g. 0.2c each), min spend enforced.
Covers:
- boost product validation (platform required, tiktok/instagram only)
- unit pricing through checkout incl. min-spend rejection
- boost items skip key assignment (boost_pending, no license_key)
- buyer submits page/video link keyed by product+type; same product can be
  bought as followers AND likes in one order
- link validation, resubmit keeps status, changed link resets to pending
- admin sets boost status, invalid rejected, auth required
- custom cheat durations ("2 Weeks") through pricing, stock and checkout
"""
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

UNIT = 0.002  # 0.2c per follower/like/view
MIN_SPEND = 7.50


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def boost_product(admin_headers):
    r = requests.post(f"{API}/admin/products", json={
        "game": "FiveM", "name": f"TEST-Boost-{uuid.uuid4().hex[:6]}", "kind": "boost",
        "platform": "tiktok", "min_spend": MIN_SPEND,
        "prices": {"followers": UNIT, "likes": UNIT, "views": UNIT},
        "duration_labels": {"followers": "Followers", "likes": "Likes", "views": "Views"},
        "image_url": "https://example.com/boost.png",
    }, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    p = r.json()
    yield p
    requests.delete(f"{API}/admin/products/{p['id']}", headers=admin_headers, timeout=15)


def _buy_and_pay(admin_headers, email, items):
    r = requests.post(f"{API}/payments/bank-transfer", json={
        "email": email, "items": items, "origin_url": BASE,
    }, timeout=30)
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    mp = requests.post(f"{API}/admin/orders/{oid}/mark-paid", headers=admin_headers, timeout=30)
    assert mp.status_code == 200, mp.text
    return oid


def test_boost_product_validation(admin_headers):
    base = {"game": "FiveM", "name": "x", "kind": "boost", "prices": {"followers": UNIT}}
    bad_platform = requests.post(f"{API}/admin/products", json={**base, "platform": "youtube"}, headers=admin_headers, timeout=15)
    assert bad_platform.status_code == 400
    missing_platform = requests.post(f"{API}/admin/products", json=base, headers=admin_headers, timeout=15)
    assert missing_platform.status_code == 400
    no_prices = requests.post(f"{API}/admin/products", json={
        "game": "FiveM", "name": "x", "kind": "boost", "platform": "tiktok", "prices": {},
    }, headers=admin_headers, timeout=15)
    assert no_prices.status_code == 400


def test_boost_unit_pricing_and_min_spend(admin_headers, boost_product):
    pid = boost_product["id"]
    email = f"boost-{uuid.uuid4().hex[:6]}@resend.dev"

    # below min spend: 1,000 x 0.2c = A$2.00 < A$7.50 -> rejected
    r = requests.post(f"{API}/payments/bank-transfer", json={
        "email": email, "items": [{"product_id": pid, "duration": "followers", "qty": 1000}], "origin_url": BASE,
    }, timeout=30)
    assert r.status_code == 400 and "minimum spend" in r.json()["detail"]

    # 5,000 followers x 0.2c = A$10.00
    oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "followers", "qty": 5000}])
    order = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()
    item = order["items"][0]
    assert order["total"] == 10.0
    assert item["kind"] == "boost" and item["platform"] == "tiktok"
    assert item["boost_type"] == "followers" and item["duration_label"] == "Followers"
    assert item["qty"] == 5000 and item["unit_price"] == UNIT
    assert item.get("license_key") is None and item.get("boost_pending") is True
    assert item.get("key_pending") is False


def test_boost_link_and_status_flow(admin_headers, boost_product):
    pid = boost_product["id"]
    email = f"boost-{uuid.uuid4().hex[:6]}@resend.dev"
    # same product bought as followers AND likes in one order
    oid = _buy_and_pay(admin_headers, email, [
        {"product_id": pid, "duration": "followers", "qty": 5000},
        {"product_id": pid, "duration": "likes", "qty": 10000},
    ])
    order = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()
    assert order["total"] == 10.0 + 20.0
    assert len([i for i in order["items"] if i["kind"] == "boost"]) == 2

    # submit a link for each type separately
    for dur, link in [("followers", "https://tiktok.com/@mypage"), ("likes", "https://tiktok.com/video/123")]:
        r = requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
            "details": [{"product_id": pid, "duration": dur, "link": link}],
        }, timeout=15)
        assert r.status_code == 200, r.text
    details = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["boost_details"]
    assert len(details) == 2
    by_dur = {d["duration"]: d for d in details}
    assert by_dur["followers"]["link"].endswith("@mypage") and by_dur["followers"]["status"] == "pending"
    assert by_dur["likes"]["link"].endswith("video/123") and by_dur["likes"]["qty"] == 10000

    # link validation + wrong duration rejected
    bad = requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "duration": "followers", "link": "no-scheme"}],
    }, timeout=15)
    assert bad.status_code == 400
    wrong = requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "duration": "views", "link": "https://x.com"}],
    }, timeout=15)
    assert wrong.status_code == 400  # views wasn't purchased on this order

    # admin moves followers to processing; likes untouched
    s = requests.post(f"{API}/admin/orders/{oid}/boost-status", json={
        "product_id": pid, "duration": "followers", "status": "processing",
    }, headers=admin_headers, timeout=15)
    assert s.status_code == 200, s.text
    bogus = requests.post(f"{API}/admin/orders/{oid}/boost-status", json={
        "product_id": pid, "duration": "followers", "status": "shipped",
    }, headers=admin_headers, timeout=15)
    assert bogus.status_code == 400
    noauth = requests.post(f"{API}/admin/orders/{oid}/boost-status", json={
        "product_id": pid, "duration": "followers", "status": "completed",
    }, timeout=15)
    assert noauth.status_code == 401

    # resubmitting the SAME link keeps status; CHANGED link resets to pending
    requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "duration": "followers", "link": "https://tiktok.com/@mypage"}],
    }, timeout=15)
    kept = {d["duration"]: d for d in requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["boost_details"]}
    assert kept["followers"]["status"] == "processing"
    requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "duration": "followers", "link": "https://tiktok.com/@newpage"}],
    }, timeout=15)
    reset = {d["duration"]: d for d in requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["boost_details"]}
    assert reset["followers"]["status"] == "pending" and reset["followers"]["link"].endswith("@newpage")
    assert reset["likes"]["status"] == "pending"


def test_boost_bulk_tiers_per_type_and_bigger_discount_wins(admin_headers):
    """Per-type bulk % applies automatically; only the bigger of bulk vs coupon applies."""
    r = requests.post(f"{API}/admin/products", json={
        "game": "FiveM", "name": f"TEST-Bulk-{uuid.uuid4().hex[:6]}", "kind": "boost",
        "platform": "instagram", "min_spend": 5.0, "min_qty": 100,
        "prices": {"followers": UNIT, "likes": UNIT, "views": UNIT},
        "duration_labels": {"followers": "Followers", "likes": "Likes", "views": "Views"},
        "bulk_tiers": {
            "likes": [{"min_qty": 10000, "percent": 5}, {"min_qty": 50000, "percent": 15}],
            "followers": [{"min_qty": 10000, "percent": 20}],
        },
        "image_url": "https://example.com/b.png",
    }, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    try:
        email = f"bulk-{uuid.uuid4().hex[:6]}@resend.dev"
        # below min buy: 50 units rejected even though A$0.10 < min spend would also fail
        r = requests.post(f"{API}/payments/bank-transfer", json={
            "email": email, "items": [{"product_id": pid, "duration": "likes", "qty": 50}], "origin_url": BASE,
        }, timeout=30)
        assert r.status_code == 400 and "minimum purchase of 100" in r.json()["detail"]
        # 5,000 likes -> no tier: A$10.00
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "likes", "qty": 5000}])
        assert requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["total"] == 10.0
        # 10,000 likes -> 5% tier: A$20.00 -> A$19.00
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "likes", "qty": 10000}])
        order = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()
        assert order["total"] == 19.0 and order["items"][0]["bulk_percent"] == 5
        # 10,000 followers -> DIFFERENT tier: 20% off -> A$16.00
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "followers", "qty": 10000}])
        order = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()
        assert order["total"] == 16.0 and order["items"][0]["bulk_percent"] == 20
        # 10,000 views -> no views tiers: full price A$20.00
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "views", "qty": 10000}])
        assert requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["total"] == 20.0
        # 50,000 likes -> 15% tier: A$100.00 -> A$85.00
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "likes", "qty": 50000}])
        assert requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["total"] == 85.0
        # coupon DESYNC10 (10%) vs bulk 5% on 10,000 likes -> coupon wins: A$18.00, no stacking
        r = requests.post(f"{API}/payments/bank-transfer", json={
            "email": email, "items": [{"product_id": pid, "duration": "likes", "qty": 10000}],
            "coupon": "DESYNC10", "origin_url": BASE,
        }, timeout=30)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        requests.post(f"{API}/admin/orders/{oid}/mark-paid", headers=admin_headers, timeout=30)
        assert requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["total"] == 18.0
        # coupon 10% vs bulk 15% on 50,000 -> bulk wins: A$85.00
        r = requests.post(f"{API}/payments/bank-transfer", json={
            "email": email, "items": [{"product_id": pid, "duration": "likes", "qty": 50000}],
            "coupon": "DESYNC10", "origin_url": BASE,
        }, timeout=30)
        oid = r.json()["order_id"]
        requests.post(f"{API}/admin/orders/{oid}/mark-paid", headers=admin_headers, timeout=30)
        assert requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["total"] == 85.0
    finally:
        requests.delete(f"{API}/admin/products/{pid}", headers=admin_headers, timeout=15)


def test_boost_legacy_flat_bulk_tiers_still_work(admin_headers):
    """A flat bulk_tiers list (older format) applies to every type."""
    r = requests.post(f"{API}/admin/products", json={
        "game": "FiveM", "name": f"TEST-BulkLegacy-{uuid.uuid4().hex[:6]}", "kind": "boost",
        "platform": "tiktok", "min_spend": 5.0,
        "prices": {"followers": UNIT, "likes": UNIT, "views": UNIT},
        "duration_labels": {"followers": "Followers", "likes": "Likes", "views": "Views"},
        "bulk_tiers": [{"min_qty": 10000, "percent": 10}],
        "image_url": "https://example.com/b.png",
    }, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    try:
        email = f"legacy-{uuid.uuid4().hex[:6]}@resend.dev"
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "views", "qty": 10000}])
        assert requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["total"] == 18.0
    finally:
        requests.delete(f"{API}/admin/products/{pid}", headers=admin_headers, timeout=15)


def test_custom_cheat_duration_end_to_end(admin_headers):
    """Staff-defined duration ("2 Weeks") flows through pricing, stock and checkout."""
    r = requests.post(f"{API}/admin/products", json={
        "game": "FiveM", "name": f"TEST-CustomDur-{uuid.uuid4().hex[:6]}", "kind": "cheat",
        "prices": {"day": 6.99, "2-weeks": 24.99},
        "duration_labels": {"2-weeks": "2 Weeks"},
        "image_url": "https://example.com/c.png",
    }, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    try:
        add = requests.post(f"{API}/admin/keystock", json={
            "product_id": pid, "duration": "2-weeks", "keys": "CUSTOM-2W-KEY-1",
        }, headers=admin_headers, timeout=15)
        assert add.status_code == 200, add.text

        email = f"customdur-{uuid.uuid4().hex[:6]}@resend.dev"
        oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "2-weeks", "qty": 1}])
        order = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()
        item = order["items"][0]
        assert item["duration"] == "2-weeks" and item["duration_label"] == "2 Weeks"
        assert item["license_key"] == "CUSTOM-2W-KEY-1"
        assert order["total"] == 24.99
    finally:
        requests.delete(f"{API}/admin/products/{pid}", headers=admin_headers, timeout=15)

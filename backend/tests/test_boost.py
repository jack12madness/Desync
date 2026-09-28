"""Social boost products + custom key durations E2E tests.

Covers:
- boost product CRUD validation (platform/type required, tiktok/instagram only)
- tiered amount pricing (custom price keys) through checkout
- boost items skip key assignment on fulfillment (boost_pending, no license_key)
- buyer submits page/video link (public endpoint, order id is the secret)
- link validation, resubmit keeps status, changed link resets to pending
- admin sets boost status (pending/processing/completed), invalid rejected
- custom cheat durations ("2 Weeks") work through pricing, stock and checkout
"""
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def boost_product(admin_headers):
    r = requests.post(f"{API}/admin/products", json={
        "game": "FiveM", "name": f"TEST-Boost-{uuid.uuid4().hex[:6]}", "kind": "boost",
        "platform": "instagram", "boost_type": "likes",
        "prices": {"500-likes": 2.99, "1000-likes": 4.99},
        "duration_labels": {"500-likes": "500 Likes", "1000-likes": "1,000 Likes"},
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
    base = {"game": "FiveM", "name": "x", "kind": "boost", "prices": {"a": 1.0}}
    bad_platform = requests.post(f"{API}/admin/products", json={**base, "platform": "youtube", "boost_type": "likes"}, headers=admin_headers, timeout=15)
    assert bad_platform.status_code == 400
    bad_type = requests.post(f"{API}/admin/products", json={**base, "platform": "tiktok", "boost_type": "comments"}, headers=admin_headers, timeout=15)
    assert bad_type.status_code == 400
    missing = requests.post(f"{API}/admin/products", json=base, headers=admin_headers, timeout=15)
    assert missing.status_code == 400


def test_boost_purchase_link_and_status_flow(admin_headers, boost_product):
    pid = boost_product["id"]
    assert boost_product["kind"] == "boost" and boost_product["platform"] == "instagram"

    # boost products never sell out and skip stock checks entirely
    email = f"boost-{uuid.uuid4().hex[:6]}@resend.dev"
    oid = _buy_and_pay(admin_headers, email, [{"product_id": pid, "duration": "1000-likes", "qty": 1}])

    order = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()
    item = order["items"][0]
    assert item["kind"] == "boost" and item["platform"] == "instagram" and item["boost_type"] == "likes"
    assert item["duration_label"] == "1,000 Likes"
    assert item.get("license_key") is None and item.get("boost_pending") is True
    assert item.get("key_pending") is False

    # buyer submits their video link
    r = requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "link": "https://instagram.com/p/abc123"}],
    }, timeout=15)
    assert r.status_code == 200, r.text
    detail = r.json()["boost_details"][0]
    assert detail["link"] == "https://instagram.com/p/abc123" and detail["status"] == "pending"

    # link validation
    bad = requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "link": "tiktok.com/no-scheme"}],
    }, timeout=15)
    assert bad.status_code == 400
    wrong_product = requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": "nope", "link": "https://x.com"}],
    }, timeout=15)
    assert wrong_product.status_code == 400

    # admin moves it to processing
    s = requests.post(f"{API}/admin/orders/{oid}/boost-status", json={"product_id": pid, "status": "processing"}, headers=admin_headers, timeout=15)
    assert s.status_code == 200, s.text
    bogus = requests.post(f"{API}/admin/orders/{oid}/boost-status", json={"product_id": pid, "status": "shipped"}, headers=admin_headers, timeout=15)
    assert bogus.status_code == 400

    # resubmitting the SAME link keeps the status; a CHANGED link resets to pending
    requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "link": "https://instagram.com/p/abc123"}],
    }, timeout=15)
    kept = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["boost_details"][0]
    assert kept["status"] == "processing"
    requests.post(f"{API}/orders/by-id/{oid}/boost-details", json={
        "details": [{"product_id": pid, "link": "https://instagram.com/p/different"}],
    }, timeout=15)
    reset = requests.get(f"{API}/orders/by-id/{oid}", timeout=15).json()["boost_details"][0]
    assert reset["status"] == "pending" and reset["link"].endswith("different")

    # boost-status requires admin auth
    noauth = requests.post(f"{API}/admin/orders/{oid}/boost-status", json={"product_id": pid, "status": "completed"}, timeout=15)
    assert noauth.status_code == 401


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
        # stock the custom pool (was rejected before: not in the fixed DURATIONS list)
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

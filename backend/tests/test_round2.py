"""Round 2 tests: product-specific coupons, promo banner, category reorder,
system_requirements + troubleshooting product fields."""
import os
import uuid

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _products(headers):
    return requests.get(f"{API}/admin/products", headers=headers, timeout=15).json()


def _mk_coupon(headers, code, percent, product_id=None):
    r = requests.post(f"{API}/admin/coupons",
                      json={"code": code, "percent": percent, "product_id": product_id},
                      headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _del_coupon(headers, cid):
    requests.delete(f"{API}/admin/coupons/{cid}", headers=headers, timeout=15)


def test_product_specific_coupon_discounts_only_that_product(admin_headers):
    prods = requests.get(f"{API}/products", timeout=15).json()  # public list carries stock counts
    with_stock = []
    for p in prods:
        for d, c in (p.get("stock") or {}).items():
            if c > 0 and d in (p.get("prices") or {}):
                with_stock.append((p, d))
                break
        if len(with_stock) == 2:
            break
    assert len(with_stock) == 2, "need two in-stock products for this test"
    (p1, d1), (p2, d2) = with_stock
    code = f"ONLY{uuid.uuid4().hex[:6].upper()}"
    c = _mk_coupon(admin_headers, code, 50, product_id=p1["id"])
    try:
        # validate returns the product scope
        v = requests.post(f"{API}/coupons/validate", json={"code": code}, timeout=15).json()
        assert v["product_id"] == p1["id"]

        # price a cart with both products via bank-transfer order
        r = requests.post(f"{API}/payments/bank-transfer", json={
            "email": "delivered@resend.dev",
            "items": [{"product_id": p1["id"], "duration": d1, "qty": 1},
                      {"product_id": p2["id"], "duration": d2, "qty": 1}],
            "coupon": code, "origin_url": BASE,
        }, timeout=30)
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]
        from dotenv import load_dotenv
        from pymongo import MongoClient
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
        db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        order = db.orders.find_one({"id": order_id})
        items = {i["product_id"]: i for i in order["items"]}
        p1_price = float(p1["prices"][d1])
        p2_price = float(p2["prices"][d2])
        assert abs(items[p1["id"]]["unit_price"] - p1_price * 0.5) < 0.02, "p1 should be 50% off"
        assert abs(items[p2["id"]]["unit_price"] - p2_price) < 0.02, "p2 must stay full price"

        # cleanup order reservation
        requests.post(f"{API}/admin/orders/{order_id}/cancel", headers=admin_headers, timeout=15)
    finally:
        _del_coupon(admin_headers, c["id"])


def test_coupon_rejects_unknown_product(admin_headers):
    r = requests.post(f"{API}/admin/coupons",
                      json={"code": f"BAD{uuid.uuid4().hex[:6].upper()}", "percent": 10,
                            "product_id": "nonexistent-product"},
                      headers=admin_headers, timeout=15)
    assert r.status_code == 404


def test_banner_returns_best_storewide_and_ignores_product_codes(admin_headers):
    code = f"BNR{uuid.uuid4().hex[:6].upper()}"
    pcode = f"BNRP{uuid.uuid4().hex[:5].upper()}"
    prods = _products(admin_headers)
    c1 = _mk_coupon(admin_headers, code, 42)  # store-wide, high
    c2 = _mk_coupon(admin_headers, pcode, 99, product_id=prods[0]["id"])  # product-only, higher
    try:
        b = requests.get(f"{API}/coupons/banner", timeout=15).json()
        assert b["code"] == code and b["percent"] == 42, b
        # disable the store-wide one -> banner should not fall back to the product code
        requests.put(f"{API}/admin/coupons/{c1['id']}", json={"active": False}, headers=admin_headers, timeout=15)
        b2 = requests.get(f"{API}/coupons/banner", timeout=15).json()
        assert b2["code"] != pcode, "product-specific codes must never appear on the banner"
        if b2["code"] is not None:
            # another store-wide code (e.g. DESYNC10) may still be active — that's fine
            assert b2["code"] != code
    finally:
        _del_coupon(admin_headers, c1["id"])
        _del_coupon(admin_headers, c2["id"])


def test_category_reorder(admin_headers):
    cats = requests.get(f"{API}/categories", timeout=15).json()
    assert len(cats) >= 1
    ids = [c["id"] for c in cats]
    if len(ids) < 2:
        pytest.skip("need 2+ categories to test ordering")
    rev = list(reversed(ids))
    r = requests.post(f"{API}/admin/categories/reorder", json={"ids": rev}, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    after = requests.get(f"{API}/categories", timeout=15).json()
    assert [c["id"] for c in after] == rev
    # restore
    requests.post(f"{API}/admin/categories/reorder", json={"ids": ids}, headers=admin_headers, timeout=15)
    # guards
    assert requests.post(f"{API}/admin/categories/reorder", json={"ids": ids}, timeout=15).status_code == 401
    bad = requests.post(f"{API}/admin/categories/reorder", json={"ids": ["bogus"]}, headers=admin_headers, timeout=15)
    assert bad.status_code == 400


def test_product_sysreq_and_troubleshooting_roundtrip(admin_headers):
    payload = {
        "game": "FiveM", "name": f"TMP Sysreq {uuid.uuid4().hex[:6]}",
        "description": "t", "image_url": "", "prices": {"day": 1.0},
        "system_requirements": "Windows 11\n8 GB RAM",
        "troubleshooting": [{"issue": "Won't open", "fix": "Run as admin"}],
        "delivery": "stock", "kind": "cheat",
    }
    r = requests.post(f"{API}/admin/products", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    prod = r.json()
    assert prod["system_requirements"] == "Windows 11\n8 GB RAM"
    assert prod["troubleshooting"] == [{"issue": "Won't open", "fix": "Run as admin"}]
    # public product payload carries the fields
    pub = next(p for p in requests.get(f"{API}/products", timeout=15).json() if p["id"] == prod["id"])
    assert pub["system_requirements"] == "Windows 11\n8 GB RAM"
    assert pub["troubleshooting"][0]["issue"] == "Won't open"
    requests.delete(f"{API}/admin/products/{prod['id']}", headers=admin_headers, timeout=15)

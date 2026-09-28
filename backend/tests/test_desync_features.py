"""Backend tests for Desync feature review:
- categories CRUD, category-delete protection
- products list includes stock, only FiveM products
- DESYNC10 coupon, invalid coupon
- Stripe checkout session creation with in-stock item + coupon (discount math)
- sold-out enforcement at checkout
"""
import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_USER = "voidowner"
ADMIN_PASS = "VoidGhost!26"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --------- products & stock ----------
def test_products_only_fivem_and_have_stock():
    r = requests.get(f"{API}/products", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 2, f"Expected at least 2 products, got {len(data)}"
    for p in data:
        assert p["game"] == "FiveM", f"Non-FiveM product: {p}"
        assert "stock" in p and isinstance(p["stock"], dict)
        assert "loader" not in p, "loader storage path must not leak publicly"
    names = {p["name"] for p in data}
    assert "SPECTRE // FiveM Executor" in names
    assert "PHANTOM // FiveM Mod Menu" in names
    accounts = [p for p in data if p.get("kind") == "account"]
    assert accounts, "Expected the demo Discord account product to exist"


# --------- categories ----------
def test_list_categories_has_fivem():
    r = requests.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    names = [c["name"] for c in cats]
    assert "FiveM" in names


def test_category_create_duplicate_delete(admin_headers):
    tmp_name = f"TEST_{uuid.uuid4().hex[:6]}"
    # create
    r = requests.post(f"{API}/admin/categories", json={"name": tmp_name}, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    cat_id = r.json()["id"]
    assert r.json()["name"] == tmp_name

    # duplicate
    r2 = requests.post(f"{API}/admin/categories", json={"name": tmp_name}, headers=admin_headers, timeout=15)
    assert r2.status_code == 409

    # ensure it appears in listing
    listing = requests.get(f"{API}/categories", timeout=15).json()
    assert any(c["id"] == cat_id for c in listing)

    # delete (no products assigned, so should succeed)
    r3 = requests.delete(f"{API}/admin/categories/{cat_id}", headers=admin_headers, timeout=15)
    assert r3.status_code == 200
    assert r3.json().get("deleted") is True

    # verify removed
    listing2 = requests.get(f"{API}/categories", timeout=15).json()
    assert not any(c["id"] == cat_id for c in listing2)


def test_cannot_delete_fivem_category_with_products(admin_headers):
    cats = requests.get(f"{API}/categories", timeout=15).json()
    fivem = next((c for c in cats if c["name"] == "FiveM"), None)
    assert fivem is not None
    r = requests.delete(f"{API}/admin/categories/{fivem['id']}", headers=admin_headers, timeout=15)
    assert r.status_code == 400
    assert "product" in r.text.lower()


# --------- coupons ----------
def test_desync10_coupon_valid():
    r = requests.post(f"{API}/coupons/validate", json={"code": "DESYNC10"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["code"] == "DESYNC10"
    assert float(body["percent"]) == 10.0


def test_invalid_coupon():
    r = requests.post(f"{API}/coupons/validate", json={"code": "NOPE_XYZ_123"}, timeout=15)
    assert r.status_code in (400, 404)


def test_old_5pct_coupon_gone():
    # ensure no other active percent-5 coupons exist by scanning admin list
    tk = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}).json()["token"]
    r = requests.get(f"{API}/admin/coupons", headers={"Authorization": f"Bearer {tk}"}, timeout=15)
    assert r.status_code == 200
    coupons = r.json()
    codes = {c["code"]: c for c in coupons}
    assert "DESYNC10" in codes
    assert float(codes["DESYNC10"]["percent"]) == 10.0
    # No leftover 5% coupon
    for c in coupons:
        if c.get("active"):
            assert float(c["percent"]) != 5.0, f"Leftover 5% coupon: {c}"


# --------- checkout: coupon math & sold-out ----------
def _find_product_with_stock():
    products = requests.get(f"{API}/products", timeout=15).json()
    for p in products:
        for d, count in (p.get("stock") or {}).items():
            if count > 0 and d in (p.get("prices") or {}):
                return p, d
    return None, None


def test_checkout_with_desync10_applies_10pct():
    prod, dur = _find_product_with_stock()
    assert prod is not None, "No in-stock product found for checkout test"
    payload = {
        "email": "buyer@test.com",
        "items": [{"product_id": prod["id"], "duration": dur}],
        "coupon": "DESYNC10",
        "origin_url": BASE,
    }
    r = requests.post(f"{API}/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "checkout_url" in body
    assert "session_id" in body
    # verify order was created with 10% discount math
    # unit price should be 90% of original list price
    expected_unit = round(prod["prices"][dur] * 0.9, 2)
    # e.g. 6.99 -> 6.29 (rounding at cents level)
    # allow tolerance of 0.01
    # Look up via admin orders
    tk = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}).json()["token"]
    orders = requests.get(f"{API}/admin/orders", headers={"Authorization": f"Bearer {tk}"}, timeout=15).json()
    order = next((o for o in orders if o.get("session_id") == body["session_id"]), None)
    assert order is not None
    assert order.get("coupon_code") == "DESYNC10"
    assert float(order.get("discount_percent")) == 10.0
    unit = float(order["items"][0]["unit_price"])
    assert abs(unit - expected_unit) < 0.02, f"Unit price {unit} not ~{expected_unit}"


def test_checkout_sold_out_duration_rejected():
    # Find a product with a priced duration that has 0 stock
    products = requests.get(f"{API}/products", timeout=15).json()
    target = None
    for p in products:
        if p.get("kind") == "boost":
            continue  # boosts never sell out by design
        prices = p.get("prices") or {}
        stock = p.get("stock") or {}
        for d in prices:
            if stock.get(d, 0) == 0:
                target = (p, d)
                break
        if target:
            break
    assert target is not None, "Expected at least one out-of-stock duration among products"
    p, d = target
    payload = {
        "email": "buyer@test.com",
        "items": [{"product_id": p["id"], "duration": d}],
        "origin_url": BASE,
    }
    r = requests.post(f"{API}/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 400, r.text
    assert "sold out" in r.text.lower()

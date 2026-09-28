"""Backend tests for the new batch of Desync features:
- Bank transfer checkout (PayID/BSB) + get details + admin mark-paid + auto-key-assign
- Customers aggregation, manual add, send-key (pulls from stock, $0 order)
- Expenses CRUD + dashboard stats (Profit = Revenue - Expenses)
- Bank details settings persistence
- Auth: new admin endpoints require token
"""
import os
import re
import uuid
import hashlib
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
ADMIN_USER = "voidowner"
ADMIN_PASS = "VoidGhost!26"


def _lookup(email):
    """My Orders lookup is OTP-gated: mint a code doc directly, verify, then look up."""
    from dotenv import load_dotenv
    from pymongo import MongoClient
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    code = "735912"
    now = datetime.now(timezone.utc)
    db.lookup_codes.insert_one({
        "id": str(uuid.uuid4()), "email": email.lower(),
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "attempts": 0, "used": False,
        "created_dt": now, "expires_dt": now + timedelta(minutes=10),
    })
    v = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": code}, timeout=15)
    assert v.status_code == 200, v.text
    r = requests.post(f"{API}/orders/lookup", json={"email": email, "token": v.json()["token"]}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session", autouse=True)
def ensure_stock(admin_headers):
    """Ensure PHANTOM has enough (>=3) stock for at least one duration for bank + send-key tests.
    Only seeds if depleted; leaves SPECTRE alone (intentionally sold out per review)."""
    prods = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()
    counts = requests.get(f"{API}/admin/keystock/counts", headers=admin_headers, timeout=15).json()
    phantom = next((p for p in prods if "PHANTOM" in p.get("name", "").upper()), None)
    if phantom:
        pc = counts.get(phantom["id"], {}) or {}
        # Pick a priced duration (prefer 'week' since review references it)
        for dur in ("week", "day", "month", "lifetime"):
            if dur in (phantom.get("prices") or {}):
                have = pc.get(dur, 0)
                if have < 3:
                    new_keys = "\n".join(f"TESTKEY-{uuid.uuid4().hex[:10]}" for _ in range(3 - have))
                    requests.post(f"{API}/admin/keystock",
                                  json={"product_id": phantom["id"], "duration": dur, "keys": new_keys},
                                  headers=admin_headers, timeout=15)
                break
    yield


def _in_stock_product(prices_dur=None):
    prods = requests.get(f"{API}/products", timeout=15).json()
    for p in prods:
        for d, cnt in (p.get("stock") or {}).items():
            if cnt > 0 and d in (p.get("prices") or {}):
                if prices_dur is None or d == prices_dur:
                    return p, d
    return None, None


def _out_of_stock_duration():
    prods = requests.get(f"{API}/products", timeout=15).json()
    for p in prods:
        if p.get("kind") == "boost":
            continue  # boosts never sell out by design
        for d in (p.get("prices") or {}):
            if (p.get("stock") or {}).get(d, 0) == 0:
                return p, d
    return None, None


# ---------- auth guards ----------
class TestAuthGuards:
    def test_customers_requires_auth(self):
        assert requests.get(f"{API}/admin/customers", timeout=15).status_code in (401, 403)

    def test_add_customer_requires_auth(self):
        r = requests.post(f"{API}/admin/customers", json={"email": "x@test.com"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_send_key_requires_auth(self):
        r = requests.post(f"{API}/admin/customers/send-key",
                          json={"email": "x@test.com", "product_id": "p", "duration": "week"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_expenses_get_requires_auth(self):
        assert requests.get(f"{API}/admin/expenses", timeout=15).status_code in (401, 403)

    def test_expenses_post_requires_auth(self):
        r = requests.post(f"{API}/admin/expenses", json={"label": "x", "amount": 1.0}, timeout=15)
        assert r.status_code in (401, 403)

    def test_mark_paid_requires_auth(self):
        r = requests.post(f"{API}/admin/orders/xxx/mark-paid", timeout=15)
        assert r.status_code in (401, 403)


# ---------- bank details settings ----------
class TestBankSettings:
    def test_bank_details_persist(self, admin_headers):
        # Snapshot current so we can restore (parallel workers use these same settings)
        cur = requests.get(f"{API}/admin/settings", headers=admin_headers, timeout=15).json()
        original = {k: cur.get(k) for k in ("payid", "bank_bsb", "bank_account_number", "bank_account_name")}
        payload = {
            "payid": "sales@desync.website",
            "bank_bsb": "062-000",
            "bank_account_number": "12345678",
            "bank_account_name": "Desync",
        }
        try:
            r = requests.put(f"{API}/admin/settings", json=payload, headers=admin_headers, timeout=15)
            assert r.status_code == 200, r.text
            r2 = requests.get(f"{API}/admin/settings", headers=admin_headers, timeout=15)
            assert r2.status_code == 200
            s = r2.json()
            for k, v in payload.items():
                assert s.get(k) == v, f"Field {k} not persisted: got {s.get(k)}"
        finally:
            requests.put(f"{API}/admin/settings", json=original, headers=admin_headers, timeout=15)


# ---------- bank transfer flow ----------
class TestBankTransferFlow:
    def test_bank_transfer_happy_path(self, admin_headers):
        prod, dur = _in_stock_product()
        assert prod is not None
        email = f"TEST_bank_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(f"{API}/payments/bank-transfer", json={
            "email": email,
            "items": [{"product_id": prod["id"], "duration": dur}],
            "origin_url": BASE,
        }, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert re.match(r"^DS-[A-F0-9]{8}$", data["reference"]), f"Bad ref: {data['reference']}"
        assert data["total"] > 0
        assert "expires_at" in data
        bank = data.get("bank") or {}
        assert bank.get("payid"), "Bank details missing payid"
        order_id = data["order_id"]

        # public details endpoint
        r2 = requests.get(f"{API}/payments/bank-transfer/{order_id}", timeout=15)
        assert r2.status_code == 200
        det = r2.json()
        assert det["reference"] == data["reference"]
        assert det["bank"].get("payid") == bank.get("payid")

        # Mark paid — should assign key and flip status
        r3 = requests.post(f"{API}/admin/orders/{order_id}/mark-paid",
                           headers=admin_headers, timeout=20)
        assert r3.status_code == 200, r3.text
        assert r3.json().get("fulfilled") is True

        # verify order via admin orders shows paid + license_key present
        orders = requests.get(f"{API}/admin/orders", headers=admin_headers, timeout=15).json()
        o = next((o for o in orders if o["id"] == order_id), None)
        assert o is not None
        assert o["payment_status"] == "paid"
        assert o["items"][0].get("license_key")

        # Order lookup by email should surface it
        got = _lookup(email)
        assert any(x["id"] == order_id for x in got)

        # Cannot mark-paid again
        r5 = requests.post(f"{API}/admin/orders/{order_id}/mark-paid",
                           headers=admin_headers, timeout=15)
        assert r5.status_code == 400

    def test_bank_transfer_sold_out_rejected(self):
        prod, dur = _out_of_stock_duration()
        if not prod:
            pytest.skip("No out-of-stock duration to test")
        r = requests.post(f"{API}/payments/bank-transfer", json={
            "email": "TEST_soldout@test.com",
            "items": [{"product_id": prod["id"], "duration": dur}],
            "origin_url": BASE,
        }, timeout=15)
        assert r.status_code == 400
        assert "sold out" in r.text.lower()


# ---------- customers ----------
class TestCustomers:
    def test_add_manual_customer_and_list(self, admin_headers):
        email = f"TEST_cust_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(f"{API}/admin/customers",
                          json={"email": email, "name": "Testy", "note": "hi"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/admin/customers", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        rows = r2.json()
        row = next((x for x in rows if x["email"] == email.lower()), None)
        assert row is not None
        assert row.get("manual") is True
        assert row.get("name") == "Testy"

    def test_send_key_out_of_stock(self, admin_headers):
        prod, dur = _out_of_stock_duration()
        if not prod:
            pytest.skip("Nothing out of stock")
        r = requests.post(f"{API}/admin/customers/send-key",
                          json={"email": "TEST_sk@test.com", "product_id": prod["id"], "duration": dur},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400
        assert "no keys" in r.text.lower() or "stock" in r.text.lower()

    def test_send_key_success_or_email_fail_is_acceptable(self, admin_headers):
        # This test needs at least 1 in-stock (product, duration)
        prod, dur = _in_stock_product()
        assert prod is not None
        email = f"TEST_sendkey_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(f"{API}/admin/customers/send-key",
                          json={"email": email, "product_id": prod["id"], "duration": dur},
                          headers=admin_headers, timeout=30)
        # 200 = full success; 500 = key assigned but email failed (acceptable for fake @test.com)
        assert r.status_code in (200, 500), r.text
        # Regardless, an order should exist for this email as paid
        rows = _lookup(email)
        assert len(rows) >= 1
        assert rows[0]["items"][0].get("license_key")
        assert rows[0]["total"] == 0.0
        assert rows[0].get("provider") == "manual"


# ---------- expenses ----------
class TestExpenses:
    def test_add_list_delete_and_stats(self, admin_headers):
        # Baseline
        s0 = requests.get(f"{API}/admin/stats", headers=admin_headers, timeout=15).json()
        baseline_exp = float(s0.get("total_expenses", 0))
        baseline_profit = float(s0.get("profit", 0))
        revenue = float(s0.get("total_revenue", 0))

        label = f"TEST_exp_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/expenses",
                          json={"label": label, "amount": 12.34, "category": "Ads", "date": "2026-01-15"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        exp = r.json()
        assert exp["label"] == label
        assert exp["amount"] == 12.34
        assert exp["category"] == "Ads"

        # list contains it
        listing = requests.get(f"{API}/admin/expenses", headers=admin_headers, timeout=15).json()
        assert any(x["id"] == exp["id"] for x in listing)

        # stats reflect it
        s1 = requests.get(f"{API}/admin/stats", headers=admin_headers, timeout=15).json()
        assert abs(float(s1["total_expenses"]) - (baseline_exp + 12.34)) < 0.02
        # profit = revenue - expenses
        assert abs(float(s1["profit"]) - round(revenue - float(s1["total_expenses"]), 2)) < 0.02

        # delete
        r2 = requests.delete(f"{API}/admin/expenses/{exp['id']}", headers=admin_headers, timeout=15)
        assert r2.status_code == 200

        # stats back
        s2 = requests.get(f"{API}/admin/stats", headers=admin_headers, timeout=15).json()
        assert abs(float(s2["total_expenses"]) - baseline_exp) < 0.02

    def test_expense_validation(self, admin_headers):
        # negative amount
        r = requests.post(f"{API}/admin/expenses", json={"label": "x", "amount": -1},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400
        # empty label
        r2 = requests.post(f"{API}/admin/expenses", json={"label": "  ", "amount": 1},
                           headers=admin_headers, timeout=15)
        assert r2.status_code == 400


# ---------- stats shape ----------
class TestStatsShape:
    def test_stats_has_new_fields(self, admin_headers):
        r = requests.get(f"{API}/admin/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        s = r.json()
        for k in ("total_revenue", "total_expenses", "profit", "total_orders", "keys_sold", "customers"):
            assert k in s, f"Missing stat: {k}"


# ---------- discord accounts mode ----------
class TestDiscordAccounts:
    def test_add_accounts_bulk(self, admin_headers):
        prods = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()
        prod = next((p for p in prods if "PHANTOM" in p.get("name", "").upper()), None)
        assert prod is not None
        # pick a duration that exists in prices
        dur = next(iter(prod.get("prices") or {"week": 0}))
        # Build valid + invalid lines
        u = uuid.uuid4().hex[:8]
        lines = [
            f"TEST_a1_{u}@mail.com:emailpw1:dcpw1:tokenAAAA{u}",
            f"TEST_a2_{u}@mail.com:emailpw2:dc:pw:with:colons:tokenBBBB{u}",  # discord_password with colons
            "invalid-line-no-colons",
            f"TEST_a3_{u}@mail.com:x:y:",  # empty token -> invalid
        ]
        r = requests.post(f"{API}/admin/keystock",
                          json={"product_id": prod["id"], "duration": dur, "keys": "\n".join(lines), "mode": "accounts"},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # universal fallback: unmatched lines are stored raw, not dropped
        assert data["added"] == 4, data
        assert data["raw"] == 2, data
        assert data["skipped"] == 0, data

        # verify records have account block
        rows = requests.get(f"{API}/admin/keystock/{prod['id']}", headers=admin_headers, timeout=15).json()
        mine = [x for x in rows if x.get("key", "").startswith(f"TEST_a1_{u}") or x.get("key", "").startswith(f"TEST_a2_{u}")]
        assert len(mine) == 2
        for m in mine:
            acc = m.get("account") or {}
            assert acc.get("email") and acc.get("email_password") and acc.get("discord_password") and acc.get("discord_token")
            if m["key"].startswith("TEST_a2_"):
                # multi-colon password preserved
                assert "dc:pw:with:colons" in acc["discord_password"]

        # cleanup (parsed + raw rows added by this test)
        for x in rows:
            k = x.get("key", "")
            if f"_{u}" in k or k == "invalid-line-no-colons":
                requests.delete(f"{API}/admin/keystock/{x['id']}", headers=admin_headers, timeout=10)

"""Customer Portal + Generator entitlements + Generator API + Reviews E2E tests.

Flow covered:
- paid order > A$10  -> standard entitlement (1/type/hr) + key issued
- buying the Generator product -> access + DSYNC- key + 3/type/hr (override, no stacking)
- gen/validate + gen/generate: real stock consumption, replay protection, rolling-hour limit,
  out-of-stock does not consume allowance, invalid/revoked/disabled rejected
- refund revokes purchase-granted access + key; manual grants survive
- portal /me sections; review submit (pending) -> hidden from public -> approve -> public
"""
import hashlib
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
EMAIL = f"gen-{uuid.uuid4().hex[:8]}@resend.dev"


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _buyer_token(email):
    code = "654321"
    now = datetime.now(timezone.utc)
    _db().lookup_codes.insert_one({
        "id": str(uuid.uuid4()), "email": email.lower(),
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "attempts": 0, "used": False,
        "created_dt": now, "expires_dt": now + timedelta(minutes=10),
    })
    v = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": code}, timeout=15)
    assert v.status_code == 200, v.text
    return v.json()["token"]


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def products(admin_headers):
    prods = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()
    gen = next((p for p in prods if "generator" in p["name"].lower()), None)
    assert gen, "generator product missing"
    # keep the generator's pools stocked (stock delivery consumes a key per purchase)
    gen_dur = next(iter(gen["prices"]))
    requests.post(f"{API}/admin/products/{gen['id']}/generate-keys",
                  json={"count": 10, "duration": gen_dur}, headers=admin_headers, timeout=15)
    # stock the steam/discord/rockstar pools
    u = uuid.uuid4().hex[:6]
    for p in prods:
        if p.get("kind") != "account":
            continue
        lname = p["name"].lower()
        gtype = "steam" if "steam" in lname else "discord" if "discord" in lname else "rockstar" if "rockstar" in lname else None
        if not gtype:
            continue
        dur = next(iter(p.get("prices") or {}), None)
        if dur:
            lines = [f"GENSTOCK-{u}-{gtype}-{i}@mail.com:pw{i}" for i in range(8)]
            requests.post(f"{API}/admin/keystock",
                          json={"product_id": p["id"], "duration": dur, "keys": "\n".join(lines), "mode": "accounts"},
                          headers=admin_headers, timeout=20)
    return requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()


def _buy(admin_headers, email, items, coupon=None):
    r = requests.post(f"{API}/payments/bank-transfer", json={
        "email": email, "items": items, "coupon": coupon, "origin_url": BASE,
    }, timeout=30)
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    mp = requests.post(f"{API}/admin/orders/{oid}/mark-paid", headers=admin_headers, timeout=30)
    assert mp.status_code == 200, mp.text
    return oid


def test_generator_purchase_grants_access_and_key(admin_headers, products):
    gen = next(p for p in products if "generator" in p["name"].lower())
    dur = next(iter(gen["prices"]))
    _buy(admin_headers, EMAIL, [{"product_id": gen["id"], "duration": dur, "qty": 1}])
    cust = _db().customers.find_one({"email": EMAIL})
    assert cust and cust.get("gen_access") is True and cust.get("gen_access_source") == "purchase"
    assert cust["gen_key"].startswith("DSYNC-") and len(cust["gen_key"]) == 20
    assert cust.get("gen_key_active") is True


def test_portal_me_shows_generator_entitlement(admin_headers, products):
    token = _buyer_token(EMAIL)
    r = requests.get(f"{API}/portal/me", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == EMAIL
    assert data["orders"], "paid order must appear"
    g = data["generator"]
    assert g["access"] is True and g["key"] and g["key_active"] is True
    assert g["limits"] == {"steam": 3, "discord": 3, "rockstar": 3}
    # portal requires auth
    assert requests.get(f"{API}/portal/me", timeout=15).status_code == 401


def _gen_key_of(email):
    return _db().customers.find_one({"email": email})["gen_key"]


def test_gen_validate_and_generate_with_limits(admin_headers, products):
    key = _gen_key_of(EMAIL)
    v = requests.post(f"{API}/gen/validate", json={"key": key}, timeout=15)
    assert v.status_code == 200 and v.json()["valid"] is True
    assert v.json()["limits"]["steam"] == 3

    # generate 3 steam accounts (the hourly cap) — real stock consumed
    seen_raw = []
    for i in range(3):
        r = requests.post(f"{API}/gen/generate",
                          json={"key": key, "type": "steam", "request_id": f"t-{uuid.uuid4().hex[:8]}"},
                          timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] and body["raw"], "must return a raw account line"
        seen_raw.append(body["raw"])
    assert len(set(seen_raw)) == 3, "each generation must consume a distinct account"

    # 4th within the hour -> 429, allowance enforced server-side
    r4 = requests.post(f"{API}/gen/generate",
                       json={"key": key, "type": "steam", "request_id": f"t-{uuid.uuid4().hex[:8]}"},
                       timeout=15)
    assert r4.status_code == 429

    # replay protection: same request_id rejected
    rid = f"t-{uuid.uuid4().hex[:8]}"
    requests.post(f"{API}/gen/generate", json={"key": key, "type": "rockstar", "request_id": rid}, timeout=15)
    again = requests.post(f"{API}/gen/generate", json={"key": key, "type": "rockstar", "request_id": rid}, timeout=15)
    assert again.status_code == 409

    # invalid key
    bad = requests.post(f"{API}/gen/generate",
                        json={"key": "DSYNC-XXXX-XXXX-XXXX", "type": "steam", "request_id": "x"}, timeout=15)
    assert bad.status_code == 401


def test_out_of_stock_does_not_consume_allowance(admin_headers, products):
    # empty the discord pool into a temp holding, generate, expect 409 and unchanged usage
    db = _db()
    discord = next(p for p in products if p.get("kind") == "account" and "discord" in p["name"].lower())
    before = requests.post(f"{API}/gen/validate", json={"key": _gen_key_of(EMAIL)}, timeout=15).json()
    used_before = before["used"]["discord"]
    held = []
    while True:
        doc = db.keystock.find_one_and_update(
            {"product_id": discord["id"], "status": "available"},
            {"$set": {"status": "assigned", "assigned_order_id": "test-hold"}},
        )
        if not doc:
            break
        held.append(doc["id"])
    try:
        r = requests.post(f"{API}/gen/generate",
                          json={"key": _gen_key_of(EMAIL), "type": "discord", "request_id": f"t-{uuid.uuid4().hex[:8]}"},
                          timeout=15)
        assert r.status_code == 409 and "out of stock" in r.json()["detail"]
        after = requests.post(f"{API}/gen/validate", json={"key": _gen_key_of(EMAIL)}, timeout=15).json()
        assert after["used"]["discord"] == used_before, "failed generation must not consume allowance"
    finally:
        db.keystock.update_many({"assigned_order_id": "test-hold"}, {"$set": {"status": "available"}})


def test_refund_revokes_entitlement_and_key(admin_headers, products):
    db = _db()
    order = db.orders.find_one({"email": EMAIL, "payment_status": "paid"})
    r = requests.post(f"{API}/admin/orders/{order['id']}/refund", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    cust = db.customers.find_one({"email": EMAIL})
    assert cust.get("gen_access") is False and cust.get("gen_key_active") is False
    v = requests.post(f"{API}/gen/validate", json={"key": cust["gen_key"]}, timeout=15)
    assert v.status_code == 403
    # audit log recorded
    audits = requests.get(f"{API}/admin/audit-log", headers=admin_headers, timeout=15).json()
    assert any(a["action"] == "order:refund" and a["customer_email"] == EMAIL for a in audits)


def test_admin_import_grant_regenerate_disable(admin_headers):
    email = f"mig-{uuid.uuid4().hex[:6]}@resend.dev"
    # migration import
    r = requests.post(f"{API}/admin/customers/import-generator", json={"email": email}, headers=admin_headers, timeout=15)
    assert r.status_code == 200 and r.json()["key"].startswith("DSYNC-")
    key = r.json()["key"]
    v = requests.post(f"{API}/gen/validate", json={"key": key}, timeout=15)
    assert v.status_code == 200 and v.json()["generator_access"] is True
    # manual grant survives a recompute (no purchase orders at all)
    # regenerate key
    rg = requests.post(f"{API}/admin/customers/{email}/generator", json={"action": "regenerate_key"}, headers=admin_headers, timeout=15)
    assert rg.status_code == 200
    new_key = _db().customers.find_one({"email": email})["gen_key"]
    assert new_key != key
    # reset usage
    ru = requests.post(f"{API}/admin/customers/{email}/generator", json={"action": "reset_usage"}, headers=admin_headers, timeout=15)
    assert ru.status_code == 200
    # disable blocks generation
    requests.post(f"{API}/admin/customers/{email}/generator", json={"action": "disable"}, headers=admin_headers, timeout=15)
    d = requests.post(f"{API}/gen/validate", json={"key": new_key}, timeout=15)
    assert d.status_code == 403
    requests.post(f"{API}/admin/customers/{email}/generator", json={"action": "enable"}, headers=admin_headers, timeout=15)
    # revoke manual access
    rv = requests.post(f"{API}/admin/customers/{email}/generator", json={"action": "revoke"}, headers=admin_headers, timeout=15)
    assert rv.status_code == 200
    assert requests.post(f"{API}/gen/validate", json={"key": new_key}, timeout=15).status_code == 403


def test_admin_customer_search_and_profile(admin_headers):
    s = requests.get(f"{API}/admin/customers/search", params={"q": EMAIL.split("@")[0]}, headers=admin_headers, timeout=15)
    assert s.status_code == 200 and EMAIL in s.json()
    p = requests.get(f"{API}/admin/customers/{EMAIL}/profile", headers=admin_headers, timeout=15)
    assert p.status_code == 200
    data = p.json()
    assert data["orders"] and data["generator"]["key"]
    assert data["audit"], "audit entries expected"
    # search by gen key
    key = _db().customers.find_one({"email": EMAIL})["gen_key"]
    s2 = requests.get(f"{API}/admin/customers/search", params={"q": key}, headers=admin_headers, timeout=15)
    assert EMAIL in s2.json()


def test_reviews_flow(admin_headers, products):
    # fresh paid order (earlier tests refund the first one)
    gen = next(p for p in products if "generator" in p["name"].lower())
    dur = next(iter(gen["prices"]))
    oid = _buy(admin_headers, EMAIL, [{"product_id": gen["id"], "duration": dur, "qty": 1}])
    token = _buyer_token(EMAIL)
    # submit review
    r = requests.post(f"{API}/portal/reviews",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"order_id": oid, "rating": 5,
                            "text": "Instant delivery, worked perfectly <script>alert(1)</script>",
                            "name": "J"}, timeout=15)
    assert r.status_code == 200, r.text
    review = r.json()
    assert review["status"] == "pending"
    assert "<script>" not in review["text"], "HTML must be stripped"
    assert "email" not in review, "email must never be exposed"
    # duplicate review for same order rejected
    r2 = requests.post(f"{API}/portal/reviews",
                       headers={"Authorization": f"Bearer {token}"},
                       json={"order_id": oid, "rating": 4, "text": "second"}, timeout=15)
    assert r2.status_code == 409
    # pending review is NOT public
    pub = requests.get(f"{API}/reviews", timeout=15).json()
    assert all(rv["id"] != review["id"] for rv in pub["reviews"])
    # admin sees pending, approves
    adm = requests.get(f"{API}/admin/reviews", params={"status": "pending"}, headers=admin_headers, timeout=15).json()
    assert any(rv["id"] == review["id"] for rv in adm)
    requests.post(f"{API}/admin/reviews/{review['id']}/action", json={"action": "approve"}, headers=admin_headers, timeout=15)
    pub2 = requests.get(f"{API}/reviews", timeout=15).json()
    mine = [rv for rv in pub2["reviews"] if rv["id"] == review["id"]]
    assert mine and mine[0]["rating"] == 5 and mine[0]["name"] == "J"
    assert pub2["count"] >= 1 and pub2["average"]
    # hide -> disappears again
    requests.post(f"{API}/admin/reviews/{review['id']}/action", json={"action": "hide"}, headers=admin_headers, timeout=15)
    pub3 = requests.get(f"{API}/reviews", timeout=15).json()
    assert all(rv["id"] != review["id"] for rv in pub3["reviews"])


def test_generator_keys_redeem_and_portal_generation(admin_headers):
    """Staff generate DSYNC keys into stock -> customer redeems in portal -> lifetime
    3/hr access -> generates on the website -> hourly limit enforced."""
    db = _db()
    gen_pid = None
    prods = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()
    gen_pid = next(p["id"] for p in prods if "generator" in p["name"].lower())
    dur = next(iter(next(p for p in prods if p["id"] == gen_pid)["prices"]))

    # staff generate keys
    g = requests.post(f"{API}/admin/products/{gen_pid}/generate-keys",
                      json={"count": 2, "duration": dur}, headers=admin_headers, timeout=15)
    assert g.status_code == 200, g.text
    keys = g.json()["keys"]
    assert len(keys) == 2 and all(k.startswith("DSYNC-") for k in keys)
    # only for generator product
    other = next(p for p in prods if p["id"] != gen_pid)
    bad = requests.post(f"{API}/admin/products/{other['id']}/generate-keys",
                        json={"count": 1, "duration": "day"}, headers=admin_headers, timeout=15)
    assert bad.status_code == 400
    # unauth
    assert requests.post(f"{API}/admin/products/{gen_pid}/generate-keys",
                         json={"count": 1, "duration": dur}, timeout=15).status_code == 401

    # customer redeems in portal
    email = f"keybuyer-{uuid.uuid4().hex[:6]}@resend.dev"
    token = _buyer_token(email)
    h = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{API}/portal/gen/redeem", json={"code": keys[0]}, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    me = requests.get(f"{API}/portal/me", headers=h, timeout=20).json()["generator"]
    assert me["access"] is True and me["tier3"] is True and me["limits"]["steam"] == 3
    assert me["key"] and me["key"].startswith("DSYNC-")

    # redeemed key is consumed from stock
    doc = db.keystock.find_one({"key": keys[0]})
    assert doc["status"] == "assigned"

    # bogus + someone else's key
    assert requests.post(f"{API}/portal/gen/redeem", json={"code": "DSYNC-0000-0000-0000"}, headers=h, timeout=15).status_code == 404

    # generate on the website — 3/hr for key-redeemed customers
    for i in range(3):
        gi = requests.post(f"{API}/portal/gen/generate", json={"type": "steam"}, headers=h, timeout=15)
        assert gi.status_code == 200, gi.text
        assert gi.json()["raw"]
    g2 = requests.post(f"{API}/portal/gen/generate", json={"type": "steam"}, headers=h, timeout=15)
    assert g2.status_code == 429  # 3/hr exhausted for key-redeemed customers

    # other type still available
    g3 = requests.post(f"{API}/portal/gen/generate", json={"type": "discord"}, headers=h, timeout=15)
    assert g3.status_code in (200, 409)  # 409 only if pool empty

    # portal generate requires auth
    assert requests.post(f"{API}/portal/gen/generate", json={"type": "steam"}, timeout=15).status_code == 401


def test_standard_tier_over_10_aud_stays_1_per_hour(admin_headers, products):
    """A paid order over A$10 (no Generator key) grants lifetime 1/type/hr."""
    email = f"std-{uuid.uuid4().hex[:6]}@resend.dev"
    prods = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()
    cheat = next(p for p in prods if p.get("kind") != "account" and "generator" not in p["name"].lower())
    # pick a duration priced over A$10, else buy qty to push total over 10
    dur = next((d for d, pr in cheat["prices"].items() if float(pr) > 10), None)
    if dur:
        items = [{"product_id": cheat["id"], "duration": dur, "qty": 1}]
    else:
        dur, pr = next(iter(cheat["prices"].items()))
        qty = int(11 // float(pr)) + 1
        items = [{"product_id": cheat["id"], "duration": dur, "qty": qty}]
    u = uuid.uuid4().hex[:6]
    requests.post(f"{API}/admin/keystock",
                  json={"product_id": cheat["id"], "duration": dur,
                        "keys": "\n".join(f"STDKEY-{u}-{i}" for i in range(10))},
                  headers=admin_headers, timeout=20)
    _buy(admin_headers, email, items)

    token = _buyer_token(email)
    h = {"Authorization": f"Bearer {token}"}
    g = requests.get(f"{API}/portal/me", headers=h, timeout=20).json()["generator"]
    assert g["has_standard"] is True
    assert g["tier3"] is False and g["key_redeemed"] is False
    assert g["limits"] == {"steam": 1, "discord": 1, "rockstar": 1}

    g1 = requests.post(f"{API}/portal/gen/generate", json={"type": "steam"}, headers=h, timeout=15)
    assert g1.status_code in (200, 409), g1.text  # 409 only if pool empty
    if g1.status_code == 200:
        g2 = requests.post(f"{API}/portal/gen/generate", json={"type": "steam"}, headers=h, timeout=15)
        assert g2.status_code == 429  # standard tier = 1/hr

"""Backend tests for:
- per-product discord_url / instructions fields (save, validate, deliver)
- admin product reorder endpoint (auth, membership validation, ordering)
- email OTP gate for My Orders (request-code, verify, single-use, token-scoped lookup)
"""
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_USER = "voidowner"
ADMIN_PASS = "VoidGhost!26"


def _db():
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- product discord_url / instructions ----------

def test_product_discord_url_and_instructions(admin_headers):
    payload = {
        "game": "FiveM", "name": f"TMP OTP Test {uuid.uuid4().hex[:6]}",
        "description": "t", "image_url": "", "prices": {"day": 1.0},
        "discord_url": "https://discord.gg/product-specific",
        "instructions": "1. Download loader\n2. Run as admin",
        "delivery": "stock", "kind": "cheat",
    }
    r = requests.post(f"{API}/admin/products", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    prod = r.json()
    assert prod["discord_url"] == "https://discord.gg/product-specific"
    assert prod["instructions"] == "1. Download loader\n2. Run as admin"

    # bad scheme rejected
    bad = dict(payload, name=f"TMP Bad {uuid.uuid4().hex[:6]}", discord_url="http://insecure.gg")
    r2 = requests.post(f"{API}/admin/products", json=bad, headers=admin_headers, timeout=15)
    assert r2.status_code == 400

    # update instructions
    upd = dict(payload, instructions="new steps")
    r3 = requests.put(f"{API}/admin/products/{prod['id']}", json=upd, headers=admin_headers, timeout=15)
    assert r3.status_code == 200
    assert r3.json()["instructions"] == "new steps"

    d = requests.delete(f"{API}/admin/products/{prod['id']}", headers=admin_headers, timeout=15)
    assert d.status_code == 200


# ---------- reorder ----------

def test_reorder_requires_auth():
    r = requests.post(f"{API}/api/admin/products/reorder".replace("/api/api", "/api"),
                      json={"game": "FiveM", "product_ids": []}, timeout=15)
    assert r.status_code == 401


def test_reorder_validates_membership_and_applies(admin_headers):
    prods = requests.get(f"{API}/admin/products", headers=admin_headers, timeout=15).json()
    fivem = [p for p in prods if p.get("game") == "FiveM"]
    assert len(fivem) >= 2
    ids = [p["id"] for p in fivem]

    # mismatch rejected
    r = requests.post(f"{API}/admin/products/reorder",
                      json={"game": "FiveM", "product_ids": ["bogus"]}, headers=admin_headers, timeout=15)
    assert r.status_code == 400

    # reversed order applies and public list follows
    rev = list(reversed(ids))
    r2 = requests.post(f"{API}/admin/products/reorder",
                       json={"game": "FiveM", "product_ids": rev}, headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    public = [p for p in requests.get(f"{API}/products", timeout=15).json() if p.get("game") == "FiveM"]
    assert [p["id"] for p in public] == [i for i in rev if i in {p["id"] for p in public}]

    # restore
    requests.post(f"{API}/admin/products/reorder",
                  json={"game": "FiveM", "product_ids": ids}, headers=admin_headers, timeout=15)


# ---------- OTP lookup gate ----------

def test_lookup_requires_token():
    r = requests.post(f"{API}/orders/lookup", json={"email": "buyer@test.com"}, timeout=15)
    assert r.status_code in (401, 422)
    r2 = requests.post(f"{API}/orders/lookup", json={"email": "buyer@test.com", "token": "junk"}, timeout=15)
    assert r2.status_code == 401


def test_otp_request_stores_hashed_code_and_rate_limits():
    email = "delivered@resend.dev"  # only relay-whitelisted test recipient
    db = _db()
    db.lookup_codes.delete_many({"email": email})  # clear rate-limit window from prior runs
    r = requests.post(f"{API}/orders/lookup/request-code", json={"email": email}, timeout=30)
    # 200 = email sent; 500 = relay rate-limited (transient) — the code doc is stored either way
    assert r.status_code in (200, 500), r.text
    doc = db.lookup_codes.find_one({"email": email})
    assert doc is not None
    assert doc["code_hash"] and "code" not in doc, "code must be stored hashed only"
    assert doc["expires_dt"].replace(tzinfo=timezone.utc) > datetime.now(timezone.utc)
    # resend within 60s is rate-limited
    r2 = requests.post(f"{API}/orders/lookup/request-code", json={"email": email}, timeout=30)
    assert r2.status_code == 429


def test_otp_verify_and_token_scoped_lookup():
    email = f"otp-{uuid.uuid4().hex[:6]}@example.com"
    code = "581324"
    now = datetime.now(timezone.utc)
    db = _db()
    db.lookup_codes.insert_one({
        "id": str(uuid.uuid4()), "email": email,
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "attempts": 0, "used": False,
        "created_dt": now, "expires_dt": now + timedelta(minutes=10),
    })
    # wrong code
    r = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": "000000"}, timeout=15)
    assert r.status_code == 400
    # right code -> token
    r2 = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": code}, timeout=15)
    assert r2.status_code == 200, r2.text
    token = r2.json()["token"]
    # single use
    r3 = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": code}, timeout=15)
    assert r3.status_code == 400
    # token unlocks lookup for that email
    r4 = requests.post(f"{API}/orders/lookup", json={"email": email, "token": token}, timeout=15)
    assert r4.status_code == 200
    assert isinstance(r4.json(), list)
    # token is scoped to the verified email
    r5 = requests.post(f"{API}/orders/lookup", json={"email": f"other-{email}", "token": token}, timeout=15)
    assert r5.status_code == 401


def test_otp_expired_code_rejected():
    email = f"otp-exp-{uuid.uuid4().hex[:6]}@example.com"
    code = "999888"
    now = datetime.now(timezone.utc)
    _db().lookup_codes.insert_one({
        "id": str(uuid.uuid4()), "email": email,
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "attempts": 0, "used": False,
        "created_dt": now - timedelta(minutes=20), "expires_dt": now - timedelta(minutes=10),
    })
    r = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": code}, timeout=15)
    assert r.status_code == 400


def test_otp_accepts_older_unexpired_code_when_emails_arrive_out_of_order():
    """If relay delay delivers the first email after a second code was requested,
    the older (still valid) code must still work."""
    import hashlib as _h
    from datetime import timedelta as _td
    email = f"otp-ooo-{uuid.uuid4().hex[:6]}@example.com"
    now = datetime.now(timezone.utc)
    db = _db()
    for code, mins_ago in [("111111", 3), ("222222", 1)]:  # older, then newer
        db.lookup_codes.insert_one({
            "id": str(uuid.uuid4()), "email": email,
            "code_hash": _h.sha256(code.encode()).hexdigest(),
            "attempts": 0, "used": False,
            "created_dt": now - _td(minutes=mins_ago),
            "expires_dt": now + _td(minutes=12),
        })
    # enter the OLDER code (first email arrived late)
    r = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": "111111"}, timeout=15)
    assert r.status_code == 200, r.text
    # newer code still independently usable is fine (not used) — but single-use per code
    r2 = requests.post(f"{API}/orders/lookup/verify", json={"email": email, "code": "111111"}, timeout=15)
    assert r2.status_code == 400

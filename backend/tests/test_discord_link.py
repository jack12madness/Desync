"""Discord account linking: OAuth start/status, checkout requirement, role-grant fallback.

The real Discord API is not reachable with fake credentials, so OAuth completion is
simulated by writing the 'linked' state directly into MongoDB (same shape the callback
writes). Everything up to and after the Discord call is tested end to end.
"""
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

FAKE_CFG = {
    "client_id": "1234567890123456789",
    "client_secret": "fake-secret",
    "bot_token": "fake-bot-token",
    "guild_id": "1111111111111111111",
    "role_id": "2222222222222222222",
}


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture()
def discord_configured(admin_headers):
    """Turn the integration on with fake creds; always restore to off afterwards."""
    requests.put(f"{API}/admin/settings", json={"discord_integration": FAKE_CFG},
                 headers=admin_headers, timeout=15)
    yield
    requests.put(f"{API}/admin/settings", json={"discord_integration": None},
                 headers=admin_headers, timeout=15)


def _stocked_product():
    prods = requests.get(f"{API}/products", timeout=15).json()
    for p in prods:
        if p.get("kind") in ("boost", "account") or "generator" in p["name"].lower():
            continue
        for d, c in (p.get("stock") or {}).items():
            if c > 0 and d in (p.get("prices") or {}):
                return p, d
    return None, None


def test_config_off_by_default():
    cfg = requests.get(f"{API}/config", timeout=15).json()
    if not cfg.get("discord_link_required"):  # only assert when not configured
        r = requests.post(f"{API}/discord/link-url", json={"origin": BASE}, timeout=15)
        assert r.status_code == 503


def test_link_url_and_checkout_requirement(admin_headers, discord_configured):
    assert requests.get(f"{API}/config", timeout=15).json()["discord_link_required"] is True

    # link-url returns a Discord authorize URL with our client_id and a state token
    r = requests.post(f"{API}/discord/link-url", json={"origin": BASE}, timeout=15)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("https://discord.com/oauth2/authorize?")
    assert FAKE_CFG["client_id"] in url and "guilds.join" in url and "state=" in url
    # state shows as not-linked
    state = url.split("state=")[1].split("&")[0]
    assert requests.get(f"{API}/discord/link-status/{state}", timeout=15).status_code == 404
    # bad state callback rejected without touching Discord
    assert requests.get(f"{API}/discord/callback", params={"code": "x", "state": "bogus"}, timeout=15).status_code == 400
    # evil origin is not reflected into the redirect URI
    r2 = requests.post(f"{API}/discord/link-url", json={"origin": "https://evil.example.com"}, timeout=15)
    assert "evil.example.com" not in r2.json()["url"]

    # checkout now REQUIRES a linked Discord
    p, dur = _stocked_product()
    assert p is not None
    email = f"dctest-{uuid.uuid4().hex[:6]}@resend.dev"
    payload = {"email": email, "items": [{"product_id": p["id"], "duration": dur, "qty": 1}], "origin_url": BASE}
    no_link = requests.post(f"{API}/payments/bank-transfer", json=payload, timeout=30)
    assert no_link.status_code == 400 and "Discord" in no_link.json()["detail"]
    bad_link = requests.post(f"{API}/payments/bank-transfer", json={**payload, "discord_link_token": "nope"}, timeout=30)
    assert bad_link.status_code == 400

    # simulate a completed OAuth link (same shape the callback writes)
    token = uuid.uuid4().hex
    _db().discord_links.insert_one({
        "id": token, "origin": BASE, "status": "linked",
        "discord_user_id": "999888777666555444", "discord_username": "testbuyer",
        "access_token": "fake-access", "refresh_token": "fake-refresh",
        "created_at": "2026-01-01T00:00:00+00:00",
    })
    assert requests.get(f"{API}/discord/link-status/{token}", timeout=15).json()["username"] == "testbuyer"

    ok = requests.post(f"{API}/payments/bank-transfer", json={**payload, "discord_link_token": token}, timeout=30)
    assert ok.status_code == 200, ok.text
    oid = ok.json()["order_id"]

    # link tokens are single-use
    reuse = requests.post(f"{API}/payments/bank-transfer", json={**payload, "discord_link_token": token}, timeout=30)
    assert reuse.status_code == 400

    # order carries the discord identity
    order = _db().orders.find_one({"id": oid})
    assert order["discord_user_id"] == "999888777666555444"
    assert order["discord_username"] == "testbuyer"

    # fulfillment: fake bot token -> Discord refuses -> graceful failure, order still paid
    mp = requests.post(f"{API}/admin/orders/{oid}/mark-paid", headers=admin_headers, timeout=30)
    assert mp.status_code == 200, mp.text
    order = _db().orders.find_one({"id": oid})
    assert order["payment_status"] == "paid"
    assert order.get("discord_role_status") == "failed"
    assert order.get("discord_role_note")

    # cleanup the fake link docs
    _db().discord_links.delete_many({"origin": BASE})


def test_checkout_normal_when_unconfigured(admin_headers):
    # ensure integration is off
    requests.put(f"{API}/admin/settings", json={"discord_integration": None}, headers=admin_headers, timeout=15)
    assert requests.get(f"{API}/config", timeout=15).json()["discord_link_required"] is False
    p, dur = _stocked_product()
    assert p is not None
    email = f"dctest-{uuid.uuid4().hex[:6]}@resend.dev"
    r = requests.post(f"{API}/payments/bank-transfer", json={
        "email": email, "items": [{"product_id": p["id"], "duration": dur, "qty": 1}], "origin_url": BASE,
    }, timeout=30)
    assert r.status_code == 200, r.text

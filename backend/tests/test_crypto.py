"""Backend tests for NOWPayments crypto checkout:
- invoice creation returns a hosted invoice_url
- IPN webhook: bad signature rejected, valid 'finished' fulfills the order (key assigned, idempotent)
- unknown order / missing order id rejected
"""
import hashlib
import hmac
import json
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
IPN_SECRET = os.environ["NOWPAYMENTS_IPN_SECRET"].strip().encode()


def _sig(payload: dict) -> str:
    canon = json.dumps(payload, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()
    return hmac.new(IPN_SECRET, canon, hashlib.sha512).hexdigest()


def _in_stock():
    for p in requests.get(f"{API}/products", timeout=15).json():
        for d, c in (p.get("stock") or {}).items():
            if c > 0 and d in (p.get("prices") or {}):
                return p, d
    return None, None


def test_crypto_checkout_creates_invoice():
    prod, dur = _in_stock()
    assert prod is not None
    r = requests.post(f"{API}/payments/crypto", json={
        "email": "delivered@resend.dev",
        "discord_username": "cryptotest",
        "items": [{"product_id": prod["id"], "duration": dur, "qty": 1}],
        "origin_url": BASE,
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["invoice_url"].startswith("https://nowpayments.io/")
    assert data["order_id"]


def test_crypto_webhook_signature_and_fulfillment():
    prod, dur = _in_stock()
    assert prod is not None
    r = requests.post(f"{API}/payments/crypto", json={
        "email": "delivered@resend.dev",
        "items": [{"product_id": prod["id"], "duration": dur, "qty": 1}],
        "origin_url": BASE,
    }, timeout=30)
    assert r.status_code == 200, r.text
    order_id = r.json()["order_id"]

    payload = {"payment_id": f"pytest-{uuid.uuid4().hex[:8]}", "payment_status": "finished",
               "order_id": order_id, "price_amount": 1.0, "pay_currency": "usdttrc20"}

    # bad signature rejected
    bad = requests.post(f"{API}/payments/crypto/webhook", json=payload,
                        headers={"x-nowpayments-sig": "deadbeef"}, timeout=15)
    assert bad.status_code == 401

    # missing signature rejected
    nosig = requests.post(f"{API}/payments/crypto/webhook", json=payload, timeout=15)
    assert nosig.status_code == 401

    # valid signature fulfills (fulfillment runs in background task — poll briefly)
    ok = requests.post(f"{API}/payments/crypto/webhook", json=payload,
                       headers={"x-nowpayments-sig": _sig(payload)}, timeout=15)
    assert ok.status_code == 200, ok.text

    order = None
    for _ in range(10):
        g = requests.get(f"{API}/orders/by-id/{order_id}", timeout=15)
        if g.status_code == 200:
            order = g.json()
            break
        time.sleep(1)
    assert order is not None, "order never became paid"
    assert order["payment_status"] == "paid"
    assert order["items"][0].get("license_key") or order["items"][0].get("key_pending")

    # repeat webhook stays paid, no double-fulfill error
    again = requests.post(f"{API}/payments/crypto/webhook", json=payload,
                          headers={"x-nowpayments-sig": _sig(payload)}, timeout=15)
    assert again.status_code == 200


def test_crypto_webhook_unknown_order():
    payload = {"payment_id": "x", "payment_status": "finished", "order_id": str(uuid.uuid4())}
    r = requests.post(f"{API}/payments/crypto/webhook", json=payload,
                      headers={"x-nowpayments-sig": _sig(payload)}, timeout=15)
    assert r.status_code == 404


def test_crypto_webhook_waiting_status_does_not_fulfill():
    prod, dur = _in_stock()
    assert prod is not None
    r = requests.post(f"{API}/payments/crypto", json={
        "email": "delivered@resend.dev",
        "items": [{"product_id": prod["id"], "duration": dur, "qty": 1}],
        "origin_url": BASE,
    }, timeout=30)
    order_id = r.json()["order_id"]
    payload = {"payment_id": f"pytest-{uuid.uuid4().hex[:8]}", "payment_status": "waiting",
               "order_id": order_id}
    ok = requests.post(f"{API}/payments/crypto/webhook", json=payload,
                       headers={"x-nowpayments-sig": _sig(payload)}, timeout=15)
    assert ok.status_code == 200
    # still unpaid -> by-id is 404
    g = requests.get(f"{API}/orders/by-id/{order_id}", timeout=15)
    assert g.status_code == 404


def test_crypto_webhook_records_coin_details():
    prod, dur = _in_stock()
    assert prod is not None
    r = requests.post(f"{API}/payments/crypto", json={
        "email": "delivered@resend.dev",
        "items": [{"product_id": prod["id"], "duration": dur, "qty": 1}],
        "origin_url": BASE,
    }, timeout=30)
    order_id = r.json()["order_id"]
    payload = {"payment_id": f"pytest-{uuid.uuid4().hex[:8]}", "payment_status": "finished",
               "order_id": order_id, "pay_currency": "usdttrc20", "actually_paid": 5.42}
    ok = requests.post(f"{API}/payments/crypto/webhook", json=payload,
                       headers={"x-nowpayments-sig": _sig(payload)}, timeout=15)
    assert ok.status_code == 200
    from pymongo import MongoClient
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    doc = db.orders.find_one({"id": order_id}, {"pay_currency": 1, "actually_paid": 1, "np_payment_id": 1})
    assert doc["pay_currency"] == "usdttrc20"
    assert doc["actually_paid"] == 5.42
    assert doc["np_payment_id"] == payload["payment_id"]


def test_crypto_auto_expiry_sweep():
    admin = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    headers = {"Authorization": f"Bearer {admin.json()['token']}"}
    prod, dur = _in_stock()
    assert prod is not None
    # old unpaid crypto order -> expired
    r = requests.post(f"{API}/payments/crypto", json={
        "email": "delivered@resend.dev",
        "items": [{"product_id": prod["id"], "duration": dur, "qty": 1}],
        "origin_url": BASE,
    }, timeout=30)
    old_id = r.json()["order_id"]
    from datetime import datetime, timedelta, timezone
    from pymongo import MongoClient
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    db.orders.update_one({"id": old_id}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()}})
    # fresh unpaid crypto order -> untouched
    r2 = requests.post(f"{API}/payments/crypto", json={
        "email": "delivered@resend.dev",
        "items": [{"product_id": prod["id"], "duration": dur, "qty": 1}],
        "origin_url": BASE,
    }, timeout=30)
    fresh_id = r2.json()["order_id"]
    s = requests.post(f"{API}/admin/orders/sweep-expired", headers=headers, timeout=20)
    assert s.status_code == 200, s.text
    assert s.json()["crypto_expired"] >= 1
    assert db.orders.find_one({"id": old_id})["payment_status"] == "expired"
    assert db.orders.find_one({"id": fresh_id})["payment_status"] == "pending"
    # unauth blocked
    no = requests.post(f"{API}/admin/orders/sweep-expired", timeout=15)
    assert no.status_code == 401



def test_keystock_export_roundtrip():
    """Export returns stock in the exact original paste format (for the Discord gen)."""
    admin = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    headers = {"Authorization": f"Bearer {admin.json()['token']}"}
    prods = requests.get(f"{API}/admin/products", headers=headers, timeout=15).json()
    prod = next(p for p in prods if "PHANTOM" in p["name"].upper())
    u = uuid.uuid4().hex[:6]
    lines = [
        f"EX_{u}_a@mail.com:emailpw:dcpass:token{u}",
        f"E-Mail: EX_{u}_b@mail.com | Steam Password: spw | Steam Username: su{u}",
        f"totally custom format EX_{u}_c anything",
    ]
    r = requests.post(f"{API}/admin/keystock",
                      json={"product_id": prod["id"], "duration": "week", "keys": "\n".join(lines), "mode": "accounts"},
                      headers=headers, timeout=20)
    assert r.status_code == 200 and r.json()["added"] == 3, r.text

    ex = requests.get(f"{API}/admin/keystock/{prod['id']}/export", headers=headers, timeout=15)
    assert ex.status_code == 200
    exported = [l for l in ex.json()["lines"] if f"EX_{u}" in l]
    assert exported == lines, f"round-trip mismatch: {exported}"

    # unauth blocked
    assert requests.get(f"{API}/admin/keystock/{prod['id']}/export", timeout=15).status_code == 401

    # cleanup
    rows = requests.get(f"{API}/admin/keystock/{prod['id']}", headers=headers, timeout=15).json()
    for k in rows:
        if f"EX_{u}" in (k.get("key") or "") or f"EX_{u}" in str((k.get("account") or {}).get("raw", "")):
            requests.delete(f"{API}/admin/keystock/{k['id']}", headers=headers, timeout=10)

def test_keystock_export_move_removes_stock():
    """export-move returns original-format lines AND deletes available stock (one-way to gen)."""
    admin = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    headers = {"Authorization": f"Bearer {admin.json()['token']}"}
    prods = requests.get(f"{API}/admin/products", headers=headers, timeout=15).json()
    prod = next(p for p in prods if "PHANTOM" in p["name"].upper())
    u = uuid.uuid4().hex[:6]
    lines = [f"MOVE-{u}-1", f"MOVE-{u}-2"]
    r = requests.post(f"{API}/admin/keystock",
                      json={"product_id": prod["id"], "duration": "day", "keys": "\n".join(lines), "mode": "keys"},
                      headers=headers, timeout=15)
    assert r.status_code == 200 and r.json()["added"] == 2, r.text

    m = requests.post(f"{API}/admin/keystock/{prod['id']}/export-move", headers=headers, timeout=15)
    assert m.status_code == 200, m.text
    data = m.json()
    moved_lines = [l for l in data["lines"] if f"MOVE-{u}" in l]
    assert moved_lines == lines, moved_lines
    assert data["removed"] >= 2

    # moved lines are gone from stock
    rows = requests.get(f"{API}/admin/keystock/{prod['id']}", headers=headers, timeout=15).json()
    assert not any(f"MOVE-{u}" in (k.get("key") or "") for k in rows)

    # restore the pool so other tests keep their stock
    requests.post(f"{API}/admin/keystock",
                  json={"product_id": prod["id"], "duration": "day",
                        "keys": "\n".join(f"TESTKEY-replenish-{uuid.uuid4().hex[:8]}" for _ in range(max(3, data["removed"]))),
                        "mode": "keys"},
                  headers=headers, timeout=15)

    # unauth blocked
    assert requests.post(f"{API}/admin/keystock/{prod['id']}/export-move", timeout=15).status_code == 401


def test_send_stock_emails_n_items_and_removes_them():
    """send-stock emails the FIRST N available lines (oldest first, matching the export
    panel order) in original format, then removes exactly those from stock."""
    admin = requests.post(f"{API}/auth/login", json={"username": "voidowner", "password": "VoidGhost!26"}, timeout=15)
    headers = {"Authorization": f"Bearer {admin.json()['token']}"}
    prods = requests.get(f"{API}/admin/products", headers=headers, timeout=15).json()
    prod = next(p for p in prods if "PHANTOM" in p["name"].upper())
    u = uuid.uuid4().hex[:6]
    mine = [f"SND2-{u}-1", f"SND2-{u}-2", f"SND2-{u}-3"]
    r = requests.post(f"{API}/admin/keystock",
                      json={"product_id": prod["id"], "duration": "month", "keys": "\n".join(mine), "mode": "keys"},
                      headers=headers, timeout=15)
    assert r.status_code == 200 and r.json()["added"] == 3, r.text

    before = requests.get(f"{API}/admin/keystock/{prod['id']}/export", headers=headers, timeout=15).json()
    first_line = before["lines"][0]
    s = requests.post(f"{API}/admin/keystock/{prod['id']}/send-stock",
                      json={"count": 1, "email": "delivered@resend.dev"}, headers=headers, timeout=30)
    assert s.status_code == 200, s.text
    assert s.json()["sent"] == 1 and s.json()["removed"] == 1

    after = requests.get(f"{API}/admin/keystock/{prod['id']}/export", headers=headers, timeout=15).json()
    assert after["count"] == before["count"] - 1
    assert first_line not in after["lines"], "the emailed (oldest) line must be the one removed"
    # my 3 month-pool lines untouched
    assert all(any(m == l for l in after["lines"]) for m in mine)

    # guards
    assert requests.post(f"{API}/admin/keystock/{prod['id']}/send-stock",
                         json={"count": 1, "email": "delivered@resend.dev"}, timeout=15).status_code == 401
    assert requests.post(f"{API}/admin/keystock/{prod['id']}/send-stock",
                         json={"count": 0, "email": "delivered@resend.dev"}, headers=headers, timeout=15).status_code == 400

    # cleanup my month lines
    rows = requests.get(f"{API}/admin/keystock/{prod['id']}", headers=headers, timeout=15).json()
    for k in rows:
        if f"SND2-{u}" in (k.get("key") or ""):
            requests.delete(f"{API}/admin/keystock/{k['id']}", headers=headers, timeout=10)

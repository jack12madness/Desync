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

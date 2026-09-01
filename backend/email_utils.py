import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from fastapi import HTTPException

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
STORE_URL = os.environ.get("STORE_URL", "").rstrip("/")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error("Email send failed: %s %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error("Email send error: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to send email")


def _shell(title: str, inner: str) -> str:
    brand = escape(EMAIL_FROM_NAME)
    return (
        '<table role="presentation" width="100%" style="background:#050B18;padding:32px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" style="background:#0A1628;border:1px solid #1E2D4A;'
        'border-radius:12px;padding:32px;font-family:Arial,sans-serif">'
        '<tr><td><div style="font-size:20px;font-weight:800;color:#F1F5F9;letter-spacing:1px">'
        + brand +
        '</div><div style="font-size:11px;color:#2E6BFF;letter-spacing:3px;margin-top:4px;text-transform:uppercase">'
        + escape(title) +
        '</div></td></tr>'
        '<tr><td style="padding-top:20px">' + inner + '</td></tr>'
        '<tr><td style="padding-top:24px;font-size:11px;color:#64748B">Sent by ' + brand +
        '. We never ask for your password or card details by email.</td></tr>'
        '</table></td></tr></table>'
    )


def _key_box(key: str) -> str:
    return (
        '<div style="font-family:Courier,monospace;font-size:16px;letter-spacing:2px;color:#7FB0FF;'
        'background:#050B18;border:1px solid #1E2D4A;border-radius:8px;padding:12px 16px;margin:8px 0">'
        + escape(key) + '</div>'
    )


async def send_order_email(order: dict) -> None:
    rows = ""
    for it in order["items"]:
        rows += (
            '<tr><td style="padding:14px 0;border-bottom:1px solid #1E2D4A">'
            '<div style="color:#F1F5F9;font-weight:600;font-size:15px">' + escape(it["name"]) + '</div>'
            '<div style="color:#94A3B8;font-size:12px;margin-top:2px">'
            + escape(it["game"]) + ' &middot; ' + escape(it["duration_label"]) + '</div>'
            + (_key_box(it["license_key"]) if it.get("license_key") else "")
            + '</td></tr>'
        )
    link_html = ""
    if STORE_URL:
        link_html = (
            '<p style="margin:18px 0 0"><a href="' + STORE_URL + '/orders" '
            'style="color:#2E6BFF;font-size:13px">Re-pull your keys anytime on the My Orders page</a></p>'
        )
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 6px">Payment confirmed. Your keys are live.</p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0 0 8px">Order <strong style="color:#F1F5F9">'
        + escape(order["id"][:8].upper()) + '</strong></p>'
        '<table role="presentation" width="100%">' + rows + '</table>'
        '<p style="color:#94A3B8;font-size:12px;margin-top:18px">Setup: download the loader from our Discord '
        '#downloads channel, run it as Administrator, paste your key, launch your game and press INSERT.</p>'
        + link_html
    )
    await send_email(
        to=order["email"],
        subject="Your " + EMAIL_FROM_NAME + " keys - Order " + order["id"][:8].upper(),
        html=_shell("Key Delivery", inner),
    )


async def send_waitlist_email(email: str) -> None:
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 10px">You\'re on the drop list.</p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0">We\'ll hit this inbox the second the next '
        + escape(EMAIL_FROM_NAME) + ' release goes live. Stay low.</p>'
    )
    await send_email(
        to=email,
        subject="You're on the " + EMAIL_FROM_NAME + " drop list",
        html=_shell("Next Drop // Classified", inner),
    )

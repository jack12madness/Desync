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
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS")

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
    if RESEND_API_KEY and EMAIL_FROM_ADDRESS:
        payload = {
            "from": f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if reply_to or EMAIL_REPLY_TO:
            payload["reply_to"] = reply_to or EMAIL_REPLY_TO
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json=payload,
                )
            resp.raise_for_status()
            return resp.json().get("id")
        except Exception as e:
            logger.error("Direct Resend send error: %s", str(e))
            raise HTTPException(status_code=502, detail="Failed to send email")
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


_ACCOUNT_FIELDS = [
    ("steam_username", "Steam username"),
    ("steam_password", "Steam password"),
    ("email", "Email"),
    ("email_password", "Email password"),
    ("password", "Email password"),
    ("discord_password", "Discord password"),
    ("discord_token", "Discord token"),
    ("twofa_key", "2FA key"),
    ("twofa_redeem", "2FA redeem"),
    ("webmail", "Webmail"),
]


def _account_box(account: dict) -> str:
    if account.get("raw"):
        return (
            '<div style="font-family:Courier,monospace;font-size:13px;color:#7FB0FF;background:#050B18;'
            'border:1px solid #1E2D4A;border-radius:8px;padding:12px 16px;margin:8px 0;word-break:break-all">'
            + escape(account["raw"]) + '</div>'
        )
    rows = ""
    for field, label in _ACCOUNT_FIELDS:
        if not account.get(field):
            continue
        rows += (
            '<tr><td style="color:#64748B;font-size:12px;padding:3px 0">' + label + '</td>'
            '<td style="font-family:Courier,monospace;font-size:13px;color:#7FB0FF;text-align:right;word-break:break-all">'
            + escape(account.get(field, "")) + '</td></tr>'
        )
    return (
        '<table role="presentation" width="100%" style="background:#050B18;border:1px solid #1E2D4A;'
        'border-radius:8px;padding:12px 16px;margin:8px 0">' + rows + '</table>'
        '<div style="color:#94A3B8;font-size:11px;margin-top:4px">Log in with these details, then change the '
        'passwords so the account is fully yours.</div>'
    )


def _ticket_box(ticket_url: str) -> str:
    return (
        '<div style="background:#050B18;border:1px solid #2E6BFF;border-radius:8px;padding:14px 16px;margin:8px 0">'
        '<div style="color:#F1F5F9;font-size:14px;font-weight:600;margin-bottom:6px">Claim via Discord ticket</div>'
        '<div style="color:#94A3B8;font-size:12px;margin-bottom:10px">This product is delivered through our '
        'Discord — open a ticket and our team will set you up right away.</div>'
        '<a href="' + escape(ticket_url) + '" style="display:inline-block;background:#5865F2;color:#ffffff;'
        'font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;text-decoration:none">Open a ticket in Discord</a>'
        '</div>'
    )


def _deliverables_html(it: dict) -> str:
    if it.get("ticket_url"):
        return _ticket_box(it["ticket_url"])
    dels = it.get("deliverables") or []
    if not dels and it.get("license_key"):
        dels = [{"license_key": it["license_key"], "account": it.get("account")}]
    if not dels:
        return ('<div style="color:#F5C158;font-size:12px;margin-top:8px">Key is being assigned — '
                'it will appear on your My Orders page shortly.</div>')
    qty = max(1, int(it.get("qty") or 1))
    out = ""
    if qty > 1:
        out += ('<div style="color:#94A3B8;font-size:12px;margin:8px 0 2px">'
                + str(len(dels)) + ' of ' + str(qty) + ' delivered:</div>')
    for i, d in enumerate(dels):
        if qty > 1:
            out += ('<div style="color:#64748B;font-size:11px;font-family:Courier,monospace;margin-top:8px">#'
                    + str(i + 1) + '</div>')
        out += _account_box(d["account"]) if d.get("account") else _key_box(d["license_key"])
    return out


def _instructions_box(it: dict) -> str:
    txt = (it.get("instructions") or "").strip()
    if not txt and not (it.get("discord_url") and not it.get("ticket_url")):
        return ""
    body = "<br>".join(escape(txt).splitlines())
    inner = ""
    if txt:
        inner += (
            '<div style="color:#F1F5F9;font-size:12px;font-weight:600;letter-spacing:1px;'
            'text-transform:uppercase;margin-bottom:6px">Setup instructions</div>'
            '<div style="color:#94A3B8;font-size:13px;line-height:1.6">' + body + '</div>'
        )
    if it.get("discord_url") and not it.get("ticket_url"):
        inner += (
            '<div style="margin-top:10px"><a href="' + escape(it["discord_url"]) + '" '
            'style="display:inline-block;background:#5865F2;color:#ffffff;font-size:13px;font-weight:600;'
            'padding:9px 16px;border-radius:8px;text-decoration:none">Join the Discord for this product</a></div>'
        )
    return (
        '<div style="background:#050B18;border:1px solid #1E2D4A;border-radius:8px;'
        'padding:12px 16px;margin:10px 0">' + inner + '</div>'
    )


async def send_order_email(order: dict) -> None:
    rows = ""
    for it in order["items"]:
        rows += (
            '<tr><td style="padding:14px 0;border-bottom:1px solid #1E2D4A">'
            '<div style="color:#F1F5F9;font-weight:600;font-size:15px">' + escape(it["name"]) + '</div>'
            '<div style="color:#94A3B8;font-size:12px;margin-top:2px">'
            + escape(it["game"]) + ' &middot; ' + escape(it["duration_label"])
            + (' &middot; &times;' + str(it["qty"]) if (it.get("qty") or 1) > 1 else '') + '</div>'
            + _deliverables_html(it)
            + _instructions_box(it)
            + ('<div style="margin-top:10px"><a href="' + STORE_URL + it["download_url"] + '" '
               'style="display:inline-block;background:#2E6BFF;color:#ffffff;font-size:13px;font-weight:600;'
               'padding:9px 16px;border-radius:8px;text-decoration:none">Download loader</a>'
               + ('<span style="color:#64748B;font-size:11px;margin-left:8px">' + escape(it["loader_filename"]) + '</span>' if it.get("loader_filename") else '')
               + '</div>'
               if it.get("download_url") and STORE_URL else '')
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
        '<p style="color:#94A3B8;font-size:12px;margin-top:18px">Setup: download your loader using the button '
        'next to your product above, run it as Administrator, paste your key, launch your game and press INSERT.</p>'
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


async def send_low_stock_email(to: str, product_name: str, duration_label: str, remaining: int) -> None:
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 10px">Key stock is running low.</p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0 0 4px">Product: <strong style="color:#F1F5F9">'
        + escape(product_name) + '</strong></p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0 0 4px">Duration: <strong style="color:#F1F5F9">'
        + escape(duration_label) + '</strong></p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0">Remaining keys: <strong style="color:#F5C158">'
        + str(remaining) + '</strong></p>'
        '<p style="color:#94A3B8;font-size:12px;margin-top:16px">Top up the pool from the admin console '
        '(Products &rarr; key stock) before it sells out.</p>'
    )
    await send_email(
        to=to,
        subject="Low stock: " + product_name + " (" + duration_label + ") - " + str(remaining) + " left",
        html=_shell("Low Stock Alert", inner),
    )


async def send_announce_email(to: str, subject: str, message: str) -> None:
    body_html = "<br>".join(escape(message).splitlines())
    link_html = ""
    if STORE_URL:
        link_html = (
            '<p style="margin:22px 0 0"><a href="' + STORE_URL + '" '
            'style="display:inline-block;background:#2E6BFF;color:#ffffff;text-decoration:none;'
            'font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">Open the shop</a></p>'
        )
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;line-height:1.6;margin:0">' + body_html + '</p>'
        + link_html
    )
    await send_email(to=to, subject=subject, html=_shell("Announcement", inner))


async def send_bank_transfer_email(order: dict, bank: dict, reference: str, expires_at: str) -> None:
    rows = ""
    for it in order["items"]:
        rows += (
            '<tr><td style="padding:10px 0;border-bottom:1px solid #1E2D4A">'
            '<div style="color:#F1F5F9;font-weight:600;font-size:14px">' + escape(it["name"]) + '</div>'
            '<div style="color:#94A3B8;font-size:12px;margin-top:2px">'
            + escape(it["game"]) + ' &middot; ' + escape(it["duration_label"]) + '</div></td></tr>'
        )

    def bank_row(label, value):
        if not value:
            return ""
        return (
            '<tr><td style="color:#64748B;font-size:12px;padding:4px 0">' + escape(label) + '</td>'
            '<td style="color:#F1F5F9;font-size:13px;font-family:Courier,monospace;text-align:right">'
            + escape(value) + '</td></tr>'
        )

    bank_table = (
        '<table role="presentation" width="100%" style="background:#050B18;border:1px solid #1E2D4A;'
        'border-radius:8px;padding:14px 16px;margin:14px 0">'
        + bank_row("PayID", bank.get("payid"))
        + bank_row("BSB", bank.get("bank_bsb"))
        + bank_row("Account number", bank.get("bank_account_number"))
        + bank_row("Account name", bank.get("bank_account_name"))
        + bank_row("Amount", "EUR %.2f" % order.get("total", 0))
        + '</table>'
    )
    link_html = ""
    if STORE_URL:
        link_html = (
            '<p style="margin:16px 0 0"><a href="' + STORE_URL + '/orders" '
            'style="color:#2E6BFF;font-size:13px">Check your order on the My Orders page</a></p>'
        )
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 6px">Your order is reserved — complete the bank transfer to release your keys.</p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0 0 8px">Order <strong style="color:#F1F5F9">'
        + escape(order["id"][:8].upper()) + '</strong></p>'
        '<table role="presentation" width="100%">' + rows + '</table>'
        + bank_table +
        '<p style="color:#F5C158;font-size:13px;margin:0">Important: use reference <strong>'
        + escape(reference) + '</strong> so we can match your payment.</p>'
        '<p style="color:#94A3B8;font-size:12px;margin-top:14px">Bank transfers are not instant delivery — '
        'we manually confirm each payment. Once your payment arrives we mark the order paid and your '
        'license key is emailed automatically. This reservation expires after 48 hours ('
        + escape(expires_at[:16].replace("T", " ")) + ' UTC) if no payment is received.</p>'
        + link_html
    )
    await send_email(
        to=order["email"],
        subject="Complete your bank transfer - " + EMAIL_FROM_NAME + " order " + order["id"][:8].upper(),
        html=_shell("Bank Transfer Instructions", inner),
    )


async def send_bank_expired_email(order: dict, reason: str = "no payment arrived within 48 hours") -> None:
    link_html = ""
    if STORE_URL:
        link_html = (
            '<p style="margin:18px 0 0"><a href="' + STORE_URL + '" '
            'style="display:inline-block;background:#2E6BFF;color:#ffffff;text-decoration:none;'
            'font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">Back to the shop</a></p>'
        )
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 10px">Your bank-transfer order has expired.</p>'
        '<p style="color:#94A3B8;font-size:13px;margin:0">Order <strong style="color:#F1F5F9">'
        + escape(order["id"][:8].upper()) + '</strong> was cancelled because '
        + escape(reason) + '. If you still want the product, just place a new order — nothing was charged.</p>'
        + link_html
    )
    await send_email(
        to=order["email"],
        subject=EMAIL_FROM_NAME + " order " + order["id"][:8].upper() + " expired",
        html=_shell("Order Expired", inner),
    )



async def send_lookup_code_email(email: str, code: str) -> None:
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 10px">Here is your one-time code.</p>'
        '<div style="font-family:Courier,monospace;font-size:28px;letter-spacing:6px;color:#7FB0FF;'
        'background:#050B18;border:1px solid #1E2D4A;border-radius:8px;padding:16px;text-align:center;margin:12px 0">'
        + escape(code) + '</div>'
        '<p style="color:#94A3B8;font-size:13px;margin:0">Enter it on the My Orders page to view your '
        'purchases. It expires in 10 minutes. If you did not request this code, you can ignore this email.</p>'
    )
    await send_email(
        to=email,
        subject="Your " + EMAIL_FROM_NAME + " My Orders code",
        html=_shell("My Orders Access", inner),
    )


async def send_stock_transfer_email(email: str, product_name: str, lines: list) -> None:
    block = escape("\n".join(lines))
    inner = (
        '<p style="color:#F1F5F9;font-size:15px;margin:0 0 10px">'
        + str(len(lines)) + ' item(s) for <strong>' + escape(product_name) + '</strong>, in the original paste format.</p>'
        '<pre style="font-family:Courier,monospace;font-size:12px;color:#8FB8E8;background:#050B18;'
        'border:1px solid #1E2D4A;border-radius:8px;padding:14px;white-space:pre-wrap;word-break:break-all;margin:12px 0">'
        + block + '</pre>'
        '<p style="color:#94A3B8;font-size:12px;margin:0">Sent from the ' + escape(EMAIL_FROM_NAME) + ' admin console.</p>'
    )
    await send_email(
        to=email,
        subject="Stock transfer — " + product_name + " (" + str(len(lines)) + " items)",
        html=_shell("Stock Transfer", inner),
    )

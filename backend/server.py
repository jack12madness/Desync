import os, sys
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
load_dotenv(os.path.join(_HERE, ".env"))

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Response, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import time, uuid, logging, secrets, string, asyncio, hashlib, hmac
import html, json, re
from datetime import datetime, timezone, timedelta
import httpx
import requests

import bcrypt
import jwt
import stripe

from email_utils import (send_order_email, send_waitlist_email, send_low_stock_email, send_announce_email,
                         send_bank_transfer_email, send_bank_expired_email, send_lookup_code_email,
                         send_stock_transfer_email)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
TAX_MODE = "full"  # sandbox country AU (SMP-supported), digital goods

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

DURATIONS = {
    "day": "1 Day",
    "3d": "3 Days",
    "week": "1 Week",
    "month": "1 Month",
    "lifetime": "Lifetime",
}
STATUSES = {"undetected", "updating", "detected", "testing"}


# ---------- helpers ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_admin_token(admin_id: str, username: str, role: str) -> str:
    payload = {
        "sub": admin_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "admin_access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_admin(request: Request) -> dict:
    token = request.cookies.get("admin_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "admin_access":
            raise HTTPException(401, "Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    admin = await db.admins.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(401, "Admin not found")
    return admin


async def require_owner(admin: dict = Depends(get_admin)) -> dict:
    if admin.get("role") != "owner":
        raise HTTPException(403, "Owner only")
    return admin


def gen_license_key() -> str:
    alphabet = string.ascii_uppercase + string.digits
    groups = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
    return "DESYNC-" + "-".join(groups)


def product_out(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ---------- object storage (Emergent) ----------

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "desync"
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=300,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=300,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=300)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=300)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- models ----------

class ProductIn(BaseModel):
    game: str
    name: str
    description: str = ""
    image_url: str = ""
    status: str = "undetected"
    features: List[str] = []
    anticheat: str = ""
    prices: Dict[str, float] = {}
    min_buy: int = 1
    kind: str = "cheat"  # "cheat" or "account"
    account_type: Optional[str] = None  # for kind=account: "discord" | "steam" | "rockstar"
    delivery: str = "stock"  # "stock" (limited keys) or "ticket" (infinite, claim via Discord ticket)
    ticket_url: Optional[str] = None
    loader_link: Optional[str] = None  # external download URL instead of an uploaded file
    discord_url: Optional[str] = None  # per-product Discord link, delivered to buyers after purchase
    instructions: Optional[str] = None  # install/setup notes shown after payment (email, success, My Orders)
    system_requirements: Optional[str] = None  # one requirement per line, collapsible in the product modal
    troubleshooting: Optional[List[dict]] = None  # [{"issue": "...", "fix": "..."}] accordion in the product modal
    active: bool = True
    sort_order: int = 0


class LoginIn(BaseModel):
    username: str
    password: str


class AdminUserIn(BaseModel):
    username: str
    password: str
    role: str = "admin"


class CartItemIn(BaseModel):
    product_id: str
    duration: str
    qty: int = 1


class CheckoutIn(BaseModel):
    email: EmailStr
    discord_username: Optional[str] = None
    items: List[CartItemIn]
    coupon: Optional[str] = None
    origin_url: str


class LookupIn(BaseModel):
    email: EmailStr
    token: str


class RequestCodeIn(BaseModel):
    email: EmailStr


class VerifyCodeIn(BaseModel):
    email: EmailStr
    code: str


# ---------- buyer OTP (My Orders access) ----------

OTP_TTL_MINUTES = 15
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
LOOKUP_TOKEN_HOURS = 2  # browser-session access window


def _create_lookup_token(email: str) -> str:
    payload = {
        "sub": email, "type": "buyer_lookup",
        "exp": datetime.now(timezone.utc) + timedelta(hours=LOOKUP_TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@api_router.post("/orders/lookup/request-code")
async def lookup_request_code(body: RequestCodeIn):
    email = body.email.lower()
    now = datetime.now(timezone.utc)
    recent = await db.lookup_codes.find_one(
        {"email": email, "created_dt": {"$gt": now - timedelta(seconds=OTP_RESEND_SECONDS)}}
    )
    if recent:
        raise HTTPException(429, "A code was just sent — wait a minute before requesting another")
    code = f"{secrets.randbelow(1000000):06d}"
    await db.lookup_codes.insert_one({
        "id": str(uuid.uuid4()), "email": email,
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "attempts": 0, "used": False,
        "created_dt": now, "expires_dt": now + timedelta(minutes=OTP_TTL_MINUTES),
    })
    try:
        await send_lookup_code_email(email, code)
    except Exception as e:
        logger.error("Lookup code email failed for %s: %s", email, e)
        raise HTTPException(500, "Could not send the code email — please try again in a moment")
    return {"sent": True}


@api_router.post("/orders/lookup/verify")
async def lookup_verify_code(body: VerifyCodeIn):
    email = body.email.lower()
    now = datetime.now(timezone.utc)
    docs = await db.lookup_codes.find(
        {"email": email, "used": False, "expires_dt": {"$gt": now}},
    ).sort("created_dt", -1).to_list(5)
    if not docs:
        total = await db.lookup_codes.count_documents({"email": email})
        logger.warning("OTP verify failed for %s: no valid doc (total docs: %d)", email, total)
        raise HTTPException(400, "Code expired or never requested — request a new one")
    # accept any unexpired code for this email — relay delays can deliver emails out of order
    match = None
    for doc in docs:
        if doc.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
            continue
        digest = hashlib.sha256(body.code.strip().encode()).hexdigest()
        if secrets.compare_digest(doc["code_hash"], digest):
            match = doc
            break
    if not match:
        await db.lookup_codes.update_one({"id": docs[0]["id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect code — make sure it's from the newest email")
    await db.lookup_codes.update_one({"id": match["id"]}, {"$set": {"used": True}})
    return {"token": _create_lookup_token(email)}


def _check_lookup_token(email: str, token: str):
    try:
        payload = jwt.decode(token or "", JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired — verify your email again")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Verification required")
    if payload.get("type") != "buyer_lookup" or payload.get("sub") != email:
        raise HTTPException(401, "Verification required")


# ---------- seeding ----------

SEED_PRODUCTS = [
    {
        "game": "FiveM", "name": "SPECTRE // FiveM Executor",
        "description": "Flagship Lua executor for FiveM. Full menu, script hub, and server-side bypass with stream-proof overlay.",
        "image_url": "https://images.unsplash.com/photo-1766016642153-4063f568870c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwzfHxzdXBlcmNhciUyMG5pZ2h0JTIwbmVvbiUyMGNpdHklMjBkYXJrJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MjF8MA&ixlib=rb-4.1.0&q=85",
        "status": "undetected", "anticheat": "FiveM Guard / Adrenaline",
        "features": ["Lua Executor", "Mod Menu", "Script Hub", "Server Bypass", "Stream Proof", "Config Saver"],
        "prices": {"day": 6.99, "week": 19.99, "month": 39.99, "lifetime": 89.99},
        "active": True, "sort_order": 1,
    },
    {
        "game": "FiveM", "name": "PHANTOM // FiveM Mod Menu",
        "description": "Lightweight mod menu built for roleplay servers. Spawn vehicles, money tools, trolling suite and aim assist.",
        "image_url": "https://images.unsplash.com/photo-1766016648768-254ede922ed5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxzdXBlcmNhciUyMG5pZ2h0JTIwbmVvbiUyMGNpdHklMjBkYXJrJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MjF8MA&ixlib=rb-4.1.0&q=85",
        "status": "undetected", "anticheat": "FiveM Guard",
        "features": ["Vehicle Spawner", "Money Tools", "Aim Assist", "ESP", "Trolling Suite"],
        "prices": {"day": 4.99, "week": 14.99, "month": 29.99},
        "active": True, "sort_order": 2,
    }
]


async def seed_admin():
    username = os.environ.get("ADMIN_USERNAME", "voidowner")
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.admins.find_one({"username": username})
    if existing is None:
        await db.admins.insert_one({
            "id": str(uuid.uuid4()), "username": username,
            "password_hash": hash_password(password), "role": "owner",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded owner admin '%s'", username)
    elif not verify_password(password, existing["password_hash"]):
        await db.admins.update_one({"username": username}, {"$set": {"password_hash": hash_password(password)}})


async def seed_products():
    if await db.products.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    for p in SEED_PRODUCTS:
        doc = dict(p)
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.products.insert_one(doc)
    logger.info("Seeded %d products", len(SEED_PRODUCTS))


@app.on_event("startup")
async def startup():
    await db.admins.create_index("username", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("session_id")
    await db.orders.create_index("email")
    await db.waitlist.create_index("email", unique=True)
    await db.keystock.create_index([("product_id", 1), ("status", 1)])
    await db.categories.create_index("id", unique=True)
    await db.customers.create_index("email", unique=True)
    await db.expenses.create_index("id", unique=True)
    await db.lookup_codes.create_index("expires_dt", expireAfterSeconds=0)
    await db.lookup_codes.create_index("email")
    await db.gen_usage.create_index([("key", 1), ("request_id", 1)])
    await db.gen_usage.create_index([("email", 1), ("ts", -1)])
    await db.customers.create_index("gen_key", sparse=True)
    await db.reviews.create_index([("status", 1), ("created_at", -1)])
    await db.reviews.create_index([("email", 1), ("order_id", 1)], unique=True)
    await db.audit_log.create_index("ts")
    asyncio.create_task(_bank_expiry_loop())
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error("Storage init failed: %s", e)
    await seed_admin()
    await seed_products()


# ---------- public ----------

@api_router.get("/")
async def root():
    return {"message": "Desync API online"}


async def _available_stock_map() -> Dict[str, Dict[str, int]]:
    pipeline = [
        {"$match": {"status": "available"}},
        {"$group": {"_id": {"product_id": "$product_id", "duration": "$duration"}, "count": {"$sum": 1}}},
    ]
    rows = await db.keystock.aggregate(pipeline).to_list(5000)
    out: Dict[str, Dict[str, int]] = {}
    for r in rows:
        pid = r["_id"]["product_id"]
        dur = r["_id"].get("duration") or "day"
        out.setdefault(pid, {})[dur] = out.setdefault(pid, {}).get(dur, 0) + r["count"]
    return out


@api_router.get("/products")
async def list_products():
    docs = await db.products.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    stock = await _available_stock_map()
    for d in docs:
        d["stock"] = stock.get(d["id"], {})
        d["has_loader"] = bool(d.pop("loader", None))
    return docs


# ---------- categories ----------

class CategoryIn(BaseModel):
    name: str
    sort_order: int = 0
    image_url: Optional[str] = None


@api_router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    products = await db.products.find({"active": True}, {"_id": 0, "game": 1, "prices": 1}).to_list(500)
    for c in cats:
        prods = [p for p in products if p.get("game") == c["name"]]
        prices = [v for p in prods for v in (p.get("prices") or {}).values() if v is not None]
        c["product_count"] = len(prods)
        c["min_price"] = round(min(prices), 2) if prices else None
        c["max_price"] = round(max(prices), 2) if prices else None
    return cats


@api_router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, admin: dict = Depends(get_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    if await db.categories.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}}):
        raise HTTPException(409, "Category already exists")
    doc = {
        "id": str(uuid.uuid4()), "name": name, "sort_order": body.sort_order,
        "image_url": body.image_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.put("/admin/categories/{category_id}")
async def admin_update_category(category_id: str, body: CategoryIn, admin: dict = Depends(get_admin)):
    cat = await db.categories.find_one({"id": category_id})
    if not cat:
        raise HTTPException(404, "Category not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    if name.lower() != cat["name"].lower():
        if await db.categories.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}}):
            raise HTTPException(409, "Category already exists")
        await db.products.update_many({"game": cat["name"]}, {"$set": {"game": name}})
    await db.categories.update_one(
        {"id": category_id},
        {"$set": {"name": name, "sort_order": body.sort_order, "image_url": body.image_url}},
    )
    return {"updated": True}


@api_router.delete("/admin/categories/{category_id}")
async def admin_delete_category(category_id: str, admin: dict = Depends(get_admin)):
    cat = await db.categories.find_one({"id": category_id})
    if not cat:
        raise HTTPException(404, "Category not found")
    in_use = await db.products.count_documents({"game": cat["name"]})
    if in_use:
        raise HTTPException(400, f"Category is used by {in_use} product(s) — reassign them first")
    await db.categories.delete_one({"id": category_id})
    return {"deleted": True}


class CategoryReorderIn(BaseModel):
    ids: List[str]


@api_router.post("/admin/categories/reorder")
async def admin_reorder_categories(body: CategoryReorderIn, admin: dict = Depends(get_admin)):
    cats = await db.categories.find({}, {"_id": 0, "id": 1}).to_list(200)
    existing = {c["id"] for c in cats}
    if len(body.ids) != len(existing) or set(body.ids) != existing:
        raise HTTPException(400, "List must include every category exactly once")
    for i, cid in enumerate(body.ids):
        await db.categories.update_one({"id": cid}, {"$set": {"sort_order": i + 1}})
    return {"reordered": len(body.ids)}


@api_router.get("/status")
async def status_matrix():
    docs = await db.products.find(
        {"$or": [{"kind": "cheat"}, {"kind": {"$exists": False}}]},
        {"_id": 0, "id": 1, "name": 1, "game": 1, "status": 1, "anticheat": 1, "updated_at": 1},
    ).sort("sort_order", 1).to_list(200)
    return docs


@api_router.post("/orders/lookup")
async def order_lookup(body: LookupIn):
    email = body.email.lower()
    _check_lookup_token(email, body.token)
    docs = await db.orders.find(
        {"email": email, "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for d in docs:
        await _attach_loader_links(d)
        d.pop("download_token", None)
    return docs


class WaitlistIn(BaseModel):
    email: EmailStr


@api_router.post("/waitlist")
async def join_waitlist(body: WaitlistIn):
    email = body.email.lower()
    await db.waitlist.update_one(
        {"email": email},
        {"$setOnInsert": {
            "id": str(uuid.uuid4()), "email": email,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    count = await db.waitlist.count_documents({})
    try:
        await send_waitlist_email(email)
    except Exception as e:
        logger.error("Waitlist email failed for %s: %s", email, e)
    return {"joined": True, "count": count}


@api_router.get("/waitlist/count")
async def waitlist_count():
    return {"count": await db.waitlist.count_documents({})}


# ---------- auth ----------

@api_router.post("/auth/login")
async def login(body: LoginIn):
    username = body.username.strip().lower()
    admin = await db.admins.find_one({"username": username})
    if not admin or not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    token = create_admin_token(admin["id"], admin["username"], admin["role"])
    return {
        "token": token,
        "admin": {"id": admin["id"], "username": admin["username"], "role": admin["role"]},
    }


@api_router.get("/auth/me")
async def auth_me(admin: dict = Depends(get_admin)):
    return admin


# ---------- admin: products ----------

@api_router.get("/admin/products")
async def admin_list_products(admin: dict = Depends(get_admin)):
    return await db.products.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)


@api_router.post("/admin/products")
async def admin_create_product(body: ProductIn, admin: dict = Depends(get_admin)):
    if body.status not in STATUSES:
        raise HTTPException(400, "Invalid status")
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    if doc.get("discord_url") and not doc["discord_url"].startswith("https://"):
        raise HTTPException(400, "Discord URL must start with https://")
    loader_link = doc.pop("loader_link", None)
    if loader_link:
        if not loader_link.startswith("https://"):
            raise HTTPException(400, "Download link must start with https://")
        doc["loader"] = {"link": loader_link, "filename": loader_link.rstrip("/").split("/")[-1] or "Download link", "size": 0, "updated_at": now}
    doc.update({"id": str(uuid.uuid4()), "created_at": now, "updated_at": now})
    await db.products.insert_one(doc)
    return product_out(doc)


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductIn, admin: dict = Depends(get_admin)):
    if body.status not in STATUSES:
        raise HTTPException(400, "Invalid status")
    doc = body.model_dump()
    if doc.get("discord_url") and not doc["discord_url"].startswith("https://"):
        raise HTTPException(400, "Discord URL must start with https://")
    loader_link = doc.pop("loader_link", None)
    now = datetime.now(timezone.utc).isoformat()
    if loader_link:
        if not loader_link.startswith("https://"):
            raise HTTPException(400, "Download link must start with https://")
        doc["loader"] = {"link": loader_link, "filename": loader_link.rstrip("/").split("/")[-1] or "Download link", "size": 0, "updated_at": now}
    doc["updated_at"] = now
    res = await db.products.update_one({"id": product_id}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return product_out(updated)


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(get_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"deleted": True}


class ReorderIn(BaseModel):
    game: str
    product_ids: List[str]


@api_router.post("/admin/products/reorder")
async def admin_reorder_products(body: ReorderIn, admin: dict = Depends(get_admin)):
    prods = await db.products.find({"game": body.game}, {"_id": 0, "id": 1}).to_list(500)
    existing = {p["id"] for p in prods}
    if len(body.product_ids) != len(existing) or set(body.product_ids) != existing:
        raise HTTPException(400, "List must include every product in this category exactly once")
    for i, pid in enumerate(body.product_ids):
        await db.products.update_one({"id": pid}, {"$set": {"sort_order": i + 1}})
    return {"reordered": len(body.product_ids)}


# ---------- admin: product/category images ----------

IMAGE_TYPES = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


async def _store_image(file: UploadFile) -> str:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in IMAGE_TYPES:
        raise HTTPException(400, "Only PNG, JPG or WebP images are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image too large (max 10 MB)")
    name = f"{uuid.uuid4()}.{ext}"
    await asyncio.to_thread(put_object, f"{APP_NAME}/images/{name}", data, IMAGE_TYPES[ext])
    return f"/api/media/{name}"


@api_router.post("/admin/products/{product_id}/image")
async def admin_upload_product_image(product_id: str, file: UploadFile = File(...), admin: dict = Depends(get_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    url = await _store_image(file)
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"image_url": url, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"image_url": url}


@api_router.post("/admin/categories/{category_id}/image")
async def admin_upload_category_image(category_id: str, file: UploadFile = File(...), admin: dict = Depends(get_admin)):
    cat = await db.categories.find_one({"id": category_id}, {"_id": 0, "id": 1})
    if not cat:
        raise HTTPException(404, "Category not found")
    url = await _store_image(file)
    await db.categories.update_one({"id": category_id}, {"$set": {"image_url": url}})
    return {"image_url": url}


@api_router.get("/media/{filename}")
async def get_media(filename: str):
    if not re.fullmatch(r"[0-9a-f-]{36}\.(png|jpe?g|webp)", filename):
        raise HTTPException(404, "Not found")
    try:
        data, ctype = await asyncio.to_thread(get_object, f"{APP_NAME}/images/{filename}")
    except Exception:
        raise HTTPException(404, "Not found")
    return Response(
        content=data, media_type=ctype,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ---------- admin: product loaders ----------

LOADER_TYPES = {
    "exe": "application/vnd.microsoft.portable-executable",
    "zip": "application/zip",
}
MAX_LOADER_BYTES = 150 * 1024 * 1024


@api_router.post("/admin/products/{product_id}/loader")
async def admin_upload_loader(product_id: str, file: UploadFile = File(...), admin: dict = Depends(get_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in LOADER_TYPES:
        raise HTTPException(400, "Only .exe or .zip files are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_LOADER_BYTES:
        raise HTTPException(400, "Loader too large (max 150 MB)")
    path = f"{APP_NAME}/loaders/{product_id}/{uuid.uuid4()}.{ext}"
    result = await asyncio.to_thread(put_object, path, data, LOADER_TYPES[ext])
    loader = {
        "storage_path": result["path"], "filename": file.filename,
        "size": result.get("size", len(data)), "content_type": LOADER_TYPES[ext],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.products.update_one({"id": product_id}, {"$set": {"loader": loader, "updated_at": loader["updated_at"]}})
    return loader


@api_router.delete("/admin/products/{product_id}/loader")
async def admin_delete_loader(product_id: str, admin: dict = Depends(get_admin)):
    res = await db.products.update_one({"id": product_id}, {"$unset": {"loader": ""}})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    return {"deleted": True}


# ---------- buyer: gated loader downloads ----------

async def _attach_loader_links(order: dict) -> dict:
    token = order.get("download_token")
    if not token:
        token = secrets.token_urlsafe(24)
        await db.orders.update_one({"id": order["id"]}, {"$set": {"download_token": token}})
        order["download_token"] = token
    for it in order.get("items", []):
        prod = await db.products.find_one(
            {"id": it.get("product_id")},
            {"_id": 0, "loader": 1, "instructions": 1, "discord_url": 1},
        )
        if not prod:
            continue
        if prod.get("loader"):
            it["loader_filename"] = prod["loader"]["filename"]
            it["download_url"] = f"/api/orders/{order['id']}/loader/{it['product_id']}?token={token}"
        if prod.get("instructions"):
            it["instructions"] = prod["instructions"]
        if prod.get("discord_url"):
            it["discord_url"] = prod["discord_url"]
    return order


@api_router.get("/orders/{order_id}/loader/{product_id}")
async def download_loader(order_id: str, product_id: str, token: str = ""):
    order = await db.orders.find_one({"id": order_id, "payment_status": "paid"})
    if not order or not order.get("download_token") or not secrets.compare_digest(order["download_token"], token):
        raise HTTPException(403, "Invalid download link")
    if not any(it.get("product_id") == product_id for it in order.get("items", [])):
        raise HTTPException(404, "Product not in this order")
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "loader": 1})
    if not product or not product.get("loader"):
        raise HTTPException(404, "No loader available for this product")
    if product["loader"].get("link"):
        return RedirectResponse(product["loader"]["link"], status_code=302)
    data, _ = await asyncio.to_thread(get_object, product["loader"]["storage_path"])
    fname = product["loader"].get("filename", "loader.exe").replace('"', "")
    return Response(
        content=data, media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- share links (crawler-friendly OG previews) ----------

SITE_URL = (os.environ.get("STORE_URL") or "").rstrip("/")


@api_router.get("/share/product/{product_id}", response_class=HTMLResponse)
async def share_product(product_id: str):
    product = await db.products.find_one({"id": product_id, "active": True}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    esc = html.escape
    target = f"{SITE_URL}/product/{product['id']}"
    img = product.get("image_url") or "/images/og-banner.png"
    if not img.startswith("http"):
        img = f"{SITE_URL}{img}"
    prices = [v for v in (product.get("prices") or {}).values() if v is not None]
    price_txt = f"from A${min(prices):.2f}" if prices else ""
    title = f"{product['name']} — Desync"
    desc = product.get("description") or "Undetected software. Instant key delivery."
    if price_txt:
        desc = f"{desc} · {price_txt}"
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{esc(title)}</title>
<meta name="theme-color" content="#2E6BFF" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Desync" />
<meta property="og:title" content="{esc(title)}" />
<meta property="og:description" content="{esc(desc)}" />
<meta property="og:url" content="{esc(target)}" />
<meta property="og:image" content="{esc(img)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{esc(title)}" />
<meta name="twitter:description" content="{esc(desc)}" />
<meta name="twitter:image" content="{esc(img)}" />
<meta http-equiv="refresh" content="0;url={esc(target)}" />
<script>location.replace({json.dumps(target)});</script>
</head>
<body style="background:#050B18;color:#94A3B8;font-family:sans-serif;text-align:center;padding-top:20vh">
Redirecting to <a style="color:#7FB0FF" href="{esc(target)}">{esc(title)}</a>…
</body>
</html>"""
    return HTMLResponse(page)


# ---------- admin: orders ----------

@api_router.get("/admin/orders")
async def admin_orders(admin: dict = Depends(get_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/waitlist")
async def admin_waitlist(admin: dict = Depends(get_admin)):
    return await db.waitlist.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.get("/admin/waitlist/export")
async def admin_waitlist_export(admin: dict = Depends(get_admin)):
    rows = await db.waitlist.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    lines = ["email,joined_at"] + [f"{r['email']},{r['created_at']}" for r in rows]
    return Response(
        "\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=desync-waitlist.csv"},
    )


# ---------- admin: key stock ----------

class KeyStockIn(BaseModel):
    product_id: str
    duration: str = "day"
    keys: str
    mode: str = "keys"  # "keys" (one per line) or "accounts" (email:emailpass:discordpass:token per line)


@api_router.get("/admin/keystock/counts")
async def keystock_counts(admin: dict = Depends(get_admin)):
    pipeline = [
        {"$match": {"status": "available"}},
        {"$group": {"_id": {"product_id": "$product_id", "duration": "$duration"}, "count": {"$sum": 1}}},
    ]
    rows = await db.keystock.aggregate(pipeline).to_list(2000)
    out = {}
    for r in rows:
        pid = r["_id"]["product_id"]
        dur = r["_id"].get("duration") or "day"
        out.setdefault(pid, {"total": 0})
        out[pid][dur] = r["count"]
        out[pid]["total"] += r["count"]
    return out


@api_router.get("/admin/keystock/{product_id}")
async def keystock_list(product_id: str, admin: dict = Depends(get_admin)):
    return await db.keystock.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api_router.post("/admin/keystock")
async def keystock_add(body: KeyStockIn, admin: dict = Depends(get_admin)):
    product = await db.products.find_one({"id": body.product_id}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(404, "Product not found")
    if body.duration not in DURATIONS:
        raise HTTPException(400, "Invalid duration")
    lines = [k.strip() for k in body.keys.replace("\r", "").split("\n")]
    lines = [k for k in lines if k]
    if not lines:
        raise HTTPException(400, "No keys provided")
    email_re = re.compile(r"^[\w.+-]+@[\w-]+\.[\w.-]+$")
    seen = set()
    added, skipped, raw_count = 0, 0, 0
    now = datetime.now(timezone.utc).isoformat()
    for line in lines:
        account = None
        key = line
        if body.mode == "accounts":
            parts = [p.strip() for p in line.split(":")]
            fields = {}
            if "|" in line:
                for seg in line.split("|"):
                    if ":" in seg:
                        k, v = seg.split(":", 1)
                        fields[k.strip().lower()] = v.strip()
            if fields:
                # labeled pipe format — auto-detect by which labels are present
                email = fields.get("e-mail") or fields.get("email")
                if fields.get("2fa key") or fields.get("2fa redeem") or fields.get("rockstar password"):
                    password = fields.get("rockstar password") or fields.get("password")
                    if email and password:
                        account = {"email": email, "password": password}
                        if fields.get("2fa key"):
                            account["twofa_key"] = fields["2fa key"]
                        if fields.get("2fa redeem"):
                            account["twofa_redeem"] = fields["2fa redeem"]
                else:
                    mail_pass = fields.get("password")
                    if email and mail_pass:
                        account = {"email": email, "password": mail_pass}
                        if fields.get("steam username"):
                            account["steam_username"] = fields["steam username"]
                        if fields.get("steam password"):
                            account["steam_password"] = fields["steam password"]
                        if fields.get("webmail"):
                            account["webmail"] = fields["webmail"]
            elif len(parts) >= 4 and email_re.match(parts[0]) and parts[1] and parts[-1] and ":".join(parts[2:-1]):
                # discord colon format: email:email password:discord password:discord token
                account = {
                    "email": parts[0],
                    "email_password": parts[1],
                    "discord_password": ":".join(parts[2:-1]),
                    "discord_token": parts[-1],
                }
            elif len(parts) >= 2 and email_re.match(parts[0]) and parts[-1]:
                # plain email:password
                account = {"email": parts[0], "password": ":".join(parts[1:])}
            if account is None:
                # universal fallback — store the line exactly as pasted, deliver verbatim
                m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", line)
                account = {"raw": line}
                if m:
                    account["email"] = m.group(0)
                raw_count += 1
            key = account.get("email") or line
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        exists = await db.keystock.find_one({"product_id": body.product_id, "duration": body.duration, "key": key})
        if exists:
            skipped += 1
            continue
        doc = {
            "id": str(uuid.uuid4()), "product_id": body.product_id, "duration": body.duration,
            "key": key, "status": "available", "assigned_order_id": None, "assigned_at": None,
            "raw_line": line, "created_at": now,
        }
        if account:
            doc["account"] = account
        await db.keystock.insert_one(doc)
        added += 1
    return {"added": added, "skipped": skipped, "raw": raw_count}


@api_router.delete("/admin/keystock/{key_id}")
async def keystock_delete(key_id: str, admin: dict = Depends(get_admin)):
    res = await db.keystock.delete_one({"id": key_id, "status": "available"})
    if res.deleted_count == 0:
        raise HTTPException(400, "Key not found or already assigned")
    return {"deleted": True}


def _export_line(doc: dict) -> str:
    """Rebuild the original paste line for a stock item (for the Discord gen)."""
    if doc.get("raw_line"):
        return doc["raw_line"]
    acc = doc.get("account")
    if not acc:
        return doc.get("key", "")
    if acc.get("raw"):
        return acc["raw"]
    if acc.get("discord_token"):
        return ":".join(acc.get(f, "") for f in ("email", "email_password", "discord_password", "discord_token"))
    if acc.get("steam_username") or acc.get("webmail"):
        parts = []
        if acc.get("steam_username"):
            parts.append(f"Steam Username: {acc['steam_username']}")
        if acc.get("steam_password"):
            parts.append(f"Steam Password: {acc['steam_password']}")
        if acc.get("email"):
            parts.append(f"E-Mail: {acc['email']}")
        if acc.get("password"):
            parts.append(f"Password: {acc['password']}")
        if acc.get("webmail"):
            parts.append(f"Webmail: {acc['webmail']}")
        return " | ".join(parts)
    if acc.get("twofa_key") or acc.get("twofa_redeem"):
        parts = []
        if acc.get("email"):
            parts.append(f"E-Mail: {acc['email']}")
        if acc.get("password"):
            parts.append(f"Rockstar Password: {acc['password']}")
        if acc.get("twofa_key"):
            parts.append(f"2FA Key: {acc['twofa_key']}")
        if acc.get("twofa_redeem"):
            parts.append(f"2FA Redeem: {acc['twofa_redeem']}")
        return " | ".join(parts)
    if acc.get("email"):
        return f"{acc['email']}:{acc.get('password', '')}"
    return doc.get("key", "")


@api_router.get("/admin/keystock/{product_id}/export")
async def keystock_export(product_id: str, status: str = "available", admin: dict = Depends(get_admin)):
    if status not in ("available", "reserved", "assigned"):
        raise HTTPException(400, "Invalid status")
    docs = await db.keystock.find(
        {"product_id": product_id, "status": status}, {"_id": 0}
    ).sort("created_at", 1).to_list(10000)
    lines = [l for l in (_export_line(d) for d in docs) if l]
    return {"count": len(lines), "lines": lines}


@api_router.post("/admin/keystock/{product_id}/export-move")
async def keystock_export_move(product_id: str, admin: dict = Depends(get_admin)):
    """Export available stock in original format AND delete it (one-way transfer to the gen)."""
    docs = await db.keystock.find(
        {"product_id": product_id, "status": "available"}, {"_id": 0, "id": 1}
    ).sort("created_at", 1).to_list(10000)
    if not docs:
        return {"count": 0, "lines": [], "removed": 0}
    full = await db.keystock.find(
        {"product_id": product_id, "status": "available"}, {"_id": 0}
    ).sort("created_at", 1).to_list(10000)
    lines = [l for l in (_export_line(d) for d in full) if l]
    res = await db.keystock.delete_many(
        {"product_id": product_id, "status": "available", "id": {"$in": [d["id"] for d in docs]}}
    )
    logger.info("Export-move: %d items removed from product %s by %s", res.deleted_count, product_id, admin.get("username"))
    return {"count": len(lines), "lines": lines, "removed": res.deleted_count}


class SendStockIn(BaseModel):
    count: int
    email: EmailStr


@api_router.post("/admin/keystock/{product_id}/send-stock")
async def keystock_send_stock(product_id: str, body: SendStockIn, admin: dict = Depends(get_admin)):
    """Email N available items to an address in original paste format, then remove them from stock."""
    if body.count < 1:
        raise HTTPException(400, "Count must be at least 1")
    docs = await db.keystock.find(
        {"product_id": product_id, "status": "available"}, {"_id": 0}
    ).sort("created_at", 1).limit(body.count).to_list(body.count)
    if not docs:
        raise HTTPException(400, "No available stock for this product")
    lines = [(d["id"], l) for d in docs for l in [_export_line(d)] if l]
    if not lines:
        raise HTTPException(400, "Nothing exportable in stock")
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "name": 1})
    recipient = body.email.lower()
    try:
        await send_stock_transfer_email(recipient, (product or {}).get("name", "product"), [l for _, l in lines])
    except Exception as e:
        logger.error("Stock transfer email failed for %s: %s", recipient, e)
        raise HTTPException(500, "Could not send the email — stock was NOT removed, try again in a moment")
    res = await db.keystock.delete_many(
        {"product_id": product_id, "status": "available", "id": {"$in": [i for i, _ in lines]}}
    )
    logger.info("Send-stock: %d items emailed to %s from product %s by %s",
                res.deleted_count, recipient, product_id, admin.get("username"))
    return {"sent": len(lines), "removed": res.deleted_count, "email": recipient}


# ---------- admin: settings ----------

class SettingsIn(BaseModel):
    notify_email: Optional[EmailStr] = None
    drop_date: Optional[str] = None
    drop_teaser: Optional[str] = None
    checklist: Optional[dict] = None
    payid: Optional[str] = None
    bank_bsb: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    discord_webhooks: Optional[Dict[str, str]] = None
    gen_pools: Optional[Dict[str, str]] = None  # {"steam": product_id, "discord": ..., "rockstar": ...}
    generator_product_id: Optional[str] = None


@api_router.get("/admin/settings")
async def get_settings(admin: dict = Depends(get_admin)):
    doc = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return doc or {"id": "main", "notify_email": None}


@api_router.put("/admin/settings")
async def put_settings(body: SettingsIn, admin: dict = Depends(get_admin)):
    updates = body.model_dump(exclude_none=True)
    if "drop_date" in updates and updates["drop_date"] == "":
        updates.pop("drop_date")
    hooks = updates.get("discord_webhooks")
    if hooks:
        for kind, url in hooks.items():
            if kind not in DISCORD_ALERT_KINDS:
                raise HTTPException(400, f"Unknown alert kind: {kind}")
            if url and not url.startswith("https://discord"):
                raise HTTPException(400, "Webhook URLs must start with https://discord.com/api/webhooks/")
        updates["discord_webhooks"] = {k: v.strip() for k, v in hooks.items()}
    await db.settings.update_one(
        {"id": "main"},
        {"$set": {"id": "main", **updates}},
        upsert=True,
    )
    return await db.settings.find_one({"id": "main"}, {"_id": 0})


class DiscordTestIn(BaseModel):
    kind: str


@api_router.post("/admin/discord-test")
async def admin_discord_test(body: DiscordTestIn, admin: dict = Depends(get_admin)):
    if body.kind not in DISCORD_ALERT_KINDS:
        raise HTTPException(400, "Unknown alert kind")
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0, "discord_webhooks": 1})
    url = ((settings or {}).get("discord_webhooks") or {}).get(body.kind)
    if not url:
        raise HTTPException(400, f"No webhook URL saved for '{body.kind}' — paste one and save first")
    embed = {
        "title": "Desync alert test",
        "description": f"This channel now receives **{body.kind}** alerts from your store.",
        "color": 0x2E6BFF,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "Desync"},
    }
    async with httpx.AsyncClient(timeout=10) as h:
        r = await h.post(url, json={"embeds": [embed]})
    if r.status_code not in (200, 204):
        raise HTTPException(400, f"Discord rejected the webhook (HTTP {r.status_code}) — check the URL")
    return {"sent": True, "kind": body.kind}


class RestockAnnounceIn(BaseModel):
    duration: Optional[str] = None
    added: int = 0


@api_router.post("/admin/products/{product_id}/restock-announce")
async def admin_restock_announce(product_id: str, body: RestockAnnounceIn, admin: dict = Depends(get_admin)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0, "discord_webhooks": 1})
    url = ((settings or {}).get("discord_webhooks") or {}).get("restock")
    if not url:
        raise HTTPException(400, "No restock webhook saved — add one in the Alerts tab first")
    stock = await _available_stock_map()
    pstock = stock.get(product_id, {})
    fields = []
    for d in ("day", "week", "month", "lifetime"):
        price = (product.get("prices") or {}).get(d)
        if price is None:
            continue
        label = DURATIONS[d] + (f" · +{body.added} new" if d == body.duration and body.added else "")
        fields.append({"name": "Variant", "value": label, "inline": True})
        fields.append({"name": "Price", "value": f"A${float(price):.2f}", "inline": True})
        fields.append({"name": "Stock", "value": str(pstock.get(d, 0)), "inline": True})
    buy_link = f"{SITE_URL}/product/{product_id}" if SITE_URL else ""
    desc = f"Our product **{product['name']}** has just been restocked!"
    if buy_link:
        desc += f"\n[Buy Now]({buy_link})"
    embed = {
        "title": f"{product['name']} Restocked",
        "description": desc,
        "color": 0x22C55E,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "Desync"},
        "fields": fields,
    }
    img = product.get("image_url") or ""
    if img:
        embed["image"] = {"url": img if img.startswith("http") else f"{SITE_URL}{img}"}
    async with httpx.AsyncClient(timeout=10) as h:
        r = await h.post(url, json={"embeds": [embed]})
    if r.status_code not in (200, 204):
        raise HTTPException(400, f"Discord rejected the webhook (HTTP {r.status_code}) — check the URL in the Alerts tab")
    return {"announced": True, "product": product["name"]}


# ---------- public: drop config ----------

@api_router.get("/drop-config")
async def drop_config():
    doc = await db.settings.find_one({"id": "main"}, {"_id": 0, "drop_date": 1, "drop_teaser": 1})
    doc = doc or {}
    return {"drop_date": doc.get("drop_date"), "drop_teaser": doc.get("drop_teaser")}


# ---------- admin: stats & key assignment ----------

class AnnounceIn(BaseModel):
    subject: str = "The Desync drop is LIVE"
    message: str = "It's here. The next Desync release just went live — keys are in the shop right now. First come, first served."


@api_router.post("/admin/announce")
async def admin_announce(body: AnnounceIn, admin: dict = Depends(get_admin)):
    emails = await db.waitlist.find({}, {"_id": 0, "email": 1}).to_list(5000)
    if not emails:
        raise HTTPException(400, "Waitlist is empty")
    sent, failed = 0, 0
    for row in emails:
        try:
            await send_announce_email(row["email"], body.subject.strip(), body.message.strip())
            sent += 1
        except Exception as e:
            logger.error("Announce to %s failed: %s", row["email"], e)
            failed += 1
    await db.settings.update_one(
        {"id": "main"},
        {"$set": {"last_announce_at": datetime.now(timezone.utc).isoformat(),
                  "last_announce_sent": sent}},
        upsert=True,
    )
    return {"sent": sent, "failed": failed, "total": len(emails)}

@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin)):
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "sold": {"$sum": 1}, "revenue": {"$sum": "$items.unit_price"}}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(500)
    by_product = {r["_id"]: {"sold": r["sold"], "revenue": round(r["revenue"], 2)} for r in rows}
    paid = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "total": 1, "email": 1}).to_list(10000)
    revenue = round(sum(o.get("total", 0) for o in paid), 2)
    expenses = await db.expenses.find({}, {"_id": 0, "amount": 1}).to_list(10000)
    total_expenses = round(sum(e.get("amount", 0) for e in expenses), 2)
    return {
        "total_revenue": revenue,
        "total_orders": len(paid),
        "keys_sold": sum(v["sold"] for v in by_product.values()),
        "customers": len({o.get("email") for o in paid if o.get("email")}),
        "waitlist": await db.waitlist.count_documents({}),
        "total_expenses": total_expenses,
        "profit": round(revenue - total_expenses, 2),
        "by_product": by_product,
    }


@api_router.post("/admin/orders/{order_id}/assign-keys")
async def admin_assign_keys(order_id: str, admin: dict = Depends(get_admin)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "paid":
        raise HTTPException(400, "Order is not paid")
    items = order["items"]
    assigned = 0
    still_pending = False
    for item in items:
        qty = max(1, int(item.get("qty") or 1))
        deliverables = item.get("deliverables") or []
        prod = await db.products.find_one(
            {"id": item["product_id"]}, {"_id": 0, "delivery": 1, "ticket_url": 1, "discord_url": 1}
        )
        if prod and prod.get("delivery") == "ticket":
            item["ticket_url"] = prod.get("discord_url") or prod.get("ticket_url") or "https://discord.gg/de-sync"
            item["key_pending"] = False
            continue
        if item.get("license_key") and not deliverables:
            deliverables = [{"license_key": item["license_key"], "account": item.get("account")}]
        while len(deliverables) < qty:
            key_doc = await db.keystock.find_one_and_update(
                {"product_id": item["product_id"], "duration": item["duration"], "status": "available"},
                {"$set": {
                    "status": "assigned",
                    "assigned_order_id": order["id"],
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }},
                sort=[("created_at", 1)],
            )
            if not key_doc:
                break
            deliverables.append({"license_key": key_doc["key"], "account": key_doc.get("account")})
            assigned += 1
        if deliverables:
            item["deliverables"] = deliverables
            item["license_key"] = deliverables[0]["license_key"]
            item["account"] = deliverables[0].get("account")
        item["key_pending"] = len(deliverables) < qty
        if item["key_pending"]:
            still_pending = True
    if assigned:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"items": items, "keys_pending": still_pending,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        order["items"] = items
        try:
            await send_order_email(order)
        except Exception as e:
            logger.error("Resend keys email failed for %s: %s", order_id, e)
    return {"assigned": assigned, "keys_pending": still_pending, "items": items}


@api_router.post("/admin/orders/{order_id}/resend-email")
async def admin_resend_order_email(order_id: str, admin: dict = Depends(get_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "paid":
        raise HTTPException(400, "Only paid orders can be resent")
    await _attach_loader_links(order)
    try:
        await send_order_email(order)
    except Exception as e:
        logger.error("Resend order email failed for %s: %s", order_id, e)
        raise HTTPException(500, f"Email send failed: {e}")
    await db.orders.update_one({"id": order_id}, {"$set": {"email_sent": True}})
    return {"sent": True, "email": order["email"]}


# ---------- discord webhook alerts ----------

DISCORD_ALERT_KINDS = ("orders", "payments", "low_stock", "bank", "restock")


def _order_fields(order: dict) -> list:
    items_txt = ", ".join(
        f"{i['name']} ({i['duration_label']})" + (f" x{i['qty']}" if (i.get("qty") or 1) > 1 else "")
        for i in order.get("items", [])
    )
    fields = [
        {"name": "Order", "value": f"`{order['id'][:8].upper()}`", "inline": True},
        {"name": "Total", "value": f"A${order.get('total', 0):.2f}", "inline": True},
        {"name": "Items", "value": items_txt or "—", "inline": False},
        {"name": "Email", "value": order.get("email", "—"), "inline": False},
    ]
    if order.get("discord_username"):
        fields.append({"name": "Discord", "value": order["discord_username"], "inline": True})
    if order.get("reference"):
        fields.append({"name": "Reference", "value": f"`{order['reference']}`", "inline": True})
    if order.get("pay_currency"):
        coin = str(order["pay_currency"]).upper()
        amt = order.get("actually_paid")
        fields.append({"name": "Crypto paid", "value": f"{amt} {coin}" if amt else coin, "inline": True})
    return fields


async def _discord_alert(kind: str, title: str, description: str = "", fields: list = None, color: int = 0x2E6BFF):
    try:
        settings = await db.settings.find_one({"id": "main"}, {"_id": 0, "discord_webhooks": 1})
        url = ((settings or {}).get("discord_webhooks") or {}).get(kind)
        if not url:
            return
        embed = {
            "title": title, "description": description, "color": color,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "footer": {"text": "Desync"},
        }
        if fields:
            embed["fields"] = fields
        async with httpx.AsyncClient(timeout=10) as h:
            r = await h.post(url, json={"embeds": [embed]})
            if r.status_code not in (200, 204):
                logger.warning("Discord webhook %s returned %s", kind, r.status_code)
    except Exception as e:
        logger.error("Discord alert failed (%s): %s", kind, e)


# ---------- payments: bank transfer (PayID / BSB) ----------

BANK_ORDER_TTL_HOURS = 48


async def _bank_details() -> dict:
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}
    return {
        "payid": settings.get("payid"),
        "bank_bsb": settings.get("bank_bsb"),
        "bank_account_number": settings.get("bank_account_number"),
        "bank_account_name": settings.get("bank_account_name"),
    }


@api_router.post("/payments/bank-transfer")
async def bank_transfer_checkout(body: CheckoutIn):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    items, subtotal_cents, total_cents, discount_pct, coupon_code = await _price_cart(body.items, body.coupon)
    total = total_cents / 100.0
    order_id = str(uuid.uuid4())
    reference = "DS-" + order_id[:8].upper()
    now = datetime.now(timezone.utc)
    order = {
        "id": order_id, "email": body.email.lower(), "items": items,
        "discord_username": (body.discord_username or "").strip() or None,
        "subtotal": subtotal_cents / 100.0, "total": total,
        "discount": round((subtotal_cents - total_cents) / 100.0, 2),
        "currency": "aud", "provider": "bank_transfer",
        "payment_session_id": f"bank-{order_id}", "reference": reference,
        "coupon_code": coupon_code,
        "status": "awaiting_payment", "payment_status": "awaiting_payment",
        "download_token": secrets.token_urlsafe(24),
        "expires_at": (now + timedelta(hours=BANK_ORDER_TTL_HOURS)).isoformat(),
        "created_at": now.isoformat(), "updated_at": now.isoformat(),
    }
    await db.orders.insert_one(order)
    bank = await _bank_details()
    try:
        await send_bank_transfer_email(order, bank, reference, order["expires_at"])
    except Exception as e:
        logger.error("Bank transfer email failed for %s: %s", order_id, e)
    await _discord_alert(
        "bank", "New bank transfer order", "Awaiting payment — watch for the transfer.",
        fields=_order_fields(order), color=0x38BDF8,
    )
    return {
        "order_id": order_id, "reference": reference, "total": total,
        "expires_at": order["expires_at"], "bank": bank,
    }


@api_router.get("/payments/bank-transfer/{order_id}")
async def bank_transfer_details(order_id: str):
    order = await db.orders.find_one(
        {"id": order_id, "provider": "bank_transfer", "payment_status": "awaiting_payment"}, {"_id": 0}
    )
    if not order:
        raise HTTPException(404, "Order not found or no longer awaiting payment")
    return {
        "order_id": order["id"], "reference": order["reference"], "total": order["total"],
        "expires_at": order["expires_at"], "bank": await _bank_details(),
        "items": [{"name": i["name"], "duration_label": i["duration_label"]} for i in order["items"]],
    }


@api_router.post("/payments/bank-transfer/{order_id}/confirm")
async def bank_transfer_confirm(order_id: str):
    order = await db.orders.find_one({"id": order_id, "provider": "bank_transfer"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "awaiting_payment":
        raise HTTPException(400, "Order is no longer awaiting payment")
    if order.get("payment_reported"):
        return {"reported": True, "already": True}
    now = datetime.now(timezone.utc).isoformat()
    reserved, wanted = 0, 0
    for item in order["items"]:
        qty = max(1, int(item.get("qty") or 1))
        wanted += qty
        for _ in range(qty):
            res = await db.keystock.find_one_and_update(
                {"product_id": item["product_id"], "duration": item["duration"], "status": "available"},
                {"$set": {"status": "reserved", "reserved_order_id": order_id, "reserved_at": now}},
                sort=[("created_at", 1)],
            )
            if res:
                reserved += 1
            else:
                break
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_reported": True, "reported_at": now,
                  "reserved_count": reserved, "reserved_all": reserved >= wanted,
                  "updated_at": now}},
    )
    await _discord_alert(
        "bank", "Buyer reports payment sent", "Stock reserved — verify the transfer, then mark paid or cancel.",
        fields=_order_fields({**order, "items": order["items"]}), color=0xF5C158,
    )
    return {"reported": True, "already": False, "reserved": reserved, "reserved_all": reserved >= wanted}


@api_router.post("/admin/orders/{order_id}/cancel")
async def admin_cancel_order(order_id: str, admin: dict = Depends(get_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "awaiting_payment":
        raise HTTPException(400, "Only orders awaiting payment can be cancelled")
    now = datetime.now(timezone.utc).isoformat()
    rel = await db.keystock.update_many(
        {"reserved_order_id": order_id, "status": "reserved"},
        {"$set": {"status": "available"}, "$unset": {"reserved_order_id": "", "reserved_at": ""}},
    )
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_status": "cancelled", "status": "cancelled", "updated_at": now}},
    )
    try:
        await send_bank_expired_email(order, "we could not verify your payment")
    except Exception as e:
        logger.error("Cancel email failed for %s: %s", order_id, e)
    await _discord_alert(
        "bank", "Bank order cancelled", f"Released {rel.modified_count} reserved item(s) back to stock.",
        fields=_order_fields(order), color=0xEF4444,
    )
    try:
        await _recompute_entitlements(order["email"])
    except Exception as e:
        logger.error("Entitlement recompute failed for %s: %s", order.get("email"), e)
    return {"cancelled": True, "released": rel.modified_count}


@api_router.post("/admin/orders/{order_id}/mark-paid")
async def admin_mark_paid(order_id: str, admin: dict = Depends(get_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("provider") != "bank_transfer":
        raise HTTPException(400, "Only bank transfer orders can be marked paid manually")
    if order.get("payment_status") != "awaiting_payment":
        raise HTTPException(400, "Order is not awaiting payment")
    updated = await _fulfill_order({"id": order_id})
    return {"fulfilled": bool(updated and updated.get("payment_status") == "paid"), "order_id": order_id}


CRYPTO_ORDER_TTL_HOURS = 24


async def _sweep_expired_orders() -> dict:
    """Expire stale orders: bank transfers past their 48h window (release reserved stock)
    and unpaid crypto orders older than 24h. Returns counts."""
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    result = {"bank_expired": 0, "crypto_expired": 0}
    expired = await db.orders.find(
        {"provider": "bank_transfer", "payment_status": "awaiting_payment", "expires_at": {"$lt": now}},
        {"_id": 0},
    ).to_list(100)
    for o in expired:
        rel = await db.keystock.update_many(
            {"reserved_order_id": o["id"], "status": "reserved"},
            {"$set": {"status": "available"}, "$unset": {"reserved_order_id": "", "reserved_at": ""}},
        )
        res = await db.orders.update_one(
            {"id": o["id"], "payment_status": "awaiting_payment"},
            {"$set": {"payment_status": "cancelled", "status": "cancelled", "updated_at": now}},
        )
        if res.modified_count:
            result["bank_expired"] += 1
            logger.info("Bank order %s expired, released %d reserved keys", o["id"], rel.modified_count)
            try:
                await send_bank_expired_email(o)
            except Exception as e:
                logger.error("Bank expiry email failed for %s: %s", o["id"], e)
    crypto_cutoff = (now_dt - timedelta(hours=CRYPTO_ORDER_TTL_HOURS)).isoformat()
    stale = await db.orders.find(
        {"provider": "crypto", "payment_status": "pending", "created_at": {"$lt": crypto_cutoff}},
        {"_id": 0, "id": 1},
    ).to_list(200)
    for o in stale:
        res = await db.orders.update_one(
            {"id": o["id"], "payment_status": "pending"},
            {"$set": {"payment_status": "expired", "status": "expired", "updated_at": now}},
        )
        if res.modified_count:
            result["crypto_expired"] += 1
            logger.info("Crypto order %s auto-expired (unpaid >%dh)", o["id"], CRYPTO_ORDER_TTL_HOURS)
    return result


@api_router.post("/admin/orders/sweep-expired")
async def admin_sweep_expired(admin: dict = Depends(get_admin)):
    return await _sweep_expired_orders()


async def _bank_expiry_loop():
    while True:
        try:
            await _sweep_expired_orders()
        except Exception as e:
            logger.error("Expiry sweep error: %s", e)
        await asyncio.sleep(900)


# ---------- admin: customers ----------

class CustomerIn(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    note: Optional[str] = None


class SendKeyIn(BaseModel):
    email: EmailStr
    product_id: str
    duration: str
    qty: int = 1


@api_router.get("/admin/customers")
async def admin_customers(admin: dict = Depends(get_admin)):
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {
            "_id": "$email", "total_spent": {"$sum": "$total"}, "orders": {"$sum": 1},
            "last_order": {"$max": "$created_at"},
        }},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(5000)
    by_email = {}
    for r in rows:
        by_email[r["_id"]] = {
            "email": r["_id"], "total_spent": round(r["total_spent"], 2),
            "orders": r["orders"], "last_order": r["last_order"], "manual": False,
        }
    for m in await db.customers.find({}, {"_id": 0}).to_list(5000):
        e = by_email.setdefault(m["email"], {
            "email": m["email"], "total_spent": 0.0, "orders": 0, "last_order": None, "manual": True,
        })
        e["manual"] = True
        if m.get("name"):
            e["name"] = m["name"]
        if m.get("note"):
            e["note"] = m["note"]
    return sorted(by_email.values(), key=lambda x: x["total_spent"], reverse=True)


@api_router.post("/admin/customers")
async def admin_add_customer(body: CustomerIn, admin: dict = Depends(get_admin)):
    email = body.email.lower()
    await db.customers.update_one(
        {"email": email},
        {"$set": {
            "email": email, "name": body.name, "note": body.note,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"email": email}


@api_router.post("/admin/customers/send-key")
async def admin_send_key(body: SendKeyIn, admin: dict = Depends(get_admin)):
    product = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    if body.duration not in DURATIONS or product.get("prices", {}).get(body.duration) is None:
        raise HTTPException(400, "Duration not available for this product")
    qty = max(1, min(100, int(body.qty or 1)))
    in_stock = await db.keystock.count_documents(
        {"product_id": body.product_id, "duration": body.duration, "status": "available"}
    )
    if in_stock < qty:
        raise HTTPException(400, f"Only {in_stock} in stock for this product + duration")
    order_id = str(uuid.uuid4())
    deliverables = []
    for _ in range(qty):
        key_doc = await db.keystock.find_one_and_update(
            {"product_id": body.product_id, "duration": body.duration, "status": "available"},
            {"$set": {"status": "assigned", "assigned_order_id": order_id,
                      "assigned_at": datetime.now(timezone.utc).isoformat()}},
            sort=[("created_at", 1)],
        )
        if not key_doc:
            break
        deliverables.append({"license_key": key_doc["key"], "account": key_doc.get("account")})
    if not deliverables:
        raise HTTPException(400, "No keys in stock for this product + duration")
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "product_id": product["id"], "name": product["name"], "game": product["game"],
        "duration": body.duration, "duration_label": DURATIONS[body.duration],
        "unit_price": 0.0, "qty": qty, "deliverables": deliverables,
        "license_key": deliverables[0]["license_key"],
        "account": deliverables[0].get("account"),
        "key_pending": len(deliverables) < qty,
    }
    order = {
        "id": order_id, "email": body.email.lower(),
        "items": [item],
        "subtotal": 0.0, "total": 0.0, "discount": 0.0, "currency": "aud",
        "provider": "manual", "payment_session_id": f"manual-{order_id}",
        "coupon_code": None, "status": "completed", "payment_status": "paid",
        "download_token": secrets.token_urlsafe(24),
        "paid_at": now, "created_at": now, "updated_at": now,
    }
    await db.orders.insert_one(order)
    try:
        await _attach_loader_links(order)
        await send_order_email(order)
        await db.orders.update_one({"id": order_id}, {"$set": {"email_sent": True}})
    except Exception as e:
        logger.error("Manual key email failed for %s: %s", order_id, e)
        raise HTTPException(500, "Key(s) assigned but email failed — check the order in the Orders tab")
    await _discord_alert(
        "orders", "Manual key sent", "Staff sent key(s) manually from the Customers tab.",
        fields=_order_fields(order), color=0xA78BFA,
    )
    return {"sent": True, "order_id": order_id, "sent_count": len(deliverables)}


# ---------- admin: expenses ----------

class ExpenseIn(BaseModel):
    label: str
    amount: float
    category: str = "General"
    date: Optional[str] = None


@api_router.get("/admin/expenses")
async def admin_expenses(admin: dict = Depends(get_admin)):
    return await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(2000)


@api_router.post("/admin/expenses")
async def admin_add_expense(body: ExpenseIn, admin: dict = Depends(get_admin)):
    if not body.label.strip():
        raise HTTPException(400, "Label required")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    doc = {
        "id": str(uuid.uuid4()), "label": body.label.strip(),
        "amount": round(body.amount, 2), "category": body.category.strip() or "General",
        "date": body.date or datetime.now(timezone.utc).date().isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.delete("/admin/expenses/{expense_id}")
async def admin_delete_expense(expense_id: str, admin: dict = Depends(get_admin)):
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Expense not found")
    return {"deleted": True}


# ---------- coupons ----------

class CouponIn(BaseModel):
    code: str
    percent: float
    max_uses: Optional[int] = None
    active: bool = True
    product_id: Optional[str] = None  # tie the code to one product; None = store-wide


class CouponValidateIn(BaseModel):
    code: str


async def _find_valid_coupon(code: str) -> Optional[dict]:
    c = await db.coupons.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not c:
        return None
    if c.get("max_uses") is not None and c.get("used_count", 0) >= c["max_uses"]:
        return None
    return c


@api_router.post("/coupons/validate")
async def validate_coupon(body: CouponValidateIn):
    c = await _find_valid_coupon(body.code)
    if not c:
        raise HTTPException(404, "Invalid or expired code")
    return {"code": c["code"], "percent": c["percent"], "product_id": c.get("product_id")}


@api_router.get("/coupons/banner")
async def coupon_banner():
    """Best active store-wide coupon for the promo chip — null when none is active."""
    coupons = await db.coupons.find(
        {"active": True, "$or": [{"product_id": None}, {"product_id": {"$exists": False}}]},
        {"_id": 0, "code": 1, "percent": 1, "max_uses": 1, "used_count": 1},
    ).to_list(100)
    valid = [c for c in coupons if c.get("max_uses") is None or c.get("used_count", 0) < c["max_uses"]]
    if not valid:
        return {"code": None, "percent": None}
    best = max(valid, key=lambda c: float(c["percent"]))
    return {"code": best["code"], "percent": best["percent"]}


@api_router.get("/admin/coupons")
async def admin_coupons(admin: dict = Depends(get_admin)):
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/coupons")
async def admin_create_coupon(body: CouponIn, admin: dict = Depends(get_admin)):
    code = body.code.strip().upper()
    if not code or len(code) < 3:
        raise HTTPException(400, "Code must be 3+ characters")
    if not (0 < body.percent <= 100):
        raise HTTPException(400, "Percent must be between 1 and 100")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(409, "That code already exists")
    if body.product_id:
        if not await db.products.find_one({"id": body.product_id}, {"_id": 0, "id": 1}):
            raise HTTPException(404, "Product not found")
    doc = {
        "id": str(uuid.uuid4()), "code": code, "percent": float(body.percent),
        "max_uses": body.max_uses, "active": body.active, "used_count": 0,
        "product_id": body.product_id or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.coupons.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.put("/admin/coupons/{coupon_id}")
async def admin_toggle_coupon(coupon_id: str, body: dict, admin: dict = Depends(get_admin)):
    res = await db.coupons.update_one({"id": coupon_id}, {"$set": {"active": bool(body.get("active"))}})
    if res.matched_count == 0:
        raise HTTPException(404, "Coupon not found")
    return await db.coupons.find_one({"id": coupon_id}, {"_id": 0})


@api_router.delete("/admin/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, admin: dict = Depends(get_admin)):
    res = await db.coupons.delete_one({"id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Coupon not found")
    return {"deleted": True}


# ---------- admin: users ----------

@api_router.get("/admin/users")
async def admin_users(owner: dict = Depends(require_owner)):
    return await db.admins.find({}, {"_id": 0, "password_hash": 0}).to_list(100)


@api_router.post("/admin/users")
async def admin_create_user(body: AdminUserIn, owner: dict = Depends(require_owner)):
    username = body.username.strip().lower()
    if not username or len(body.password) < 6:
        raise HTTPException(400, "Username required and password must be 6+ chars")
    if body.role not in {"admin", "owner"}:
        raise HTTPException(400, "Invalid role")
    if await db.admins.find_one({"username": username}):
        raise HTTPException(409, "Username already exists")
    doc = {
        "id": str(uuid.uuid4()), "username": username,
        "password_hash": hash_password(body.password), "role": body.role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admins.insert_one(doc)
    return {"id": doc["id"], "username": username, "role": body.role}


@api_router.delete("/admin/users/{admin_id}")
async def admin_delete_user(admin_id: str, owner: dict = Depends(require_owner)):
    target = await db.admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(404, "Admin not found")
    if target["id"] == owner["id"]:
        raise HTTPException(400, "You cannot delete yourself")
    await db.admins.delete_one({"id": admin_id})
    return {"deleted": True}


# ---------- payments ----------

async def _fulfill_order(where: dict) -> Optional[dict]:
    order = await db.orders.find_one(where, {"_id": 0})
    if not order or order.get("payment_status") == "paid":
        return order
    items = order["items"]
    keys_pending = False
    for item in items:
        qty = max(1, int(item.get("qty") or 1))
        deliverables = item.get("deliverables") or []
        prod = await db.products.find_one(
            {"id": item["product_id"]}, {"_id": 0, "delivery": 1, "ticket_url": 1, "discord_url": 1}
        )
        if prod and prod.get("delivery") == "ticket":
            item["ticket_url"] = prod.get("discord_url") or prod.get("ticket_url") or "https://discord.gg/de-sync"
            item["key_pending"] = False
            continue
        if item.get("license_key") and not deliverables:
            deliverables = [{"license_key": item["license_key"], "account": item.get("account")}]
        while len(deliverables) < qty:
            assign_set = {
                "status": "assigned",
                "assigned_order_id": order["id"],
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            }
            key_doc = await db.keystock.find_one_and_update(
                {"product_id": item["product_id"], "duration": item["duration"],
                 "status": "reserved", "reserved_order_id": order["id"]},
                {"$set": assign_set, "$unset": {"reserved_order_id": "", "reserved_at": ""}},
                sort=[("created_at", 1)],
            )
            if not key_doc:
                key_doc = await db.keystock.find_one_and_update(
                    {"product_id": item["product_id"], "duration": item["duration"], "status": "available"},
                    {"$set": assign_set},
                    sort=[("created_at", 1)],
                )
            if not key_doc:
                break
            deliverables.append({"license_key": key_doc["key"], "account": key_doc.get("account")})
            remaining = await db.keystock.count_documents(
                {"product_id": item["product_id"], "duration": item["duration"], "status": "available"}
            )
            if remaining in (0, 4):
                settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
                notify = (settings or {}).get("notify_email")
                if notify:
                    try:
                        await send_low_stock_email(
                            notify, item["name"], DURATIONS[item["duration"]], remaining
                        )
                    except Exception as e:
                        logger.error("Low stock email failed: %s", e)
                await _discord_alert(
                    "low_stock",
                    "Out of stock" if remaining == 0 else "Low stock",
                    f"**{item['name']}** ({DURATIONS[item['duration']]}) has **{remaining}** left.",
                    color=0xEF4444 if remaining == 0 else 0xF5C158,
                )
        if deliverables:
            item["deliverables"] = deliverables
            item["license_key"] = deliverables[0]["license_key"]
            item["account"] = deliverables[0].get("account")
            item["key_pending"] = len(deliverables) < qty
        else:
            item["key_pending"] = True
        if item["key_pending"]:
            keys_pending = True
    res = await db.orders.update_one(
        {**where, "payment_status": {"$ne": "paid"}},
        {"$set": {
            "status": "completed", "payment_status": "paid", "items": items,
            "keys_pending": keys_pending,
            "paid_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    updated = await db.orders.find_one(where, {"_id": 0})
    if res.modified_count > 0 and updated:
        if updated.get("coupon_code"):
            await db.coupons.update_one({"code": updated["coupon_code"]}, {"$inc": {"used_count": 1}})
        try:
            await _attach_loader_links(updated)
            await send_order_email(updated)
            await db.orders.update_one({"id": updated["id"]}, {"$set": {"email_sent": True}})
        except Exception as e:
            logger.error("Order email failed for %s: %s", updated.get("id"), e)
        provider = updated.get("provider") or ("paypal" if updated.get("payment_provider") == "paypal" else "stripe")
        await _discord_alert(
            "payments", "Payment received", f"Order paid via **{provider}** and fulfilled.",
            fields=_order_fields(updated), color=0x22C55E,
        )
        if updated.get("email"):
            try:
                await _recompute_entitlements(updated["email"])
            except Exception as e:
                logger.error("Entitlement recompute failed for %s: %s", updated.get("email"), e)
    return updated


async def fulfill_order(session_id: str) -> Optional[dict]:
    return await _fulfill_order({"session_id": session_id})


async def _price_cart(items: List[CartItemIn], coupon: Optional[str]):
    discount_pct = 0.0
    coupon_code = None
    coupon_product_id = None
    if coupon:
        c = await _find_valid_coupon(coupon)
        if not c:
            raise HTTPException(400, "Invalid or expired coupon code")
        discount_pct = float(c["percent"])
        coupon_code = c["code"]
        coupon_product_id = c.get("product_id")
    order_items = []
    total_cents = 0
    subtotal_cents = 0
    for item in items:
        if item.duration not in DURATIONS:
            raise HTTPException(400, f"Invalid duration: {item.duration}")
        product = await db.products.find_one({"id": item.product_id, "active": True}, {"_id": 0})
        if not product:
            raise HTTPException(404, "Product not found")
        price = product.get("prices", {}).get(item.duration)
        if price is None:
            raise HTTPException(400, f"Duration not available for {product['name']}")
        min_buy = max(1, int(product.get("min_buy") or 1))
        qty = max(1, int(getattr(item, "qty", 1) or 1))
        if qty < min_buy:
            raise HTTPException(400, f"{product['name']} has a minimum purchase of {min_buy}")
        if product.get("delivery") != "ticket":
            in_stock = await db.keystock.count_documents(
                {"product_id": product["id"], "duration": item.duration, "status": "available"}
            )
            if in_stock == 0:
                raise HTTPException(400, f"{product['name']} ({DURATIONS[item.duration]}) is sold out")
            if in_stock < qty:
                raise HTTPException(400, f"Only {in_stock} left of {product['name']} ({DURATIONS[item.duration]})")
        applies = not coupon_product_id or product["id"] == coupon_product_id
        unit_cents = int(round(float(price) * 100 * (1 - (discount_pct if applies else 0) / 100)))
        subtotal_cents += int(round(float(price) * 100)) * qty
        total_cents += unit_cents * qty
        order_items.append({
            "product_id": product["id"], "name": product["name"], "game": product["game"],
            "duration": item.duration, "duration_label": DURATIONS[item.duration],
            "unit_price": unit_cents / 100.0, "license_key": None, "qty": qty,
        })
    return order_items, subtotal_cents, total_cents, discount_pct, coupon_code


@api_router.post("/payments/checkout")
async def create_checkout(body: CheckoutIn):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    email = body.email.lower()
    order_items, subtotal_cents, total_cents, discount_pct, coupon_code = await _price_cart(
        body.items, body.coupon
    )
    line_items = [
        {
            "price_data": {
                "currency": "aud",
                "unit_amount": int(round(it["unit_price"] * 100)),
                "product_data": {"name": f"{it['name']} — {it['duration_label']}", "tax_code": "txcd_10000000"},
            },
            "quantity": int(it.get("qty", 1)),
        }
        for it in order_items
    ]

    order_id = str(uuid.uuid4())
    kwargs = dict(
        line_items=line_items,
        mode="payment",
        customer_email=email,
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{body.origin_url}/payment/cancel",
        metadata={"order_id": order_id},
    )
    try:
        if TAX_MODE == "full":
            try:
                session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
            except stripe.error.InvalidRequestError as e:
                msg = (e.user_message or "").lower()
                if "managed payments" in msg or "ineligible" in msg:
                    session = stripe.checkout.Session.create(
                        **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required"
                    )
                else:
                    raise
        else:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required"
            )
    except stripe.error.StripeError as e:
        logger.error("Stripe error: %s", e)
        raise HTTPException(502, f"Payment provider error: {e.user_message or str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    new_order = {
        "id": order_id, "session_id": session.id, "email": email,
        "discord_username": (body.discord_username or "").strip() or None,
        "items": order_items, "total": total_cents / 100.0, "currency": "aud",
        "subtotal": subtotal_cents / 100.0, "discount_percent": discount_pct,
        "coupon_code": coupon_code,
        "status": "initiated", "payment_status": "pending",
        "download_token": secrets.token_urlsafe(24),
        "created_at": now, "updated_at": now,
    }
    await db.orders.insert_one(new_order)
    await _discord_alert(
        "orders", "New order (card checkout)", "Stripe checkout session created — awaiting payment.",
        fields=_order_fields(new_order), color=0x8B9CF9,
    )
    return {"checkout_url": session.url, "session_id": session.id}


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                order = await fulfill_order(session_id)
                order = dict(order)
                order.pop("_id", None)
        except stripe.error.StripeError:
            pass
    if order.get("payment_status") == "paid":
        await _attach_loader_links(order)
        order.pop("download_token", None)
    return {
        "session_id": session_id,
        "status": order["status"],
        "payment_status": order["payment_status"],
        "order": order if order.get("payment_status") == "paid" else None,
    }


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await fulfill_order(obj["id"])
    elif t in ("checkout.session.async_payment_failed", "checkout.session.expired"):
        await db.orders.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "failed" if "failed" in t else "expired",
                      "payment_status": "failed" if "failed" in t else "expired",
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"status": "ok"}


# ---------- paypal ----------

PAYPAL_BASE = os.environ.get("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID")
PAYPAL_SECRET = os.environ.get("PAYPAL_SECRET")
_paypal_cache = {"token": None, "expires": 0.0}


async def paypal_token() -> str:
    if not PAYPAL_CLIENT_ID or not PAYPAL_SECRET:
        raise HTTPException(503, "PayPal is not configured")
    now = time.time()
    if _paypal_cache["token"] and _paypal_cache["expires"] > now + 30:
        return _paypal_cache["token"]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
            data={"grant_type": "client_credentials"},
        )
    if resp.status_code != 200:
        logger.error("PayPal auth failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, "PayPal authentication failed")
    data = resp.json()
    _paypal_cache["token"] = data["access_token"]
    _paypal_cache["expires"] = now + data.get("expires_in", 3000)
    return data["access_token"]


class PayPalCreateIn(BaseModel):
    email: EmailStr
    items: List[CartItemIn]
    coupon: Optional[str] = None


class PayPalCaptureIn(BaseModel):
    paypal_order_id: str


@api_router.post("/paypal/create")
async def paypal_create(body: PayPalCreateIn):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    email = body.email.lower()
    order_items, subtotal_cents, total_cents, discount_pct, coupon_code = await _price_cart(
        body.items, body.coupon
    )
    if total_cents <= 0:
        raise HTTPException(400, "Total must be above zero")
    order_id = str(uuid.uuid4())
    token = await paypal_token()
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": order_id,
            "custom_id": order_id,
            "description": "Desync — game keys",
            "amount": {"currency_code": "AUD", "value": f"{total_cents / 100:.2f}"},
        }],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{PAYPAL_BASE}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code >= 400:
        logger.error("PayPal order create failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, "PayPal could not create the order")
    pp = resp.json()
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.insert_one({
        "id": order_id, "session_id": None, "paypal_order_id": pp["id"],
        "payment_provider": "paypal", "email": email,
        "discord_username": (body.discord_username or "").strip() or None,
        "items": order_items, "total": total_cents / 100.0, "currency": "aud",
        "subtotal": subtotal_cents / 100.0, "discount_percent": discount_pct,
        "coupon_code": coupon_code,
        "status": "initiated", "payment_status": "pending",
        "download_token": secrets.token_urlsafe(24),
        "created_at": now, "updated_at": now,
    })
    return {"paypal_order_id": pp["id"], "order_id": order_id}


@api_router.post("/paypal/capture")
async def paypal_capture(body: PayPalCaptureIn):
    token = await paypal_token()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{PAYPAL_BASE}/v2/checkout/orders/{body.paypal_order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if resp.status_code >= 400:
        logger.error("PayPal capture failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, "PayPal capture failed")
    data = resp.json()
    if data.get("status") != "COMPLETED":
        raise HTTPException(402, "Payment not completed")
    order = await _fulfill_order({"paypal_order_id": body.paypal_order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    return {"status": "paid", "order_id": order["id"]}


# ---------- payments: crypto (NOWPayments) ----------

NOWPAYMENTS_API_KEY = os.environ.get("NOWPAYMENTS_API_KEY")
NOWPAYMENTS_IPN_SECRET = (os.environ.get("NOWPAYMENTS_IPN_SECRET") or "").strip()
NP_BASE = "https://api.nowpayments.io/v1"


@api_router.post("/payments/crypto")
async def crypto_checkout(body: CheckoutIn):
    if not NOWPAYMENTS_API_KEY:
        raise HTTPException(503, "Crypto payments are not configured")
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    email = body.email.lower()
    order_items, subtotal_cents, total_cents, discount_pct, coupon_code = await _price_cart(
        body.items, body.coupon
    )
    if total_cents <= 0:
        raise HTTPException(400, "Total must be above zero")
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    order = {
        "id": order_id, "session_id": None, "email": email,
        "discord_username": (body.discord_username or "").strip() or None,
        "items": order_items, "total": total_cents / 100.0, "currency": "aud",
        "subtotal": subtotal_cents / 100.0, "discount_percent": discount_pct,
        "coupon_code": coupon_code,
        "provider": "crypto", "status": "initiated", "payment_status": "pending",
        "download_token": secrets.token_urlsafe(24),
        "created_at": now, "updated_at": now,
    }
    payload = {
        "price_amount": round(total_cents / 100.0, 2),
        "price_currency": "aud",
        "order_id": order_id,
        "order_description": f"Desync order {order_id[:8].upper()}",
        "ipn_callback_url": f"{SITE_URL}/api/payments/crypto/webhook",
        "success_url": f"{body.origin_url}/payment/success?order={order_id}",
        "cancel_url": f"{body.origin_url}/",
    }
    async with httpx.AsyncClient(timeout=20) as h:
        resp = await h.post(
            f"{NP_BASE}/invoice",
            headers={"x-api-key": NOWPAYMENTS_API_KEY, "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code >= 400:
        logger.error("NOWPayments invoice failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, "Crypto checkout is unavailable right now — try card or bank transfer")
    invoice = resp.json()
    if not invoice.get("invoice_url") or not invoice.get("id"):
        raise HTTPException(502, "Invalid response from crypto provider")
    order["np_invoice_id"] = str(invoice["id"])
    await db.orders.insert_one(order)
    await _discord_alert(
        "orders", "New order (crypto checkout)", "NOWPayments invoice created — awaiting payment.",
        fields=_order_fields(order), color=0xF7931A,
    )
    return {"invoice_url": invoice["invoice_url"], "order_id": order_id}


def _np_sort(value):
    if isinstance(value, dict):
        return {k: _np_sort(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [_np_sort(x) for x in value]
    return value


def _np_verify(payload: dict, signature: str) -> bool:
    if not signature or not NOWPAYMENTS_IPN_SECRET:
        return False
    canonical = json.dumps(_np_sort(payload), separators=(",", ":"), ensure_ascii=False).encode()
    expected = hmac.new(NOWPAYMENTS_IPN_SECRET.encode(), canonical, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


@api_router.post("/payments/crypto/webhook")
async def crypto_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    if not isinstance(payload, dict) or not _np_verify(payload, request.headers.get("x-nowpayments-sig", "")):
        raise HTTPException(401, "Invalid signature")
    order_id = str(payload.get("order_id") or "")
    pay_status = payload.get("payment_status")
    if not order_id:
        raise HTTPException(400, "Missing order id")
    order = await db.orders.find_one({"id": order_id, "provider": "crypto"}, {"_id": 0, "id": 1, "payment_status": 1})
    if not order:
        raise HTTPException(404, "Order not found")
    now = datetime.now(timezone.utc).isoformat()
    if pay_status in ("confirmed", "finished"):
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"np_payment_id": str(payload.get("payment_id") or ""),
                      "pay_currency": payload.get("pay_currency"),
                      "actually_paid": payload.get("actually_paid"),
                      "updated_at": now}},
        )
        asyncio.create_task(_fulfill_order({"id": order_id}))
    elif pay_status in ("failed", "expired", "refunded"):
        await db.orders.update_one(
            {"id": order_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": pay_status, "status": pay_status, "updated_at": now}},
        )
    else:
        # waiting / confirming / partially_paid / sending — record progress only
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"np_payment_id": str(payload.get("payment_id") or ""), "np_status": pay_status,
                      "updated_at": now}},
        )
    return {"received": True}


@api_router.get("/orders/by-id/{order_id}")
async def order_by_id(order_id: str):
    order = await db.orders.find_one({"id": order_id, "payment_status": "paid"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    await _attach_loader_links(order)
    order.pop("download_token", None)
    return order


# ---------- customer portal, generator entitlements & reviews ----------

GEN_TYPES = ("steam", "discord", "rockstar")
STANDARD_LIMIT = 1   # per type per hour for >A$10 orders
GENERATOR_LIMIT = 3  # per type per hour for Generator owners


def _gen_key():
    seg = lambda: "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    return f"DSYNC-{seg()}-{seg()}-{seg()}"


async def _get_settings_doc() -> dict:
    return await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}


async def _generator_product_id(settings: Optional[dict] = None) -> Optional[str]:
    s = settings or await _get_settings_doc()
    if s.get("generator_product_id"):
        return s["generator_product_id"]
    p = await db.products.find_one({"name": {"$regex": "generator", "$options": "i"}}, {"_id": 0, "id": 1})
    return p["id"] if p else None


async def _audit(admin: dict, action: str, customer_email: str, detail: str = ""):
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "admin": admin.get("username", "?"), "action": action,
        "customer_email": customer_email, "detail": detail,
        "ts": datetime.now(timezone.utc).isoformat(),
    })


async def _entitlement_state(email: str) -> dict:
    paid = await db.orders.find(
        {"email": email, "payment_status": "paid"}, {"_id": 0, "total": 1, "items": 1}
    ).to_list(500)
    gen_pid = await _generator_product_id()
    has_generator = any(
        gen_pid and any(i.get("product_id") == gen_pid for i in o.get("items", [])) for o in paid
    )
    has_standard = any(float(o.get("total") or 0) > 10 for o in paid)
    cust = await db.customers.find_one({"email": email}, {"_id": 0})
    gen_access = has_generator or bool(cust and cust.get("gen_access_manual"))
    limits = {t: (GENERATOR_LIMIT if gen_access else STANDARD_LIMIT if has_standard else 0) for t in GEN_TYPES}
    return {
        "customer": cust, "has_generator": has_generator, "has_standard": has_standard,
        "gen_access": gen_access, "entitled": gen_access or has_standard, "limits": limits,
    }


async def _ensure_customer(email: str) -> dict:
    await db.customers.update_one(
        {"email": email},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return await db.customers.find_one({"email": email}, {"_id": 0})


async def _ensure_gen_key(email: str) -> str:
    cust = await _ensure_customer(email)
    if cust.get("gen_key"):
        return cust["gen_key"]
    key = _gen_key()
    while await db.customers.find_one({"gen_key": key}):
        key = _gen_key()
    await db.customers.update_one(
        {"email": email},
        {"$set": {"gen_key": key, "gen_key_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return key


async def _recompute_entitlements(email: str):
    """Grant/revoke Generator access + key based on paid orders. Manual admin grants are untouched."""
    state = await _entitlement_state(email)
    cust = state["customer"] or {}
    now = datetime.now(timezone.utc).isoformat()
    if state["has_generator"]:
        key = await _ensure_gen_key(email)
        await db.customers.update_one(
            {"email": email},
            {"$set": {"gen_access": True, "gen_access_source": "purchase", "gen_key": key,
                      "gen_key_active": True, "updated_at": now}},
        )
    elif cust.get("gen_access") and cust.get("gen_access_source") == "purchase":
        # the order that granted access is gone (refunded/cancelled) — revoke
        await db.customers.update_one(
            {"email": email},
            {"$set": {"gen_access": False, "gen_key_active": False, "updated_at": now}},
        )
    if state["entitled"]:
        await _ensure_gen_key(email)


async def _gen_usage_counts(email: str) -> dict:
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    counts = {t: 0 for t in GEN_TYPES}
    resets = {}
    async for doc in db.gen_usage.find({"email": email, "success": True, "ts": {"$gt": since}}):
        t = doc["type"]
        counts[t] = counts.get(t, 0) + 1
        ts = doc["ts"] if doc["ts"].tzinfo else doc["ts"].replace(tzinfo=timezone.utc)
        reset = ts + timedelta(hours=1)
        if t not in resets or reset < resets[t]:
            resets[t] = reset
    return {"counts": counts, "resets": {t: resets[t].isoformat() for t in resets}}


def _buyer_email(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Verification required")
    if payload.get("type") != "buyer_lookup":
        raise HTTPException(401, "Verification required")
    return payload["sub"]


@api_router.get("/portal/me")
async def portal_me(request: Request):
    email = _buyer_email(request)
    orders = await db.orders.find(
        {"email": email, "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for o in orders:
        await _attach_loader_links(o)
        o.pop("download_token", None)
    cust = await _ensure_customer(email)
    await _recompute_entitlements(email)
    cust = await db.customers.find_one({"email": email}, {"_id": 0})
    state = await _entitlement_state(email)
    usage = await _gen_usage_counts(email)
    history = await db.gen_usage.find(
        {"email": email}, {"_id": 0}
    ).sort("ts", -1).to_list(20)
    my_reviews = await db.reviews.find({"email": email}, {"_id": 0}).to_list(100)
    return {
        "email": email,
        "customer_since": cust.get("created_at"),
        "disabled": bool(cust.get("disabled")),
        "orders": orders,
        "generator": {
            "access": bool(cust.get("gen_access")),
            "key": cust.get("gen_key"),
            "key_active": bool(cust.get("gen_key_active")),
            "entitled": state["entitled"],
            "has_standard": state["has_standard"],
            "limits": state["limits"],
            "used": usage["counts"],
            "resets": usage["resets"],
        },
        "gen_history": [
            {"type": h["type"], "ts": h["ts"].isoformat() if hasattr(h["ts"], "isoformat") else h["ts"],
             "success": h.get("success"), "reason": h.get("reason")}
            for h in history
        ],
        "reviews": my_reviews,
    }


class ReviewIn(BaseModel):
    order_id: str
    rating: int
    text: str
    product_id: Optional[str] = None
    name: Optional[str] = None


def _clean_text(s: str, max_len: int) -> str:
    s = re.sub(r"<[^>]+>", "", s or "").strip()
    return s[:max_len]


@api_router.post("/portal/reviews")
async def portal_submit_review(body: ReviewIn, request: Request):
    email = _buyer_email(request)
    if not (1 <= body.rating <= 5):
        raise HTTPException(400, "Rating must be 1-5")
    text = _clean_text(body.text, 1000)
    if len(text) < 3:
        raise HTTPException(400, "Review is too short")
    order = await db.orders.find_one({"id": body.order_id, "email": email, "payment_status": "paid"})
    if not order:
        raise HTTPException(404, "Paid order not found for your email")
    if await db.reviews.find_one({"email": email, "order_id": body.order_id}):
        raise HTTPException(409, "You already reviewed that order")
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.reviews.count_documents({"email": email, "created_at": {"$gt": since.isoformat()}})
    if recent >= 5:
        raise HTTPException(429, "Too many reviews — try again later")
    name = _clean_text(body.name or "", 40) or "Verified Customer"
    product_name = None
    if body.product_id:
        if not any(i.get("product_id") == body.product_id for i in order.get("items", [])):
            raise HTTPException(400, "That product is not on this order")
        p = await db.products.find_one({"id": body.product_id}, {"_id": 0, "name": 1})
        product_name = (p or {}).get("name")
    doc = {
        "id": str(uuid.uuid4()), "email": email, "order_id": body.order_id,
        "product_id": body.product_id, "product_name": product_name,
        "name": name, "rating": int(body.rating), "text": text,
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("email", None)
    return doc


@api_router.get("/reviews")
async def public_reviews(limit: int = 12, product_id: Optional[str] = None):
    q = {"status": "approved"}
    if product_id:
        q["product_id"] = product_id
    docs = await db.reviews.find(
        q, {"_id": 0, "email": 0, "order_id": 0}
    ).sort("created_at", -1).to_list(max(1, min(limit, 50)))
    agg = await db.reviews.aggregate([
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    return {
        "reviews": docs,
        "average": round(agg[0]["avg"], 1) if agg else None,
        "count": agg[0]["count"] if agg else 0,
    }


# ---------- generator API (desktop app: key only, nothing else client-side) ----------

class GenValidateIn(BaseModel):
    key: str


class GenGenerateIn(BaseModel):
    key: str
    type: str
    request_id: str


async def _gen_check_key(key: str) -> dict:
    cust = await db.customers.find_one({"gen_key": key.strip()}, {"_id": 0})
    if not cust:
        raise HTTPException(401, "Invalid key")
    if cust.get("disabled"):
        raise HTTPException(403, "This customer is disabled")
    if not cust.get("gen_key_active"):
        raise HTTPException(403, "This key has been revoked")
    email = cust["email"]
    state = await _entitlement_state(email)
    if not state["entitled"]:
        raise HTTPException(403, "No active Generator entitlement")
    return {"customer": cust, "email": email, "state": state}


@api_router.post("/gen/validate")
async def gen_validate(body: GenValidateIn):
    ctx = await _gen_check_key(body.key)
    usage = await _gen_usage_counts(ctx["email"])
    return {
        "valid": True,
        "limits": ctx["state"]["limits"],
        "used": usage["counts"],
        "resets": usage["resets"],
        "generator_access": ctx["state"]["gen_access"],
    }


@api_router.post("/gen/generate")
async def gen_generate(body: GenGenerateIn):
    if body.type not in GEN_TYPES:
        raise HTTPException(400, f"Unknown type — use one of: {', '.join(GEN_TYPES)}")
    ctx = await _gen_check_key(body.key)
    email = ctx["email"]
    rid = (body.request_id or "").strip()
    if not rid or len(rid) > 80:
        raise HTTPException(400, "request_id required")
    if await db.gen_usage.find_one({"key": body.key.strip(), "request_id": rid}):
        raise HTTPException(409, "Duplicate request_id — replay rejected")
    usage = await _gen_usage_counts(email)
    limit = ctx["state"]["limits"][body.type]
    if usage["counts"][body.type] >= limit:
        await db.gen_usage.insert_one({
            "id": str(uuid.uuid4()), "email": email, "key": body.key.strip(), "type": body.type,
            "request_id": rid, "success": False, "reason": "rate_limited",
            "ts": datetime.now(timezone.utc),
        })
        reset = usage["resets"].get(body.type)
        raise HTTPException(429, f"Hourly {body.type} allowance used up" + (f" — resets at {reset}" if reset else ""))
    settings = await _get_settings_doc()
    pools = settings.get("gen_pools") or {}
    pool_pid = pools.get(body.type)
    if not pool_pid:
        p = await db.products.find_one(
            {"kind": "account", "name": {"$regex": body.type, "$options": "i"}}, {"_id": 0, "id": 1})
        pool_pid = p["id"] if p else None
    if not pool_pid:
        raise HTTPException(503, f"No stock pool configured for {body.type}")
    key_doc = await db.keystock.find_one_and_update(
        {"product_id": pool_pid, "status": "available"},
        {"$set": {"status": "assigned", "assigned_order_id": f"gen-{email}",
                  "assigned_at": datetime.now(timezone.utc).isoformat()}},
        sort=[("created_at", 1)],
    )
    if not key_doc:
        await db.gen_usage.insert_one({
            "id": str(uuid.uuid4()), "email": email, "key": body.key.strip(), "type": body.type,
            "request_id": rid, "success": False, "reason": "out_of_stock",
            "ts": datetime.now(timezone.utc),
        })
        raise HTTPException(409, f"{body.type} accounts are out of stock right now")
    await db.gen_usage.insert_one({
        "id": str(uuid.uuid4()), "email": email, "key": body.key.strip(), "type": body.type,
        "request_id": rid, "success": True, "ts": datetime.now(timezone.utc),
    })
    return {
        "ok": True, "type": body.type,
        "raw": _export_line(key_doc),
        "account": key_doc.get("account") or {"key": key_doc["key"]},
        "remaining": limit - usage["counts"][body.type] - 1,
    }


# ---------- admin: customer & generator management ----------

@api_router.get("/admin/customers/search")
async def admin_search_customers(q: str = "", admin: dict = Depends(get_admin)):
    q = q.strip()
    if len(q) < 2:
        return []
    emails = set()
    async for c in db.customers.find(
        {"$or": [{"email": {"$regex": re.escape(q), "$options": "i"}},
                 {"gen_key": {"$regex": re.escape(q), "$options": "i"}},
                 {"id": q}]},
        {"_id": 0, "email": 1},
    ).limit(20):
        emails.add(c["email"])
    async for o in db.orders.find(
        {"$or": [{"id": q}, {"email": {"$regex": re.escape(q), "$options": "i"}}]},
        {"_id": 0, "email": 1},
    ).limit(20):
        emails.add(o["email"])
    return sorted(emails)


@api_router.get("/admin/customers/{email}/profile")
async def admin_customer_profile(email: str, admin: dict = Depends(get_admin)):
    email = email.lower()
    cust = await db.customers.find_one({"email": email}, {"_id": 0})
    orders = await db.orders.find({"email": email}, {"_id": 0}).sort("created_at", -1).to_list(100)
    state = await _entitlement_state(email)
    usage = await _gen_usage_counts(email)
    history = await db.gen_usage.find({"email": email}, {"_id": 0}).sort("ts", -1).to_list(50)
    audits = await db.audit_log.find({"customer_email": email}, {"_id": 0}).sort("ts", -1).to_list(50)
    reviews = await db.reviews.find({"email": email}, {"_id": 0}).to_list(100)
    settings = await _get_settings_doc()
    return {
        "customer": cust, "orders": orders,
        "generator": {
            "access": bool(cust and cust.get("gen_access")),
            "key": cust.get("gen_key") if cust else None,
            "key_active": bool(cust and cust.get("gen_key_active")),
            "manual": bool(cust and cust.get("gen_access_manual")),
            "source": cust.get("gen_access_source") if cust else None,
            "limits": state["limits"], "used": usage["counts"], "resets": usage["resets"],
        },
        "gen_history": [
            {"type": h["type"], "ts": h["ts"].isoformat() if hasattr(h["ts"], "isoformat") else h["ts"],
             "success": h.get("success"), "reason": h.get("reason")}
            for h in history
        ],
        "audit": audits, "reviews": reviews,
        "gen_pools": settings.get("gen_pools") or {},
        "generator_product_id": await _generator_product_id(settings),
    }


class GenActionIn(BaseModel):
    action: str  # grant | revoke | regenerate_key | reset_usage | disable | enable


@api_router.post("/admin/customers/{email}/generator")
async def admin_generator_action(email: str, body: GenActionIn, admin: dict = Depends(get_admin)):
    email = email.lower()
    cust = await _ensure_customer(email)
    now = datetime.now(timezone.utc).isoformat()
    action = body.action
    if action == "grant":
        key = cust.get("gen_key") or _gen_key()
        await db.customers.update_one({"email": email}, {"$set": {
            "gen_access": True, "gen_access_manual": True, "gen_access_source": "manual",
            "gen_key": key, "gen_key_active": True, "updated_at": now}})
    elif action == "revoke":
        await db.customers.update_one({"email": email}, {"$set": {
            "gen_access": False, "gen_access_manual": False, "gen_key_active": False, "updated_at": now}})
    elif action == "regenerate_key":
        key = _gen_key()
        while await db.customers.find_one({"gen_key": key}):
            key = _gen_key()
        await db.customers.update_one({"email": email}, {"$set": {
            "gen_key": key, "gen_key_active": True, "gen_access": True, "updated_at": now}})
    elif action == "reset_usage":
        await db.gen_usage.delete_many({"email": email})
    elif action == "disable":
        await db.customers.update_one({"email": email}, {"$set": {"disabled": True, "updated_at": now}})
    elif action == "enable":
        await db.customers.update_one({"email": email}, {"$set": {"disabled": False, "updated_at": now}})
    else:
        raise HTTPException(400, "Unknown action")
    await _audit(admin, f"generator:{action}", email)
    return {"ok": True, "action": action}


class ImportGenIn(BaseModel):
    email: EmailStr


@api_router.post("/admin/customers/import-generator")
async def admin_import_generator_customer(body: ImportGenIn, admin: dict = Depends(get_admin)):
    email = body.email.lower()
    await _ensure_customer(email)
    key = _gen_key()
    while await db.customers.find_one({"gen_key": key}):
        key = _gen_key()
    await db.customers.update_one({"email": email}, {"$set": {
        "gen_access": True, "gen_access_manual": True, "gen_access_source": "manual",
        "gen_key": key, "gen_key_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()}})
    await _audit(admin, "generator:import", email, "existing Generator customer migrated")
    return {"email": email, "key": key}


@api_router.get("/admin/audit-log")
async def admin_audit_log(limit: int = 50, admin: dict = Depends(get_admin)):
    return await db.audit_log.find({}, {"_id": 0}).sort("ts", -1).to_list(max(1, min(limit, 200)))


# ---------- admin: reviews moderation ----------

@api_router.get("/admin/reviews")
async def admin_reviews(status: Optional[str] = None, product_id: Optional[str] = None,
                        admin: dict = Depends(get_admin)):
    q = {}
    if status in ("pending", "approved", "hidden"):
        q["status"] = status
    if product_id:
        q["product_id"] = product_id
    return await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


class ReviewActionIn(BaseModel):
    action: str  # approve | hide


@api_router.post("/admin/reviews/{review_id}/action")
async def admin_review_action(review_id: str, body: ReviewActionIn, admin: dict = Depends(get_admin)):
    if body.action not in ("approve", "hide"):
        raise HTTPException(400, "Unknown action")
    res = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"status": "approved" if body.action == "approve" else "hidden"}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Review not found")
    return {"ok": True}


@api_router.delete("/admin/reviews/{review_id}")
async def admin_review_delete(review_id: str, admin: dict = Depends(get_admin)):
    res = await db.reviews.delete_one({"id": review_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Review not found")
    return {"deleted": True}


@api_router.post("/admin/orders/{order_id}/refund")
async def admin_refund_order(order_id: str, admin: dict = Depends(get_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") != "paid":
        raise HTTPException(400, "Only paid orders can be refunded")
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_status": "refunded", "status": "refunded", "updated_at": now}},
    )
    await _recompute_entitlements(order["email"])
    await _audit(admin, "order:refund", order["email"], order_id)
    await _discord_alert(
        "payments", "Order refunded", f"Order `{order_id[:8]}` refunded — entitlements revoked.",
        fields=_order_fields(order), color=0xEF4444,
    )
    return {"refunded": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

import os, sys
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
load_dotenv(os.path.join(_HERE, ".env"))

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid, logging, secrets, string
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import stripe

from email_utils import send_order_email, send_waitlist_email, send_low_stock_email

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


class CheckoutIn(BaseModel):
    email: EmailStr
    items: List[CartItemIn]
    origin_url: str


class LookupIn(BaseModel):
    email: EmailStr


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
    },
    {
        "game": "Rust", "name": "RECOIL ZERO // Rust Suite",
        "description": "Full Rust suite with perfect recoil control, player ESP and raid radar. Built for official servers.",
        "image_url": "https://images.unsplash.com/photo-1622023346627-b7d48c4484a9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBnYW1lJTIwY2hhcmFjdGVyJTIwZGFyayUyMGdsb3dpbmclMjBibHVlJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MTR8MA&ixlib=rb-4.1.0&q=85",
        "status": "updating", "anticheat": "Easy Anti-Cheat",
        "features": ["No Recoil", "Player ESP", "Ore ESP", "Raid Radar", "Silent Aim"],
        "prices": {"day": 5.99, "week": 17.99, "month": 34.99},
        "active": True, "sort_order": 3,
    },
    {
        "game": "COD Warzone", "name": "NIGHTHAWK // Warzone",
        "description": "Aimbot, wallhack and unlock tools for Warzone. Shadow-ban evasion layer included.",
        "image_url": "https://images.unsplash.com/photo-1746365588568-3513fdefde2e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxjeWJlcnB1bmslMjBnYW1lJTIwY2hhcmFjdGVyJTIwZGFyayUyMGdsb3dpbmclMjBibHVlJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MTR8MA&ixlib=rb-4.1.0&q=85",
        "status": "undetected", "anticheat": "Ricochet",
        "features": ["Aimbot", "Wallhack", "Unlock All", "Anti-Shadowban", "Radar"],
        "prices": {"day": 5.49, "week": 16.99, "month": 32.99},
        "active": True, "sort_order": 4,
    },
    {
        "game": "Valorant", "name": "SIGHTLINE // Valo Radar",
        "description": "External radar and trigger assist for Valorant. Zero injection, reads memory externally.",
        "image_url": "https://images.unsplash.com/photo-1745402152421-7257dcfd2d19?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwzfHxjeWJlcnB1bmslMjBnYW1lJTIwY2hhcmFjdGVyJTIwZGFyayUyMGdsb3dpbmclMjBibHVlJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MTR8MA&ixlib=rb-4.1.0&q=85",
        "status": "testing", "anticheat": "Vanguard",
        "features": ["2D Radar", "Trigger Assist", "External Only", "Stream Proof"],
        "prices": {"week": 21.99, "month": 44.99},
        "active": True, "sort_order": 5,
    },
    {
        "game": "Apex Legends", "name": "PREDATOR // Apex Aim",
        "description": "Precision aim assist and ESP for Apex Legends. Humanized smoothing for legit play.",
        "image_url": "https://images.unsplash.com/photo-1746109971434-ca67785ce0d2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHw0fHxjeWJlcnB1bmslMjBnYW1lJTIwY2hhcmFjdGVyJTIwZGFyayUyMGdsb3dpbmclMjBibHVlJTIwY3lhbnxlbnwwfHx8fDE3ODgyNjA1MTR8MA&ixlib=rb-4.1.0&q=85",
        "status": "undetected", "anticheat": "Easy Anti-Cheat",
        "features": ["Aim Assist", "ESP", "Item Glow", "Humanized Smoothing"],
        "prices": {"day": 4.99, "week": 15.99, "month": 29.99},
        "active": True, "sort_order": 6,
    },
    {
        "game": "Universal", "name": "GHOST // HWID Spoofer",
        "description": "Universal HWID spoofer. Unban your machine on any anti-cheat in one click. Works with every VOIDWARE product.",
        "image_url": "https://images.unsplash.com/photo-1759692788195-b95da1f4a04c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHw0fHxnYW1pbmclMjBwb3N0ZXIlMjBkYXJrJTIwYWN0aW9uJTIwZ2FtZXIlMjBjb250cm9sbGVyJTIwbmVvbnxlbnwwfHx8fDE3ODgyNjA1MjF8MA&ixlib=rb-4.1.0&q=85",
        "status": "undetected", "anticheat": "EAC / BE / Vanguard / Ricochet",
        "features": ["One-Click Spoof", "Permanent & Temp Modes", "Cleaner Included", "All AC Support"],
        "prices": {"week": 12.99, "month": 24.99, "lifetime": 59.99},
        "active": True, "sort_order": 7,
    },
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
    await seed_admin()
    await seed_products()


# ---------- public ----------

@api_router.get("/")
async def root():
    return {"message": "Desync API online"}


@api_router.get("/products")
async def list_products():
    docs = await db.products.find({"active": True}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return docs


@api_router.get("/status")
async def status_matrix():
    docs = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "game": 1, "status": 1, "anticheat": 1, "updated_at": 1}).sort("sort_order", 1).to_list(200)
    return docs


@api_router.post("/orders/lookup")
async def order_lookup(body: LookupIn):
    email = body.email.lower()
    docs = await db.orders.find(
        {"email": email, "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
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
    doc.update({"id": str(uuid.uuid4()), "created_at": now, "updated_at": now})
    await db.products.insert_one(doc)
    return product_out(doc)


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductIn, admin: dict = Depends(get_admin)):
    if body.status not in STATUSES:
        raise HTTPException(400, "Invalid status")
    doc = body.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
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


# ---------- admin: orders ----------

@api_router.get("/admin/orders")
async def admin_orders(admin: dict = Depends(get_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/waitlist")
async def admin_waitlist(admin: dict = Depends(get_admin)):
    return await db.waitlist.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ---------- admin: key stock ----------

class KeyStockIn(BaseModel):
    product_id: str
    duration: str = "day"
    keys: str


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
    seen = set()
    added, skipped = 0, 0
    now = datetime.now(timezone.utc).isoformat()
    for key in lines:
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        exists = await db.keystock.find_one({"product_id": body.product_id, "duration": body.duration, "key": key})
        if exists:
            skipped += 1
            continue
        await db.keystock.insert_one({
            "id": str(uuid.uuid4()), "product_id": body.product_id, "duration": body.duration,
            "key": key, "status": "available", "assigned_order_id": None, "assigned_at": None,
            "created_at": now,
        })
        added += 1
    return {"added": added, "skipped": skipped}


@api_router.delete("/admin/keystock/{key_id}")
async def keystock_delete(key_id: str, admin: dict = Depends(get_admin)):
    res = await db.keystock.delete_one({"id": key_id, "status": "available"})
    if res.deleted_count == 0:
        raise HTTPException(400, "Key not found or already assigned")
    return {"deleted": True}


# ---------- admin: settings ----------

class SettingsIn(BaseModel):
    notify_email: Optional[EmailStr] = None
    drop_date: Optional[str] = None
    drop_teaser: Optional[str] = None
    checklist: Optional[dict] = None


@api_router.get("/admin/settings")
async def get_settings(admin: dict = Depends(get_admin)):
    doc = await db.settings.find_one({"id": "main"}, {"_id": 0})
    return doc or {"id": "main", "notify_email": None}


@api_router.put("/admin/settings")
async def put_settings(body: SettingsIn, admin: dict = Depends(get_admin)):
    updates = body.model_dump(exclude_none=True)
    if "drop_date" in updates and updates["drop_date"] == "":
        updates.pop("drop_date")
    await db.settings.update_one(
        {"id": "main"},
        {"$set": {"id": "main", **updates}},
        upsert=True,
    )
    return await db.settings.find_one({"id": "main"}, {"_id": 0})


# ---------- public: drop config ----------

@api_router.get("/drop-config")
async def drop_config():
    doc = await db.settings.find_one({"id": "main"}, {"_id": 0, "drop_date": 1, "drop_teaser": 1})
    doc = doc or {}
    return {"drop_date": doc.get("drop_date"), "drop_teaser": doc.get("drop_teaser")}


# ---------- admin: stats & key assignment ----------

@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin)):
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "sold": {"$sum": 1}, "revenue": {"$sum": "$items.unit_price"}}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(500)
    by_product = {r["_id"]: {"sold": r["sold"], "revenue": round(r["revenue"], 2)} for r in rows}
    paid = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "total": 1}).to_list(10000)
    return {
        "total_revenue": round(sum(o.get("total", 0) for o in paid), 2),
        "total_orders": len(paid),
        "keys_sold": sum(v["sold"] for v in by_product.values()),
        "waitlist": await db.waitlist.count_documents({}),
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
        if item.get("key_pending") or not item.get("license_key"):
            key_doc = await db.keystock.find_one_and_update(
                {"product_id": item["product_id"], "duration": item["duration"], "status": "available"},
                {"$set": {
                    "status": "assigned",
                    "assigned_order_id": order["id"],
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }},
                sort=[("created_at", 1)],
            )
            if key_doc:
                item["license_key"] = key_doc["key"]
                item["key_pending"] = False
                assigned += 1
            else:
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

async def fulfill_order(session_id: str) -> Optional[dict]:
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if not order or order.get("payment_status") == "paid":
        return order
    items = order["items"]
    keys_pending = False
    for item in items:
        if not item.get("license_key"):
            key_doc = await db.keystock.find_one_and_update(
                {"product_id": item["product_id"], "duration": item["duration"], "status": "available"},
                {"$set": {
                    "status": "assigned",
                    "assigned_order_id": order["id"],
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }},
                sort=[("created_at", 1)],
            )
            if key_doc:
                item["license_key"] = key_doc["key"]
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
            else:
                item["key_pending"] = True
                keys_pending = True
    res = await db.orders.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {
            "status": "completed", "payment_status": "paid", "items": items,
            "keys_pending": keys_pending,
            "paid_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    updated = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if res.modified_count > 0 and updated:
        try:
            await send_order_email(updated)
            await db.orders.update_one({"id": updated["id"]}, {"$set": {"email_sent": True}})
        except Exception as e:
            logger.error("Order email failed for %s: %s", updated.get("id"), e)
    return updated


@api_router.post("/payments/checkout")
async def create_checkout(body: CheckoutIn):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    email = body.email.lower()
    line_items = []
    order_items = []
    total_cents = 0
    for item in body.items:
        if item.duration not in DURATIONS:
            raise HTTPException(400, f"Invalid duration: {item.duration}")
        product = await db.products.find_one({"id": item.product_id, "active": True}, {"_id": 0})
        if not product:
            raise HTTPException(404, "Product not found")
        price = product.get("prices", {}).get(item.duration)
        if price is None:
            raise HTTPException(400, f"Duration not available for {product['name']}")
        unit_cents = int(round(float(price) * 100))
        total_cents += unit_cents
        label = DURATIONS[item.duration]
        line_items.append({
            "price_data": {
                "currency": "eur",
                "unit_amount": unit_cents,
                "product_data": {"name": f"{product['name']} — {label}", "tax_code": "txcd_10000000"},
            },
            "quantity": 1,
        })
        order_items.append({
            "product_id": product["id"], "name": product["name"], "game": product["game"],
            "duration": item.duration, "duration_label": label,
            "unit_price": float(price), "license_key": None,
        })

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
    await db.orders.insert_one({
        "id": order_id, "session_id": session.id, "email": email,
        "items": order_items, "total": total_cents / 100.0, "currency": "eur",
        "status": "initiated", "payment_status": "pending",
        "created_at": now, "updated_at": now,
    })
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

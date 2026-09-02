import os, sys
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
load_dotenv(os.path.join(_HERE, ".env"))

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import time, uuid, logging, secrets, string
from datetime import datetime, timezone, timedelta
import httpx

import bcrypt
import jwt
import stripe

from email_utils import send_order_email, send_waitlist_email, send_low_stock_email, send_announce_email

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
    coupon: Optional[str] = None
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
    return docs


# ---------- categories ----------

class CategoryIn(BaseModel):
    name: str
    sort_order: int = 0


@api_router.get("/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)


@api_router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, admin: dict = Depends(get_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    if await db.categories.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}}):
        raise HTTPException(409, "Category already exists")
    doc = {
        "id": str(uuid.uuid4()), "name": name, "sort_order": body.sort_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


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


# ---------- coupons ----------

class CouponIn(BaseModel):
    code: str
    percent: float
    max_uses: Optional[int] = None
    active: bool = True


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
    return {"code": c["code"], "percent": c["percent"]}


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
    doc = {
        "id": str(uuid.uuid4()), "code": code, "percent": float(body.percent),
        "max_uses": body.max_uses, "active": body.active, "used_count": 0,
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
            await send_order_email(updated)
            await db.orders.update_one({"id": updated["id"]}, {"$set": {"email_sent": True}})
        except Exception as e:
            logger.error("Order email failed for %s: %s", updated.get("id"), e)
    return updated


async def fulfill_order(session_id: str) -> Optional[dict]:
    return await _fulfill_order({"session_id": session_id})


async def _price_cart(items: List[CartItemIn], coupon: Optional[str]):
    discount_pct = 0.0
    coupon_code = None
    if coupon:
        c = await _find_valid_coupon(coupon)
        if not c:
            raise HTTPException(400, "Invalid or expired coupon code")
        discount_pct = float(c["percent"])
        coupon_code = c["code"]
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
        in_stock = await db.keystock.count_documents(
            {"product_id": product["id"], "duration": item.duration, "status": "available"}
        )
        if in_stock == 0:
            raise HTTPException(400, f"{product['name']} ({DURATIONS[item.duration]}) is sold out")
        unit_cents = int(round(float(price) * 100 * (1 - discount_pct / 100)))
        subtotal_cents += int(round(float(price) * 100))
        total_cents += unit_cents
        order_items.append({
            "product_id": product["id"], "name": product["name"], "game": product["game"],
            "duration": item.duration, "duration_label": DURATIONS[item.duration],
            "unit_price": unit_cents / 100.0, "license_key": None,
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
                "currency": "eur",
                "unit_amount": int(round(it["unit_price"] * 100)),
                "product_data": {"name": f"{it['name']} — {it['duration_label']}", "tax_code": "txcd_10000000"},
            },
            "quantity": 1,
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
    await db.orders.insert_one({
        "id": order_id, "session_id": session.id, "email": email,
        "items": order_items, "total": total_cents / 100.0, "currency": "eur",
        "subtotal": subtotal_cents / 100.0, "discount_percent": discount_pct,
        "coupon_code": coupon_code,
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
            "amount": {"currency_code": "EUR", "value": f"{total_cents / 100:.2f}"},
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
        "items": order_items, "total": total_cents / 100.0, "currency": "eur",
        "subtotal": subtotal_cents / 100.0, "discount_percent": discount_pct,
        "coupon_code": coupon_code,
        "status": "initiated", "payment_status": "pending",
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


@api_router.get("/orders/by-id/{order_id}")
async def order_by_id(order_id: str):
    order = await db.orders.find_one({"id": order_id, "payment_status": "paid"}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order


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

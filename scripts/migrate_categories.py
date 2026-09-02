"""One-time migration: keep only FiveM products, seed FiveM category, swap coupons to DESYNC10."""
import os, sys, uuid, asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", "backend", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # 1. delete all non-FiveM products
    res = await db.products.delete_many({"game": {"$ne": "FiveM"}})
    print(f"deleted {res.deleted_count} non-FiveM products")
    remaining = await db.products.count_documents({})
    print(f"products remaining: {remaining}")

    # 2. ensure FiveM category exists
    if not await db.categories.find_one({"name": "FiveM"}):
        await db.categories.insert_one({
            "id": str(uuid.uuid4()), "name": "FiveM", "sort_order": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print("created category: FiveM")
    else:
        print("category FiveM already exists")

    # 3. replace all coupons with DESYNC10 (10% sitewide)
    res = await db.coupons.delete_many({})
    print(f"deleted {res.deleted_count} old coupons")
    await db.coupons.insert_one({
        "id": str(uuid.uuid4()), "code": "DESYNC10", "percent": 10.0,
        "max_uses": None, "active": True, "used_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    print("created coupon DESYNC10 (10% off)")

    client.close()

asyncio.run(main())

# Auth Testing Playbook (VOIDWARE admin auth)

Custom username/password JWT auth for admins only (buyers are guests, no accounts).

## Step 1: MongoDB verification
```
mongosh
use test_database
db.admins.find({}).pretty()
```
Verify: password_hash starts with `$2b$`, unique index on admins.username, owner admin `voidowner` exists.

## Step 2: API testing
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d '{"username":"voidowner","password":"VoidGhost!26"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s "$API/api/admin/products" -H "Authorization: Bearer $TOKEN"
```
Login returns {token, admin}. /auth/me returns the admin object. Wrong password must return 401.

## Step 3: Owner-only routes
GET/POST/DELETE /api/admin/users require role=owner.

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import products_collection, categories_collection, users_collection
from bson import ObjectId
from bson.errors import InvalidId as ObjectIdError
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid
from contextlib import asynccontextmanager
from kafka_producer import (
    publish, create_topics, flush,
    TOPIC_CLICKS, TOPIC_CART, TOPIC_ORDERS
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Blinkit API...")
    create_topics()   # creates Kafka topics if they don't exist
    yield
    print("🛑 Shutting down...")
    flush()           # send any remaining Kafka messages

app = FastAPI(lifespan=lifespan)

# Allow React Native to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Helper ───────────────────────────────────────────────────────────────────

def serialize(doc) -> dict:
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc

def serialize_user(doc) -> dict:
    """
    Same as serialize but also cleans nested ObjectIds if any,
    and never returns sensitive internal fields.
    """
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc

# ─── Products ─────────────────────────────────────────────────────────────────

@app.get("/products")
async def get_products():
    products = []
    async for doc in products_collection.find({"in_stock": True}):
        products.append(serialize(doc))
    return products

@app.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await products_collection.find_one({"_id": ObjectId(product_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return serialize(doc)

@app.get("/products/category/{category_id}")
async def get_products_by_category(category_id: str):
    products = []
    async for doc in products_collection.find({"category_id": category_id}):
        products.append(serialize(doc))
    return products

@app.get("/products/search/{query}")
async def search_products(query: str):
    products = []
    async for doc in products_collection.find({
        "$or": [
            {"name": {"$regex": query, "$options": "i"}},
            {"brand": {"$regex": query, "$options": "i"}},
            {"tags": {"$regex": query, "$options": "i"}},
        ]
    }):
        products.append(serialize(doc))
    return products

# ─── Categories ───────────────────────────────────────────────────────────────

@app.get("/categories")
async def get_categories():
    categories = []
    async for doc in categories_collection.find().sort("order", 1):
        categories.append(serialize(doc))
    return categories

# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "message": "Blinkit API running"}


# ══════════════════════════════════════════════════════════════════════════════
# KAFKA EVENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ─── Models ───────────────────────────────────────────────────────────────────

class CartItemModel(BaseModel):
    product_id: str
    product_name: str
    qty: int
    price: float
    
class ClickEventRequest(BaseModel):
    user_id:      str
    session_id:   str
    product_id:   str
    product_name: str
    category_id:  Optional[str] = ""
    price:        float
    lat:          Optional[float] = 0.0
    lon:          Optional[float] = 0.0

class CartEventRequest(BaseModel):
    user_id:      str
    session_id:   str
    product_id:   str
    product_name: str
    price:        float
    qty:          int
    action:       str        # "add" or "remove"
    lat:          Optional[float] = 0.0
    lon:          Optional[float] = 0.0

class OrderEventRequest(BaseModel):
    user_id:       str
    session_id:    str
    order_id:      str
    items:         List[CartItemModel]
    total_amount:  float
    address_id:    str
    lat:           Optional[float] = 0.0
    lon:           Optional[float] = 0.0


# ─── Click event ──────────────────────────────────────────────────────────────

@app.post("/events/click")
async def track_click(req: ClickEventRequest):
    """
    Fired every time user taps a product card.
    Spark uses this for:
      - Click frequency → discount notification (5 clicks in 30 mins)
      - Geo trending    → area trending notification
    """
    event = {
        "event_type":   "product_click",
        "user_id":      req.user_id,
        "session_id":   req.session_id,
        "product_id":   req.product_id,
        "product_name": req.product_name,
        "category_id":  req.category_id or "",
        "price":        req.price,
        "lat":          req.lat or 0.0,
        "lon":          req.lon or 0.0,
        "area_bucket":  f"{round(req.lat or 0, 2)}_{round(req.lon or 0, 2)}",
        "timestamp":    datetime.utcnow().isoformat(),
    }

    ok = publish(TOPIC_CLICKS, event)

    print(f"🖱️  CLICK | {req.product_name} | user:{req.user_id[:8]} | kafka:{ok}")

    return {"success": True, "kafka_sent": ok}

# ─── Cart event ───────────────────────────────────────────────────────────────

@app.post("/events/cart")
async def track_cart(req: CartEventRequest):
    """
    Fired on every add/remove from cart.
    Spark uses this for:
      - Abandoned cart detection (add with no purchase in 24h)
    action: "add" or "remove"
    """
    event = {
        "event_type":   "cart_event",
        "user_id":      req.user_id,
        "session_id":   req.session_id,
        "product_id":   req.product_id,
        "product_name": req.product_name,
        "price":        req.price,
        "qty":          req.qty,
        "action":       req.action,
        "lat":          req.lat or 0.0,
        "lon":          req.lon or 0.0,
        "area_bucket":  f"{round(req.lat or 0, 2)}_{round(req.lon or 0, 2)}",
        "timestamp":    datetime.utcnow().isoformat(),
    }

    ok = publish(TOPIC_CART, event)

    print(f"🛒  CART  | {req.action.upper()} | {req.product_name} | qty:{req.qty} | user:{req.user_id[:8]} | kafka:{ok}")

    return {"success": True, "kafka_sent": ok}

# ─── Order event ──────────────────────────────────────────────────────────────

@app.post("/events/order")
async def track_order(req: OrderEventRequest):
    """
    Fired when order is successfully placed.
    Spark uses this to:
      - Close the abandoned cart loop (order placed = not abandoned)
      - Detect repurchase patterns
    """
    event = {
        "event_type":    "order_placed",
        "user_id":       req.user_id,
        "session_id":    req.session_id,
        "order_id":      req.order_id,
        "total_amount":  req.total_amount,
        "total_items":   sum(i.qty for i in req.items),
        "product_ids":   [i.product_id for i in req.items],
        "product_names": [i.product_name for i in req.items],
        "lat":           req.lat or 0.0,
        "lon":           req.lon or 0.0,
        "area_bucket":   f"{round(req.lat or 0, 2)}_{round(req.lon or 0, 2)}",
        "timestamp":     datetime.utcnow().isoformat(),
    }

    ok = publish(TOPIC_ORDERS, event)

    print(f"📦  ORDER | id:{req.order_id[:8]} | ₹{req.total_amount} | user:{req.user_id[:8]} | kafka:{ok}")

    return {"success": True, "kafka_sent": ok, "order_id": req.order_id}
# ══════════════════════════════════════════════════════════════════════════════
# USER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ─── Pydantic Models (Request bodies) ─────────────────────────────────────────

class GeoLocation(BaseModel):
    latitude: float
    longitude: float

class AddressModel(BaseModel):
    label: str                        # "Home" | "Work" | "Other"
    full: str                         # "42, Anna Nagar, Coimbatore – 641001"
    icon: Optional[str] = None        # "🏠" auto-set from label if not given
    city: Optional[str] = None        # "Coimbatore" — for area trending in Spark
    area: Optional[str] = None        # "Anna Nagar"
    location: Optional[GeoLocation] = None  # lat/lng for geo queries

class LoginRequest(BaseModel):
    phone: str                        # "9876543210"
    expo_push_token: Optional[str] = None  # for push notifications later

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class SelectAddressRequest(BaseModel):
    address_id: str



class CartSyncRequest(BaseModel):
    items: List[CartItemModel]

class CheckoutRequest(BaseModel):
    items: List[CartItemModel]
    total_amount: float
    address_id: str

class PushTokenRequest(BaseModel):
    token: str


# ─── Helper: label → icon ─────────────────────────────────────────────────────

def label_to_icon(label: str) -> str:
    mapping = {"home": "🏠", "work": "🏢"}
    return mapping.get(label.lower(), "📍")

# ─── Helper: build user response (what frontend AuthContext expects) ───────────

def user_response(doc: dict) -> dict:
    """
    Converts MongoDB user document to the shape AuthContext expects:
    { id, phone, name, email, addresses, selectedAddressId }
    """
    return {
        "id":                str(doc["_id"]),
        "phone":             doc.get("phone", ""),
        "name":              doc.get("name", ""),
        "email":             doc.get("email", ""),
        "addresses":         doc.get("addresses", []),
        "selectedAddressId": doc.get("selected_address_id", ""),
        "isNewUser":         doc.get("is_new_user", False),
        "cart":              doc.get("cart", []),          # ← THIS WAS MISSING
        "purchases":         doc.get("purchases", []), 
    }

# ─── POST /users/login ────────────────────────────────────────────────────────
"""
Called after OTP verified in login.tsx.
Auto-registers if phone not found (login = register in OTP flow).
Returns full user object that AuthContext stores as `user` state.
"""

@app.post("/users/login")
async def login(req: LoginRequest):
    existing = await users_collection.find_one({"phone": req.phone})

    if existing:
        # Existing user — update push token if provided (changes after reinstall)
        update_fields = {"updated_at": datetime.utcnow()}
        if req.expo_push_token:
            update_fields["expo_push_token"] = req.expo_push_token

        await users_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields}
        )
        existing.update(update_fields)
        existing["is_new_user"] = False
        return user_response(existing)

    else:
        # New user — create minimal document
        new_user = {
            "phone":               req.phone,
            "name":                "",
            "email":               "",
            "expo_push_token":     req.expo_push_token or "",
            "addresses":           [],
            "selected_address_id": "",
            "cart":                [],
            "purchases":           [],
            "created_at":          datetime.utcnow(),
            "updated_at":          datetime.utcnow(),
            "is_new_user":         True,
        }
        result = await users_collection.insert_one(new_user)
        new_user["_id"] = result.inserted_id
        return user_response(new_user)


# ─── GET /users/{user_id} ────────────────────────────────────────────────────
"""
Fetch user on app resume.
Frontend can call this on startup if it has stored user_id locally.
"""

@app.get("/users/{user_id}")
async def get_user(user_id: str):
    doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return user_response(doc)


# ─── PATCH /users/{user_id}/profile ──────────────────────────────────────────
"""
Called from AccountScreen when user edits name or email.
Only updates fields that are sent (non-null).
"""

@app.patch("/users/{user_id}/profile")
async def update_profile(user_id: str, req: UpdateProfileRequest):
    update_fields = {"updated_at": datetime.utcnow()}

    if req.name is not None:
        update_fields["name"] = req.name.strip()
    if req.email is not None:
        update_fields["email"] = req.email.strip().lower()

    result = await users_collection.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields},
        return_document=True          # returns updated doc
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return user_response(result)


# ─── POST /users/{user_id}/addresses ─────────────────────────────────────────
"""
Called from address.tsx when user saves a new address.
Stores display text + city/area for Spark trending + lat/lng for geo queries.
"""

@app.post("/users/{user_id}/addresses")
async def add_address(user_id: str, req: AddressModel):
    new_addr = {
        "id":    str(uuid.uuid4()),
        "label": req.label,
        "full":  req.full,
        "icon":  req.icon or label_to_icon(req.label),
        "city":  req.city or "",
        "area":  req.area or "",
    }

    # Store GeoJSON only if coordinates provided
    if req.location:
        new_addr["location"] = {
            "type": "Point",
            # MongoDB expects [longitude, latitude] order
            "coordinates": [req.location.longitude, req.location.latitude]
        }

    result = await users_collection.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {
            "$push":    {"addresses": new_addr},
            "$set":     {"updated_at": datetime.utcnow()}
        },
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return user_response(result)


# ─── PATCH /users/{user_id}/addresses/select ─────────────────────────────────
"""
Called from address.tsx when user taps "Deliver Here".
Sets which address is shown in the home screen header.
"""

@app.patch("/users/{user_id}/addresses/select")
async def select_address(user_id: str, req: SelectAddressRequest):
    doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Make sure this address_id actually belongs to this user
    addr_ids = [a["id"] for a in doc.get("addresses", [])]
    if req.address_id not in addr_ids:
        raise HTTPException(status_code=400, detail="Address not found for this user")

    result = await users_collection.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "selected_address_id": req.address_id,
            "updated_at":          datetime.utcnow()
        }},
        return_document=True
    )
    return user_response(result)


# ─── DELETE /users/{user_id}/addresses/{address_id} ──────────────────────────

@app.delete("/users/{user_id}/addresses/{address_id}")
async def delete_address(user_id: str, address_id: str):
    doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    update = {
        "$pull": {"addresses": {"id": address_id}},
        "$set":  {"updated_at": datetime.utcnow()}
    }

    # If deleted address was the selected one, clear selection
    if doc.get("selected_address_id") == address_id:
        update["$set"]["selected_address_id"] = ""

    result = await users_collection.find_one_and_update(
        {"_id": ObjectId(user_id)},
        update,
        return_document=True
    )
    return user_response(result)


# ─── POST /users/{user_id}/cart/sync ─────────────────────────────────────────
"""
Called whenever cart changes in frontend CartContext.
Persists the full cart to MongoDB.
This is what Spark reads to detect cart abandonment (items in cart > 1 day without purchase).
"""

@app.post("/users/{user_id}/cart/sync")
async def sync_cart(user_id: str, req: CartSyncRequest):
    try:
        print(f"\n📦 SYNC CART REQUEST:")
        print(f"   User ID: {user_id}")
        print(f"   Items: {len(req.items)}")
        for i, item in enumerate(req.items):
            print(f"     {i+1}. {item.product_name} (qty: {item.qty})")
        
        cart_items = [
            {
                "product_id":   item.product_id,
                "product_name": item.product_name,
                "qty":          item.qty,
                "price":        item.price,
                "added_at":     datetime.utcnow().isoformat(),
            }
            for item in req.items
        ]

        print(f"   Updating MongoDB for user: {user_id}")
        result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "cart":       cart_items,
                "updated_at": datetime.utcnow()
            }}
        )
        
        print(f"   MongoDB Response:")
        print(f"     - Matched: {result.matched_count}")
        print(f"     - Modified: {result.modified_count}")
        
        if result.matched_count == 0:
            print(f"   ❌ User not found!")
            raise HTTPException(status_code=404, detail="User not found")
        
        if result.modified_count == 0:
            print(f"   ⚠️  User found but nothing was modified")
        
        print(f"   ✅ Cart synced successfully!")
        return {"success": True, "message": "Cart synced", "items_synced": len(req.items)}
        
    except ObjectIdError as e:
        print(f"   ❌ Invalid user ID format: {user_id}")
        print(f"      Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid user ID format: {str(e)}")
    except Exception as e:
        print(f"   ❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error syncing cart: {str(e)}")


# ─── POST /users/{user_id}/checkout ──────────────────────────────────────────
"""
Called when user taps "Proceed to Checkout".
1. Appends each cart item to purchases[] with timestamp + order_id
2. Clears cart
3. Returns updated user

purchases[] is what Spark uses for:
  - "You bought X last week, running low?" notifications
  - Repurchase frequency analysis
"""

@app.post("/users/{user_id}/checkout")
async def checkout(user_id: str, req: CheckoutRequest):
    order_id    = str(uuid.uuid4())
    purchased_at = datetime.utcnow()

    purchased_items = [
        {
            "product_id":   item.product_id,
            "product_name": item.product_name,
            "qty":          item.qty,
            "price":        item.price,
            "purchased_at": purchased_at.isoformat(),
            "order_id":     order_id,
        }
        for item in req.items
    ]

    result = await users_collection.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {
            "$push": {"purchases": {"$each": purchased_items}},
            "$set":  {"cart": [], "updated_at": purchased_at}
        },
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        **user_response(result),
        "order_id": order_id,
    }


# ─── GET /users/{user_id}/purchases ──────────────────────────────────────────
"""
Called from "My Orders" tab.
Returns purchase history sorted newest first.
"""

@app.get("/users/{user_id}/purchases")
async def get_purchases(user_id: str):
    doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    purchases = doc.get("purchases", [])
    # Sort newest first
    purchases.sort(key=lambda x: x.get("purchased_at", ""), reverse=True)
    return purchases


# ─── PATCH /users/{user_id}/push-token ───────────────────────────────────────
"""
Called after expo-notifications permission granted on the device.
Token is required for Kafka → Spark → Notification pipeline.
"""

@app.patch("/users/{user_id}/push-token")
async def update_push_token(user_id: str, req: PushTokenRequest):
    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "expo_push_token": req.token,
            "updated_at":      datetime.utcnow()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "Push token updated"}
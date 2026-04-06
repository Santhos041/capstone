# ✅ Code Verification Checklist

## Overview

This document lists EXACTLY what code should be where. Use this to verify your implementation is complete.

---

## FILE 1: `frontend/services/api.ts`

**Purpose**: API client that calls backend endpoints

### Required Functions (Should already exist)

✓ Line ~100: `syncCart()` function

```typescript
export const syncCart = async (
  userId: string,
  items: {
    product_id: string;
    product_name: string;
    qty: number;
    price: number;
  }[],
) => {
  const res = await api.post(`/users/${userId}/cart/sync`, { items });
  return res.data;
};
```

✓ Line ~115: `checkout()` function

```typescript
export const checkout = async (
  userId: string,
  items: {
    product_id: string;
    product_name: string;
    qty: number;
    price: number;
  }[],
  totalAmount: number,
  addressId: string,
) => {
  const res = await api.post(`/users/${userId}/checkout`, {
    items,
    total_amount: totalAmount,
    address_id: addressId,
  });
  return res.data;
};
```

**Location to verify**:

- Open `frontend/services/api.ts`
- Search for `export const syncCart`
- Search for `export const checkout`
- Both should exist with exactly this signature

---

## FILE 2: `frontend/context/AuthContext.tsx`

**Purpose**: Manages user authentication and loads cart from DB

### Required Code

✓ Line ~26: User type includes `cart` field

```typescript
export type User = {
  id: string;
  phone: string;
  name: string;
  email: string;
  addresses: Address[];
  selectedAddressId: string;
  cart: any[]; // ← MUST HAVE THIS
  purchases: any[];
};
```

✓ Line ~62: `restoreSession()` calls `getUser()`

```typescript
const restoreSession = async () => {
  try {
    const storedId = await AsyncStorage.getItem("userId");
    if (storedId) {
      const freshUser = await getUser(storedId); // ← Loads user WITH cart
      setUser(freshUser);
    }
  } catch (e) {
    await AsyncStorage.removeItem("userId");
  } finally {
    setLoading(false); // ← Signals CartContext
  }
};
```

**Location to verify**:

- Open `frontend/context/AuthContext.tsx`
- Check line 26: User type has `cart` field
- Check line 62-75: restoreSession loads getUser and sets loading=false

---

## FILE 3: `frontend/context/CartContext.tsx`

**Purpose**: Manages cart state and syncs to database

### Required Code

✓ Line ~45-75: Watch for auth loading completion

```typescript
useEffect(() => {
  if (authLoading) return; // Wait for auth

  if (user?.id) {
    loadCartFromUser(); // Load from DB
  } else {
    setCartItems([]);
    setCartLoaded(false);
  }
}, [authLoading, user?.id]); // ← MUST depend on both
```

✓ Line ~73-84: Load cart from DB

```typescript
const loadCartFromUser = () => {
  try {
    const dbCart: CartItem[] = (user?.cart ?? []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      qty: item.qty,
      price: item.price,
    }));
    setCartItems(dbCart);
    console.log("Cart loaded from DB:", dbCart.length, "items");
  } catch (e) {
    console.log("Failed to load cart:", e);
  } finally {
    setCartLoaded(true);
  }
};
```

✓ Line ~86-118: Debounced sync to database

```typescript
useEffect(() => {
  if (!cartLoaded) return;
  if (!user?.id) return;

  // Clear any pending sync timer
  if (syncTimer.current) {
    clearTimeout(syncTimer.current);
  }

  // Set new debounced sync
  syncTimer.current = setTimeout(async () => {
    try {
      console.log("SYNCING CART TO DB:", cartItems.length, "items");

      await syncCart(
        user.id,
        cartItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          qty: i.qty,
          price: i.price,
        })),
      );

      console.log("✅ Cart synced successfully to DB");
    } catch (e) {
      console.error("❌ Cart sync failed:", e);
    }
  }, 800); // ← MUST be 800ms

  // Cleanup on unmount
  return () => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }
  };
}, [cartItems, user?.id, cartLoaded]); // ← MUST depend on all 3
```

✓ Line ~150-190: Place order function

```typescript
const placeOrder = async (): Promise<{ order_id: string } | null> => {
  if (!user?.id) {
    console.log("placeOrder: no user");
    return null;
  }
  if (!user.selectedAddressId) {
    console.log("placeOrder: no address");
    return null;
  }
  if (cartItems.length === 0) {
    console.log("placeOrder: cart empty");
    return null;
  }

  setIsCheckingOut(true);
  try {
    const items = cartItems.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      qty: i.qty,
      price: i.price,
    }));

    console.log("Placing order:", {
      userId: user.id,
      items,
      totalAmount,
      address: user.selectedAddressId,
    });

    const result = await apiCheckout(
      user.id,
      items,
      totalAmount,
      user.selectedAddressId,
    );

    console.log("Order placed successfully:", result.order_id);

    clearCart();

    return { order_id: result.order_id };
  } catch (err: any) {
    console.log(
      "placeOrder error:",
      err?.response?.data ?? err?.message ?? err,
    );
    throw err;
  } finally {
    setIsCheckingOut(false);
  }
};
```

**Location to verify**:

- Open `frontend/context/CartContext.tsx`
- Line 45: Has useEffect with [authLoading, user?.id]
- Line 86: Has useEffect with [cartItems, user?.id, cartLoaded]
- Line 86: Debounce delay is 800ms
- Line 150: Has placeOrder with all guards

---

## FILE 4: `frontend/app/(tabs)/cart.tsx`

**Purpose**: Cart UI that displays items and handles checkout

### Required Code

✓ Line ~18-48: Checkout handler

```typescript
const handleCheckout = async () => {
  if (!user) {
    Alert.alert("Not logged in", "Please log in first.");
    return;
  }
  if (!user.selectedAddressId) {
    Alert.alert(
      "No address selected",
      "Please add and select a delivery address first.",
    );
    return;
  }
  if (cartItems.length === 0) {
    Alert.alert("Cart is empty", "Add some items first.");
    return;
  }

  console.log("Checkout tapped — calling placeOrder()");

  try {
    const result = await placeOrder();

    console.log("placeOrder result:", result);

    if (result?.order_id) {
      router.replace({
        pathname: "/order-success",
        params: { orderId: result.order_id },
      });
    } else {
      Alert.alert(
        "Something went wrong",
        "Order could not be placed. Please try again.",
      );
    }
  } catch (err: any) {
    console.log("Checkout error in cart.tsx:", err);
    Alert.alert(
      "Order failed",
      err?.response?.data?.detail ??
        err?.message ??
        "Please check your connection and try again.",
    );
  }
};
```

**Location to verify**:

- Open `frontend/app/(tabs)/cart.tsx`
- Line 18: Has all 3 guards (user, selectedAddressId, cartItems.length)
- Line 18: Calls router.replace with correct params

---

## FILE 5: `backend/main.py`

**Purpose**: FastAPI server that syncs and checks out cart

### Required Models

✓ Line ~100: CartItemModel

```python
class CartItemModel(BaseModel):
    product_id: str
    product_name: str
    qty: int
    price: float
```

✓ Line ~108: CartSyncRequest

```python
class CartSyncRequest(BaseModel):
    items: List[CartItemModel]
```

✓ Line ~111: CheckoutRequest

```python
class CheckoutRequest(BaseModel):
    items: List[CartItemModel]
    total_amount: float
    address_id: str
```

### Required Helper Function

✓ Line ~155-170: user_response()

```python
def user_response(doc: dict) -> dict:
    """
    Converts MongoDB user document to response shape.
    CRITICAL: Must include cart field!
    """
    return {
        "id":                str(doc["_id"]),
        "phone":             doc.get("phone", ""),
        "name":              doc.get("name", ""),
        "email":             doc.get("email", ""),
        "addresses":         doc.get("addresses", []),
        "selectedAddressId": doc.get("selected_address_id", ""),
        "isNewUser":         doc.get("is_new_user", False),
        "cart":              doc.get("cart", []),          # ← MUST HAVE
        "purchases":         doc.get("purchases", []),
    }
```

### Required Endpoints

✓ Line ~341-356: POST /users/{user_id}/cart/sync

```python
@app.post("/users/{user_id}/cart/sync")
async def sync_cart(user_id: str, req: CartSyncRequest):
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

    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "cart":       cart_items,
            "updated_at": datetime.utcnow()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "Cart synced"}
```

✓ Line ~358-406: POST /users/{user_id}/checkout

```python
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
```

### Also Required: GET /users/{user_id}

✓ Line ~210-220: Should include cart in response

```python
@app.get("/users/{user_id}")
async def get_user(user_id: str):
    doc = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return user_response(doc)  # ← This includes cart field
```

**Location to verify**:

- Open `backend/main.py`
- Search for `@app.post("/users/{user_id}/cart/sync")`
- Search for `@app.post("/users/{user_id}/checkout")`
- Search for `def user_response`
- Verify all three exist and have the code above

---

## IMPORTANT FILES TO CHECK

### .env (Backend Environment)

**File**: `backend/.env`

**Must have**:

```
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/quick_commerce?retryWrites=true&w=majority
```

**How to verify**:

```bash
cd backend
cat .env
# Should show MONGO_URL= with actual value

# Or in Python:
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.getenv('MONGO_URL'))"
# Should print: mongodb+srv://...
```

---

### requirements.txt (Backend Dependencies)

**File**: `backend/requirements.txt`

**Must have**:

```
fastapi
uvicorn
motor
python-dotenv
pydantic
```

**How to verify**:

```bash
cd backend
cat requirements.txt

# Or install:
pip install -r requirements.txt
```

---

### BASE_URL (Frontend API)

**File**: `frontend/services/api.ts` Line 5

**Must match your machine IP**:

```typescript
const BASE_URL = "http://10.112.105.48:8000";
```

**How to find your IP**:

```bash
# Windows:
ipconfig

# Look for: IPv4 Address: 10.112.105.48
# Update if different!
```

---

## COMPLETE VERIFICATION CHECKLIST

Run through this entire checklist:

### Frontend Files

- [ ] `frontend/services/api.ts` has `syncCart()` function
- [ ] `frontend/services/api.ts` has `checkout()` function
- [ ] `frontend/context/AuthContext.tsx` User type has `cart` field
- [ ] `frontend/context/AuthContext.tsx` restoreSession() calls getUser()
- [ ] `frontend/context/CartContext.tsx` has first useEffect with [authLoading, user?.id]
- [ ] `frontend/context/CartContext.tsx` has loadCartFromUser() function
- [ ] `frontend/context/CartContext.tsx` has second useEffect with debounce timer
- [ ] `frontend/context/CartContext.tsx` debounce duration is 800ms
- [ ] `frontend/context/CartContext.tsx` has placeOrder() function with all guards
- [ ] `frontend/app/(tabs)/cart.tsx` has handleCheckout() function
- [ ] `frontend/app/(tabs)/cart.tsx` handleCheckout() has 3 guards

### Backend Files

- [ ] `backend/main.py` has CartItemModel class
- [ ] `backend/main.py` has CartSyncRequest class
- [ ] `backend/main.py` has CheckoutRequest class
- [ ] `backend/main.py` user_response() includes "cart" field
- [ ] `backend/main.py` has @app.post("/users/{user_id}/cart/sync") endpoint
- [ ] `backend/main.py` sync_cart() updates user.cart in MongoDB
- [ ] `backend/main.py` has @app.post("/users/{user_id}/checkout") endpoint
- [ ] `backend/main.py` checkout() creates order_id with uuid.uuid4()
- [ ] `backend/main.py` checkout() pushes to purchases[]
- [ ] `backend/main.py` checkout() sets cart to []
- [ ] `backend/main.py` checkout() returns order_id in response

### Configuration Files

- [ ] `backend/.env` exists with MONGO_URL
- [ ] `backend/requirements.txt` has all dependencies
- [ ] `frontend/services/api.ts` BASE_URL matches your machine IP

### Database

- [ ] MongoDB connection works
- [ ] Database name is "quick_commerce"
- [ ] Collections exist: products, categories, users
- [ ] User documents have fields: cart[], purchases[], addresses[], etc.

---

## If Something Is Missing...

### Missing syncCart() in API?

**File**: `frontend/services/api.ts`

Add this after the deleteAddress function (around line 100):

```typescript
export const syncCart = async (
  userId: string,
  items: {
    product_id: string;
    product_name: string;
    qty: number;
    price: number;
  }[],
) => {
  const res = await api.post(`/users/${userId}/cart/sync`, { items });
  return res.data;
};
```

### Missing checkout() in API?

**File**: `frontend/services/api.ts`

Add this after syncCart (around line 115):

```typescript
export const checkout = async (
  userId: string,
  items: {
    product_id: string;
    product_name: string;
    qty: number;
    price: number;
  }[],
  totalAmount: number,
  addressId: string,
) => {
  const res = await api.post(`/users/${userId}/checkout`, {
    items,
    total_amount: totalAmount,
    address_id: addressId,
  });
  return res.data;
};
```

### Missing cart field in user_response()?

**File**: `backend/main.py` Line ~165

Make sure this line exists:

```python
"cart":              doc.get("cart", []),
```

### Missing checkout endpoint?

**File**: `backend/main.py`

Should exist after sync_cart endpoint. If missing, add the complete checkout() function from section above.

---

## How to Use This Checklist

1. Go through each section above
2. Open the file mentioned
3. Search for the specific code/function name
4. Verify it exists exactly as shown
5. If missing, add it using the code provided
6. Test each problem scenario from COMPLETE_CART_SOLUTION.md

---

## Summary

If all items in this checklist are ✓, your implementation is complete and should work!

If any item is ✗, use the code provided in this document to add the missing piece.

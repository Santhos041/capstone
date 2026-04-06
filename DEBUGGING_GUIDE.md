# 🛠️ Debugging Guide - Identify & Fix Issues

## Quick Diagnosis

Add this to check which part is failing:

### Test 1: Is Backend Running?

```bash
# Terminal 1: Start backend
cd d:\Projects\capstone\backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete
```

### Test 2: Is Frontend Connected to Backend?

Open DevTools Console and run:

```javascript
// Check if API is reachable
fetch("http://10.112.105.48:8000/")
  .then((r) => r.json())
  .then(console.log)
  .catch((e) => console.error("FAILED:", e));

// Should print: {status: 'ok', message: 'Blinkit API running'}
// If error: "Could not connect" → Backend not running or wrong IP
```

### Test 3: Can You Add Item to Cart?

Expected console logs:

```
✓ See this when adding: "SYNCING CART TO DB: 1 items"
✓ Wait 800ms...
✓ See this: "✅ Cart synced successfully to DB"
```

If you DON'T see these:

- Check console.error() messages
- Look in browser DevTools → Network tab
- Check if POST to /cart/sync was sent

---

## Scenario 1: "Items Don't Persist When I Add Them"

### Diagnosis Steps

**Step 1: Check if sync is even being called**

Add to `frontend/context/CartContext.tsx` (line 95):

```typescript
sync cart Changes:
useEffect(() => {
  if (!cartLoaded) return;
  if (!user?.id) return;

  console.log("🔍 DEBUG: Cart changed, cartLoaded:", cartLoaded, "user.id:", user?.id);  // ← ADD THIS

  if (syncTimer.current) {
    clearTimeout(syncTimer.current);
  }

  syncTimer.current = setTimeout(async () => {
    try {
      console.log("SYNCING CART TO DB:", cartItems.length, "items");
      // ... rest of code
    }
  }, 800);
  // ...
}, [cartItems, user?.id, cartLoaded]);
```

**Expected output**:

```
After adding item: "🔍 DEBUG: Cart changed, cartLoaded: true user.id: uuid..."
Wait 800ms...
Then: "SYNCING CART TO DB: 1 items"
```

If you don't see this:

- `cartLoaded` is false? → Cart context not initialized properly
- `user.id` is missing? → User not logged in

---

**Step 2: Check if API call is being made**

DevTools → Network tab → Filter by "cart/sync"

Expected:

```
POST http://10.112.105.48:8000/users/{userId}/cart/sync
Headers: {
  "Content-Type": "application/json"
}
Body: {
  "items": [
    {
      "product_id": "...",
      "product_name": "...",
      "qty": 1,
      "price": 50
    }
  ]
}
Status: 200 OK
Response: {"success": true, "message": "Cart synced"}
```

If you don't see it:

1. Wrong BASE_URL? → Check `frontend/services/api.ts` line 5
2. Backend not running? → Check terminal
3. Network disabled? → Check WiFi/internet

---

**Step 3: Check if it's stored in MongoDB**

Open MongoDB shell:

```bash
mongo "mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/quick_commerce?retryWrites=true&w=majority"

# Then run:
db.users.findOne(
  {"phone": "YOUR_PHONE_NUMBER"},
  {"cart": 1}
)
```

Expected output:

```javascript
{
  "_id": ObjectId("..."),
  "cart": [
    {
      "product_id": "...",
      "product_name": "Apple",
      "qty": 1,
      "price": 50,
      "added_at": "2025-04-06T12:00:00.000Z"
    }
  ]
}
```

If cart is empty `[]`:

- The API call wasn't reaching backend
- Check backend logs for errors
- Verify user.id in request matches MongoDB user

If MongoDB connection fails:

- Check MONGO_URL in `.env`
- Verify MongoDB username/password
- Ensure IP is whitelisted in MongoDB Atlas

---

## Scenario 2: "Cart Disappears When I Close and Reopen App"

### Diagnosis Steps

**Step 1: Check if userId is stored locally**

When app starts, check browser console:

```javascript
// Old method (React Native)
// Open AsyncStorage debug:
import AsyncStorage from "@react-native-async-storage/async-storage";
AsyncStorage.getItem("userId").then((id) => console.log("Stored userId:", id));
```

Expected: `Stored userId: ObjectId(...)`

If it's `null`:

- User didn't log in properly
- AsyncStorage might be cleared

---

**Step 2: Check if AuthContext is loading user**

Frontend console when app starts:

Expected sequence:

```
1. "🔍 DEBUG: Cart changed..." ← Cart context initializing
2. Wait 1-2 seconds...
3. "Cart loaded from DB: 2 items" ← AuthContext loaded user with cart
4. "SYNCING CART TO DB: 2 items" ← CartContext syncing
5. "✅ Cart synced successfully to DB"
```

If you don't see "Cart loaded from DB":

- Check line in CartContext (should show when loading completes)
- AuthContext might not have loaded user
- User.cart property missing from API response

---

**Step 3: Manually verify in MongoDB**

```javascript
// Find user and check cart field
db.users.findOne({ phone: "YOUR_PHONE" }, { cart: 1, id: 1 });
```

Expected:

```javascript
{
  "_id": ObjectId("..."),
  "cart": [
    {product_id: "...", product_name: "Apple", qty: 1, price: 50, ...},
    {product_id: "...", product_name: "Banana", qty: 2, price: 30, ...}
  ]
}
```

If cart is empty or missing:

- Previous sync didn't work
- See Scenario 1 for debugging sync

---

**Step 4: Test GET /users/{id} API**

In terminal, run:

```bash
curl http://10.112.105.48:8000/users/YOUR_USER_ID_HERE

# Should return full user object including cart field
```

Expected response:

```json
{
  "id": "...",
  "phone": "...",
  "name": "...",
  "email": "...",
  "cart": [
    {product_id: "...", product_name: "Apple", qty: 1, price: 50, ...}
  ],
  "purchases": [],
  "addresses": [],
  "selectedAddressId": ""
}
```

If response doesn't include `cart`:

- Check `backend/main.py` line 155-170 (user_response function)
- Make sure it includes `"cart": doc.get("cart", [])`

---

## Scenario 3: "Checkout Button Doesn't Work"

### Diagnosis Steps

**Step 1: Check if button is even enabled**

In cart.tsx, when you tap checkout button:

Expected console:

```
"Checkout tapped — calling placeOrder()"
```

If nothing happens:

- Button might be disabled (check selectedAddressId)
- Check for guards (user, address, cart not empty)

---

**Step 2: Check placeOrder execution**

Expected logs:

```
"Checkout tapped — calling placeOrder()"
"Placing order: {userId: '...', items: [...], totalAmount: 250, address: '...'}"
Wait 1-2 seconds...
"Order placed successfully: order_id_uuid"
```

If you see error instead:

```
"Checkout error in cart.tsx:" + error message
```

Common errors:

- "No user" → Not logged in
- "No address" → Didn't select delivery address
- "Cart empty" → Cart items list is empty
- Network error → Backend not reachable

---

**Step 3: Check Network Request**

DevTools → Network tab → Filter "checkout"

Expected:

```
POST http://10.112.105.48:8000/users/{userId}/checkout
Status: 200 OK
Response: {
  "id": "...",
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "...",
  "cart": [],
  "purchases": [...]
}
```

If status is not 200:

- 400: Bad request → Check request body format
- 404: User not found → Wrong userData
- 500: Server error → Check backend logs

---

**Step 4: Verify order in MongoDB**

After checkout, verify:

```javascript
db.users.findOne({ phone: "YOUR_PHONE" }, { purchases: 1, cart: 1 });
```

Expected:

```javascript
{
  "_id": ObjectId("..."),
  "cart": [],  // ← EMPTY NOW
  "purchases": [
    {
      "product_id": "...",
      "product_name": "Apple",
      "qty": 1,
      "price": 50,
      "order_id": "550e8400-...",
      "purchased_at": "2025-04-06T12:30:00.000Z"
    }
  ]
}
```

If cart is NOT empty:

- Checkout didn't actually save to DB
- Check backend logs for errors
- Verify MongoDB connection

If purchases is empty:

- Backend didn't push to purchases array
- Check backend/main.py line 390-395

---

## Scenario 4: "API Returns Error"

Common API errors and fixes:

### Error: `401 Unauthorized`

**Message**: "Token expired" or "Not authenticated"
**Fix**: User session lost

- Call login again
- Check AsyncStorage for userId

### Error: `404 Not Found`

**Message**: "User not found"
**Fix**: User ID is wrong or doesn't exist

- Verify userId in AsyncStorage
- Check MongoDB for user doc

### Error: `400 Bad Request`

**Message**: "Invalid request body"
**Fix**: Request format is wrong

- Check API call in cart.tsx
- Verify items have: product_id, product_name, qty, price

### Error: `500 Internal Server Error`

**Message**: "Server error"
**Fix**: Backend crashed or database error

- Check backend console for traceback
- Verify MongoDB connection
- Check MONGO_URL in .env

### Error: `Network Error: Could not connect`

**Fix**: Backend not reachable

```bash
# Check backend is running:
curl http://10.112.105.48:8000/

# If fails, backend not running
# If times out, wrong IP or firewall blocked

# Get your machine IP:
ipconfig      # Windows

# Update BASE_URL in frontend/services/api.ts
const BASE_URL = "http://YOUR_IP:8000";
```

---

## Complete Debug Mode Setup

Add comprehensive logging to all files:

### 1. Frontend - CartContext.tsx

```typescript
// Add at line 48 (top of useEffect)
console.log(
  "🔍 CartContext Auth Effect: authLoading=",
  authLoading,
  "user.id=",
  user?.id,
);

// Add at line 75
console.log(
  "🔍 Cart loaded. loadCartFromUser called. current items:",
  cartItems,
);

// Add at line 100
console.log("🔍 Cart changed. New items:", cartItems.length);

// Add at line 115
console.log("🔍 Debounce: Timer set for 800ms");

// Add success/error in sync
console.log("✅ Cart sync success");
console.error("❌ Cart sync failed:", e);
```

### 2. Frontend - cart.tsx

```typescript
// Add after line 30
console.log(
  "🔍 handleCheckout: user=",
  user,
  "address=",
  user?.selectedAddressId,
  "items=",
  cartItems.length,
);

// Add after placeOrder result
console.log("🔍 placeOrder result:", result);

// Add in error catch
console.error("🔍 Checkout error details:", err);
```

### 3. Backend - main.py

```python
# Add to sync_cart (line 341)
print(f"🔍 Sync cart hit: user_id={user_id}, items={len(req.items)}")
print(f"🔍 Cart items: {req.items}")

# Add after update_one
print(f"🔍 Sync result: matched={result.matched_count}")

# Add to checkout (line 378)
print(f"🔍 Checkout hit: user_id={user_id}, items={len(req.items)}")

# Add at end
print(f"✅ Checkout complete: order_id={order_id}")
```

---

## Testing Checklist

Run through this to verify everything works:

```
1. ✓ App starts
   └─ Check console: "Cart loaded from DB: 0 items"

2. ✓ Add item to cart
   └─ Check console: "SYNCING CART TO DB: 1 items"
   └─ Check Network: POST /cart/sync (200 response)

3. ✓ Wait 1 second
   └─ Check MongoDB: user.cart has 1 item
   └─ Check console: "✅ Cart synced successfully to DB"

4. ✓ Add second item
   └─ Check console: "SYNCING CART TO DB: 2 items"
   └─ Check Network: Only 1 request (debounced) ✓

5. ✓ Close app
   └─ Kill React Native app process

6. ✓ Reopen app
   └─ Check console: "Cart loaded from DB: 2 items"
   └─ Verify both items show in UI

7. ✓ Select address
   └─ Check console: address set

8. ✓ Click "Proceed to Checkout"
   └─ Check console: "Checkout tapped"
   └─ Check loading spinner appears
   └─ Wait for: "Order placed successfully: {order_id}"
   └─ Check Network: POST /checkout (200 response)

9. ✓ Verify order success page
   └─ Shows order ID
   └─ Shows "Order Placed!" message

10. ✓ Verify MongoDB
    └─ purchases[] has items
    └─ cart[] is empty []
```

---

## Emergency Fixes

If something is critically broken:

### Fix 1: Clear Cart and Start Fresh

```javascript
// In browser console:
localStorage.clear();
// Or for React Native:
// Delete app and reinstall
```

### Fix 2: Reset User Cart in MongoDB

```javascript
db.users.updateOne(
  { phone: "YOUR_PHONE" },
  { $set: { cart: [], purchases: [] } },
);
```

### Fix 3: Restart Everything

```bash
# Terminal 1: Stop backend
Ctrl+C

# Terminal 1: Restart backend
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Restart frontend
cd frontend
npm start
```

### Fix 4: Check Environment

```bash
# Verify .env file exists
backend/.env

# Should have:
MONGO_URL=mongodb+srv://...

# If missing, create it with correct MongoDB URL
```

---

## Need Help?

If still not working, provide this info:

1. Backend running? `curl http://10.112.105.48:8000/` output
2. Frontend console errors? Screenshot
3. Network tab POST requests? Show URL + status
4. MongoDB query result? Show user document
5. Backend console output? Show complete log
6. Error message? Exact text

With this info, any issue can be debugged quickly!

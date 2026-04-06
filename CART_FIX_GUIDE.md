# Cart Persistence & Checkout Issues - Fixed ✅

## Summary of Issues Found

Your cart wasn't persisting because of **3 main issues**:

### 1. ❌ DUPLICATE ENDPOINT (Backend Bug)

**Location**: `backend/main.py` line ~430  
**Issue**: The `/users/{user_id}/cart/sync` endpoint was defined TWICE

- First definition (line ~330): Complete and working
- Second definition (line ~430): Incomplete with just a print statement

**Impact**: FastAPI picks the first or last route definition, causing conflicts. This broke the sync endpoint.

**✅ Fixed**: Removed the duplicate incomplete definition.

---

### 2. ❌ NO DEBOUNCING (Frontend Performance Bug)

**Location**: `frontend/context/CartContext.tsx` line 85-105  
**Issue**: `syncCart()` was called immediately on EVERY item change

- User adds Item A → sync sent (1 request)
- User adds Item B → sync sent (2 requests)
- User adds Item C → sync sent (3 requests)

**Impact**:

- Excessive API calls (bad for battery/network on mobile)
- Race conditions possible if requests arrive out of order
- Database thrashing

**✅ Fixed**: Added **800ms debouncing**

- User adds A, B, C within 800ms → **ONE sync** sent with all 3 items
- Proper cleanup of timers to prevent memory leaks

---

### 3. ✓ CHECKOUT WORKS (But verifying end-to-end)

**Flow**:

```
User clicks "Place Order"
    ↓
frontend/app/(tabs)/cart.tsx calls placeOrder()
    ↓
CartContext.placeOrder() → POST /users/{userId}/checkout
    ↓
Backend:
  - Creates order_id (UUID)
  - Appends items to purchases[]
  - Clears cart to []
  - Returns order_id
    ↓
Frontend receives order_id
    ↓
Redirects to /order-success with orderId param
    ↓
Order success screen displays order ID
```

---

## What's Been Fixed

### Backend (`backend/main.py`) ✅

```python
# REMOVED: Duplicate incomplete endpoint at line ~430
# These lines were deleted:
# @app.post("/users/{user_id}/cart/sync")
# async def sync_cart(user_id: str, req: CartSyncRequest):
#     print("🔥 SYNC CART HIT:", req.items)   # ADD THIS

# KEPT: Original complete endpoint at line ~341 (now line ~330)
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

### Frontend (`frontend/context/CartContext.tsx`) ✅

```typescript
// ADDED: Debounced sync with proper cleanup
useEffect(() => {
  if (!cartLoaded) return;
  if (!user?.id) return;

  // Clear any pending sync timer
  if (syncTimer.current) {
    clearTimeout(syncTimer.current);
  }

  // Set new debounced sync (800ms)
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
  }, 800); // Wait 800ms after last change before syncing

  // Cleanup on unmount
  return () => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }
  };
}, [cartItems, user?.id, cartLoaded]);
```

---

## How Cart Persistence Works Now

### 1. **Adding Items to Cart**

```
User adds item
  ↓
CartContext.addToCart() updates local state
  ↓
useEffect triggered (on cartItems change)
  ↓
800ms debounce timer started
  ↓
(If user adds more items within 800ms, timer resets)
  ↓
800ms idle → syncCart() sends to DB
  ↓
DB now has items
```

### 2. **Closing & Reopening App**

```
App closes (cart state lost)
  ↓
User reopens app
  ↓
AuthContext loads (calls GET /users/{userId})
  ↓
Backend returns user with cart[] field from DB
  ↓
CartContext.loadCartFromUser() hydrates from DB
  ↓
Items appear in cart!
```

### 3. **Checkout**

```
User clicks "Place Order"
  ↓
Cart validation (4 guards in place):
  - User logged in?
  - Address selected?
  - Cart has items?
  - User clicks button?
  ↓
placeOrder() called
  ↓
POST /users/{userId}/checkout
  ↓
Backend:
  - Validates user exists
  - Creates order_id
  - Moves items from cart[] → purchases[]
  - Clears cart[]
  ↓
Response includes order_id
  ↓
Frontend clears local cart state
  ↓
Redirects to /order-success/{orderId}
```

---

## Testing Checklist ✓

1. **Cart Persistence**
   - [ ] Open app, add 3 items to cart
   - [ ] Force close app (kill process)
   - [ ] Reopen app
   - [ ] Verify items still there

2. **Cart Sync Debouncing**
   - [ ] Open DevTools Network tab
   - [ ] Add 5 items quickly
   - [ ] Should see 1 sync request, not 5

3. **Checkout Flow**
   - [ ] Select delivery address
   - [ ] Add items and go to checkout
   - [ ] Click "Place Order"
   - [ ] Order success page shows (with order ID)
   - [ ] Backend logs show purchase created

4. **Edge Cases**
   - [ ] Try checkout without address → should show alert
   - [ ] Try checkout with empty cart → should show alert
   - [ ] Add item, sync fails → verify error logged

---

## Troubleshooting

### Cart not syncing?

1. Check browser DevTools Network tab - see sync requests?
2. Check backend console - see sync logs?
3. Check MongoDB user document - does cart[] have items?
4. Verify BASE_URL in `frontend/services/api.ts` matches your backend IP

### Cart not loading after reopen?

1. Make sure you're calling `getUser()` in AuthContext on app startup
2. Verify user.cart comes back from backend endpoint
3. Check console for "Cart loaded from DB" message

### Checkout not creating order?

1. Check backend `/users/{userId}/checkout` endpoint exists
2. Verify purchases[] array is being updated in MongoDB
3. Check order_id is returned in API response
4. Verify order-success page is receiving orderId param

---

## Files Changed

- **Backend**: `backend/main.py` - Removed duplicate endpoint
- **Frontend**: `frontend/context/CartContext.tsx` - Added debouncing

No changes needed to other files - everything else was already correct!

---

## Next Steps

1. ✅ Backend: Install dependencies if not done

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. ✅ Backend: Start server

   ```bash
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

3. ✅ Frontend: Rebuild/restart app

   ```bash
   cd frontend
   npm start
   ```

4. Test the scenarios in the checklist above

---

**Should be working now!** 🎉

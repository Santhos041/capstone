# Cart Persistence Flow Diagrams

## 1. Initial App Launch

```
╔═════════════════════════════════════════════════════════════════════════════════╗
║                          APP OPENS FOR FIRST TIME                              ║
╚═════════════════════════════════════════════════════════════════════════════════╝

AuthProvider.restoreSession()
  │
  ├─→ Checks AsyncStorage for userId
  │   └─→ Not found (first time)
  │
  └─→ Sets loading=false
      └─→ Sets user=null (not logged in)

CartContext watches: (authLoading, user?.id)
  │
  └─→ authLoading=false ✓, user?.id=null ✗
      └─→ Clears cart (user not logged in)

Result: Empty cart screen
```

## 2. User Logs In

```
╔═════════════════════════════════════════════════════════════════════════════════╗
║                    USER ENTERS PHONE & COMPLETES OTP                           ║
╚═════════════════════════════════════════════════════════════════════════════════╝

Login Flow:
  │
  ├─→ Verifies OTP
  │
  ├─→ Calls AuthContext.login(phone)
  │   │
  │   ├─→ frontend/services/api.ts: loginUser(phone)
  │   │   └─→ POST /users/login → Backend creates/finds user
  │   │
  │   ├─→ Response: { id, phone, name, email, addresses, cart[], purchases[] }
  │   │
  │   ├─→ AuthContext.setUser(userData)
  │   │
  │   └─→ Stores userId in AsyncStorage
  │
  └─→ Redirects to home

CartContext watches: (authLoading, user?.id)
  │
  └─→ authLoading=false ✓, user?.id=UUIDxxx ✓
      │
      ├─→ Calls loadCartFromUser()
      │   │
      │   ├─→ Maps user.cart[] to CartItem[]
      │   │
      │   └─→ setCartItems(dbCart)
      │
      └─→ setCartLoaded(true)

Result: Cart restored from DB (or empty if first login)
```

## 3. User Adds Items to Cart

```
╔═════════════════════════════════════════════════════════════════════════════════╗
║                     USER TAPS "ADD TO CART" MULTIPLE TIMES                     ║
╚═════════════════════════════════════════════════════════════════════════════════╝

Item 1 Added:
  │
  ├─→ UI calls CartContext.addToCart({ id, name, price })
  │
  ├─→ setCartItems([...prev, {id, name, price, qty: 1}])
  │
  ├─→ useEffect triggered (cartItems changed)
  │   │
  │   └─→ Debounce timer started (800ms countdown)
  │
  └─→ Local state updated, no sync yet

Item 2 Added (within 800ms):
  │
  ├─→ setCartItems([...prev, {id2, name2, price2, qty: 1}])
  │
  ├─→ useEffect triggered again
  │   │
  │   ├─→ Timer exists? YES → CANCEL IT
  │   │
  │   └─→ Start NEW 800ms countdown
  │
  └─→ Local state updated, still no sync

Item 3 Added (within 800ms):
  │
  ├─→ Same process...
  │
  └─→ Timer reset again

800ms IDLE (no more items added):
  │
  ├─→ Timer fires
  │
  ├─→ syncCart() called
  │   │
  │   ├─→ frontend/services/api.ts: syncCart(userId, items[])
  │   │   │
  │   │   └─→ POST /users/{userId}/cart/sync
  │   │       {
  │   │         "items": [
  │   │           { product_id, product_name, qty, price },
  │   │           { product_id, product_name, qty, price },
  │   │           { product_id, product_name, qty, price }
  │   │         ]
  │   │       }
  │   │
  │   ├─→ Backend /users/{userId}/cart/sync
  │   │   │
  │   │   ├─→ Validates user exists
  │   │   │
  │   │   ├─→ Updates user.cart = items[]
  │   │   │
  │   │   └─→ Returns { success: true }
  │   │
  │   └─→ console.log("✅ Cart synced successfully to DB")
  │
  └─→ Continue listening for next cart change

Result: ONE sync request sent for 3 items added!
```

## 4. App Closed & Reopened

```
╔═════════════════════════════════════════════════════════════════════════════════╗
║              USER FORCE-CLOSES APP (or backgrounded for >30s)                  ║
║                        USER REOPENS THE APP                                     ║
╚═════════════════════════════════════════════════════════════════════════════════╝

App Startup (Cold Start):
  │
  ├─→ CartProvider resets: cartItems=[], isCheckingOut=false
  │
  └─→ AuthProvider.restoreSession()
      │
      ├─→ Checks AsyncStorage
      │   └─→ Found userId! ✓
      │
      ├─→ Calls getUser(userId)
      │   │
      │   ├─→ frontend/services/api.ts: getUser(userId)
      │   │   │
      │   │   └─→ GET /users/{userId}
      │   │       └─→ Backend returns:
      │   │           {
      │   │             id, phone, name, email, addresses,
      │   │             selectedAddressId,
      │   │             cart: [             ← WITH ITEMS WE SAVED!
      │   │               { product_id, product_name, qty, price },
      │   │               { product_id, product_name, qty, price },
      │   │               { product_id, product_name, qty, price }
      │   │             ],
      │   │             purchases: []
      │   │           }
      │   │
      │   └─→ Returns full user object
      │
      ├─→ AuthContext.setUser(freshUser) ← Updates user state
      │
      └─→ AuthContext.setLoading(false) ← Signals ready!

CartContext watches: (authLoading, user?.id)
  │
  └─→ Triggers when authLoading=false AND user?.id exists
      │
      ├─→ Calls loadCartFromUser()
      │   │
      │   ├─→ Maps user.cart[] → CartItem[]
      │   │   Cart: [
      │   │     { product_id: "a", product_name: "Apple", qty: 2, price: 50 },
      │   │     { product_id: "b", product_name: "Banana", qty: 1, price: 30 },
      │   │     { product_id: "c", product_name: "Cherry", qty: 3, price: 20 }
      │   │   ]
      │   │
      │   ├─→ setCartItems(dbCart) ← LOCAL STATE NOW HAS 3 ITEMS!
      │   │
      │   └─→ setCartLoaded(true)
      │
      └─→ console.log("Cart loaded from DB: 3 items")

UI Updates:
  │
  └─→ Cart screen renders with 3 items
      ├─→ Total: 6 items (2+1+3)
      ├─→ Total: ₹170 (2×50 + 1×30 + 3×20)
      └─→ User can proceed to checkout!

Result: Cart perfectly restored! 🎉
```

## 5. User Proceeds to Checkout

```
╔═════════════════════════════════════════════════════════════════════════════════╗
║              USER TAPS "PLACE ORDER" BUTTON IN CART SCREEN                     ║
╚═════════════════════════════════════════════════════════════════════════════════╝

cart.tsx handleCheckout():
  │
  ├─→ Guard 1: Is user logged in? → YES ✓
  │
  ├─→ Guard 2: Is address selected? → YES ✓
  │
  ├─→ Guard 3: Is cart > 0 items? → YES ✓ (6 items)
  │
  └─→ All guards pass!

CartContext.placeOrder():
  │
  ├─→ Sets isCheckingOut=true (shows loading spinner)
  │
  ├─→ Builds order payload:
  │   {
  │     userId: "user123",
  │     items: [
  │       { product_id: "a", product_name: "Apple", qty: 2, price: 50 },
  │       { product_id: "b", product_name: "Banana", qty: 1, price: 30 },
  │       { product_id: "c", product_name: "Cherry", qty: 3, price: 20 }
  │     ],
  │     totalAmount: 170,
  │     addressId: "addr123"
  │   }
  │
  ├─→ Calls frontend/services/api.ts: checkout(...)
  │   │
  │   └─→ POST /users/{userId}/checkout
  │       {
  │         items: [...],
  │         total_amount: 170,
  │         address_id: "addr123"
  │       }
  │
  └─→ Backend processes order:
      │
      ├─→ Creates order_id: "550e8400-e29b-41d4-a716-446655440000"
      │
      ├─→ MongoDB update:
      │   {
      │     $push: {
      │       purchases: [
      │         {
      │           product_id: "a",
      │           product_name: "Apple",
      │           qty: 2,
      │           price: 50,
      │           order_id: "550e8400...",
      │           purchased_at: "2025-04-06T12:34:56.789"
      │         },
      │         { ... more items ... }
      │       ]
      │     },
      │     $set: {
      │       cart: [],              ← CART CLEARED!
      │       updated_at: ...
      │     }
      │   }
      │
      └─→ Returns response:
          {
            id, phone, name, email, addresses, selectedAddressId,
            cart: [],                  ← Empty now!
            purchases: [...],          ← Has our 3 items with order_id!
            order_id: "550e8400..."    ← Order ID!
          }

Frontend receives response:
  │
  ├─→ Extracts order_id: "550e8400..."
  │
  ├─→ CartContext.clearCart() → setCartItems([])
  │
  ├─→ Sets isCheckingOut=false (hide spinner)
  │
  ├─→ Navigates: router.replace("/order-success", { orderId: "550e8400..." })
  │
  └─→ Order Success screen displays:
      ✓
      Order Placed!
      Your order has been confirmed and will be delivered soon.

      Order ID: 550E8400

Result: Order successfully created in DB! 🎉
```

## 6. Key Synchronization Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SYNC POINTS SUMMARY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 1. ADD ITEMS TO CART                                                        │
│    └─→ 800ms debounced sync to DB                                           │
│    └─→ POST /users/{id}/cart/sync                                           │
│    └─→ DB updated with full cart[]                                          │
│                                                                             │
│ 2. APP CLOSES                                                               │
│    └─→ AsyncStorage has userId                                             │
│    └─→ Cartstate lost (React Native app reset)                              │
│                                                                             │
│ 3. APP OPENS AGAIN                                                          │
│    └─→ Reads userId from AsyncStorage                                       │
│    └─→ Calls GET /users/{id}                                                │
│    └─→ Backend returns user with cart[] from DB                             │
│    └─→ CartContext loads from user.cart[]                                   │
│    └─→ Cart restored! ✓                                                     │
│                                                                             │
│ 4. CHECKOUT                                                                 │
│    └─→ POST /users/{id}/checkout                                            │
│    └─→ Items moved to purchases[]                                           │
│    └─→ cart[] cleared to []                                                 │
│    └─→ order_id returned                                                    │
│    └─→ Frontend clears local cartItems[]                                    │
│    └─→ Next app open: cart[] empty (because DB had it cleared)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

✅ **Problem 1 (Duplicate endpoint)**: Backend was trying to sync twice, second one failed

- **Fix**: Removed duplicate definition

✅ **Problem 2 (No debouncing)**: Sent 1 sync per item, should batch them

- **Fix**: Added 800ms debouncing with timer

✅ **Problem 3 (Checkout)**: Actually was working, just needed to fix above issues

🎉 **Result**: Cart now persists across app restarts and checkout works perfectly!

import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

MONGO_URL     = os.getenv("MONGO_URL")
EXPO_PUSH_URL = "https://exp.host/push/send"

# ─── MongoDB connection ───────────────────────────────────────────────────────

mongo_client = AsyncIOMotorClient(MONGO_URL)
db           = mongo_client["blinkit"]

# ─── Send single push notification via Expo ───────────────────────────────────

async def send_expo_notification(
    token:   str,
    title:   str,
    body:    str,
    data:    dict = {}
) -> bool:
    """
    Sends a push notification to one device via Expo Push API.
    Returns True if sent successfully.
    """
    if not token:
        print("  ⚠️  No push token — skipping")
        return False

    if not token.startswith("ExponentPushToken"):
        print(f"  ⚠️  Invalid token format: {token[:20]}...")
        return False

    message = {
        "to":    token,
        "title": title,
        "body":  body,
        "data":  data,
        "sound": "default",
        "badge": 1,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={
                    "Content-Type": "application/json",
                    "Accept":       "application/json",
                },
                timeout=10
            )

            result = response.json()

            # Expo returns errors inside the response body
            if result.get("data", {}).get("status") == "error":
                print(f"  ❌ Expo error: {result['data'].get('message')}")
                return False

            return response.status_code == 200

    except Exception as e:
        print(f"  ❌ Failed to send notification: {e}")
        return False

# ─── Process all pending notifications ────────────────────────────────────────

async def process_pending_notifications():
    """
    Reads all pending notifications from MongoDB.
    For each one:
      1. Finds the user's Expo push token
      2. Sends the push notification
      3. Marks it as sent or failed
    """
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Checking pending notifications...")

    # Find all pending notifications
    cursor = db["notifications"].find({"status": "pending"})
    notifications = await cursor.to_list(length=100)

    if not notifications:
        print("  → No pending notifications")
        return

    print(f"  → Found {len(notifications)} pending notifications")

    for notification in notifications:
        user_id    = notification.get("user_id")
        n_type     = notification.get("type")
        product    = notification.get("product_name", "")
        title      = notification.get("title", "Blinkit")
        message    = notification.get("message", "")
        notif_id   = notification["_id"]

        print(f"\n  Processing: [{n_type}] {product} → user {str(user_id)[:8]}")

        # ── Get user's push token ─────────────────────────────────────────────
        try:
            user = await db["users"].find_one({"_id": ObjectId(user_id)})
        except Exception as e:
            print(f"  ❌ Invalid user_id format: {e}")
            await db["notifications"].update_one(
                {"_id": notif_id},
                {"$set": {"status": "failed", "error": "invalid user_id"}}
            )
            continue

        if not user:
            print(f"  ❌ User not found: {user_id}")
            await db["notifications"].update_one(
                {"_id": notif_id},
                {"$set": {"status": "failed", "error": "user not found"}}
            )
            continue

        token = user.get("expo_push_token", "")

        if not token:
            print(f"  ⚠️  No push token for user {str(user_id)[:8]} — marking skipped")
            await db["notifications"].update_one(
                {"_id": notif_id},
                {"$set": {"status": "skipped", "reason": "no push token"}}
            )
            continue

        # ── Send notification ─────────────────────────────────────────────────
        success = await send_expo_notification(
            token = token,
            title = title,
            body  = message,
            data  = {
                "type":       n_type,
                "product_id": notification.get("product_id", ""),
                "notif_id":   str(notif_id),
            }
        )

        # ── Update status in MongoDB ──────────────────────────────────────────
        new_status = "sent" if success else "failed"
        await db["notifications"].update_one(
            {"_id": notif_id},
            {"$set": {
                "status":  new_status,
                "sent_at": datetime.utcnow().isoformat(),
            }}
        )

        emoji = "✅" if success else "❌"
        print(f"  {emoji} [{new_status.upper()}] {title}")

# ─── Run forever ──────────────────────────────────────────────────────────────

async def run():
    """
    Polls MongoDB every 30 seconds for pending notifications.
    Runs forever on EC2.
    """
    print("🔔 Notification service started")
    print(f"   Polling every 30 seconds")
    print(f"   MongoDB: connected")
    print(f"   Expo Push API: {EXPO_PUSH_URL}")

    while True:
        try:
            await process_pending_notifications()
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()

        # Wait 30 seconds before next check
        await asyncio.sleep(30)

# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    asyncio.run(run())
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, count, sum as spark_sum,
    window, current_timestamp, lit, when,
    round as spark_round
)
from pyspark.sql.types import (
    StructType, StructField, StringType,
    FloatType, IntegerType, TimestampType
)
from pymongo import MongoClient
from bson import ObjectId
import os

# ─── Config ───────────────────────────────────────────────────────────────────

KAFKA_BROKER = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
MONGO_URI    = os.getenv("MONGO_URI")

# Scoring weights
CLICK_WEIGHT    = 2.0
CART_WEIGHT     = 5.0
PURCHASE_WEIGHT = 10.0

# Notification thresholds
HIGH_SCORE_THRESHOLD   = 20   # send discount
MEDIUM_SCORE_THRESHOLD = 10   # send reminder
# below 10 = ignore

# ─── Schemas ──────────────────────────────────────────────────────────────────

click_schema = StructType([
    StructField("event_type",   StringType()),
    StructField("user_id",      StringType()),
    StructField("product_id",   StringType()),
    StructField("product_name", StringType()),
    StructField("category_id",  StringType()),
    StructField("price",        FloatType()),
    StructField("area_bucket",  StringType()),
    StructField("timestamp",    StringType()),
])

cart_schema = StructType([
    StructField("event_type",   StringType()),
    StructField("user_id",      StringType()),
    StructField("product_id",   StringType()),
    StructField("product_name", StringType()),
    StructField("price",        FloatType()),
    StructField("qty",          IntegerType()),
    StructField("action",       StringType()),
    StructField("area_bucket",  StringType()),
    StructField("timestamp",    StringType()),
])

# ─── Spark session ────────────────────────────────────────────────────────────

spark = SparkSession.builder \
    .appName("BlinkitUserInterestScore") \
    .config("spark.sql.streaming.checkpointLocation", "s3://blinkit-spark-jobs/checkpoints/scoring/") \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

# ─── Read click events from Kafka ─────────────────────────────────────────────

click_raw = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", KAFKA_BROKER) \
    .option("subscribe", "click-events") \
    .option("startingOffsets", "latest") \
    .load()

clicks_df = click_raw.select(
    from_json(col("value").cast("string"), click_schema).alias("data"),
    col("timestamp").alias("kafka_ts")
).select("data.*", "kafka_ts")

# ─── Read cart events from Kafka ──────────────────────────────────────────────

cart_raw = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", KAFKA_BROKER) \
    .option("subscribe", "cart-events") \
    .option("startingOffsets", "latest") \
    .load()

cart_df = cart_raw.select(
    from_json(col("value").cast("string"), cart_schema).alias("data"),
    col("timestamp").alias("kafka_ts")
).select("data.*", "kafka_ts")

# ─── Count clicks per user per product in 30 min window ───────────────────────

click_counts = clicks_df \
    .withWatermark("kafka_ts", "5 minutes") \
    .groupBy(
        window(col("kafka_ts"), "30 minutes", "5 minutes"),
        col("user_id"),
        col("product_id"),
        col("product_name"),
        col("price"),
        col("area_bucket")
    ) \
    .agg(count("*").alias("click_count"))

# ─── Count cart adds per user per product in 30 min window ───────────────────

cart_counts = cart_df \
    .filter(col("action") == "add") \
    .withWatermark("kafka_ts", "5 minutes") \
    .groupBy(
        window(col("kafka_ts"), "30 minutes", "5 minutes"),
        col("user_id"),
        col("product_id"),
        col("product_name"),
        col("price"),
        col("area_bucket")
    ) \
    .agg(count("*").alias("cart_count"))

# ─── Process each batch and compute interest score ────────────────────────────

def compute_and_notify(click_batch_df, batch_id):
    """
    Called every micro-batch with click counts.
    Computes interest score and sends appropriate notification.

    Score formula:
      interest_score = (clicks * 2) + (cart_adds * 5)

    Decision:
      score >= 20  → HIGH   → send 10% discount immediately
      score >= 10  → MEDIUM → send reminder notification
      score < 10   → LOW    → ignore
    """

    if click_batch_df.isEmpty():
        return

    rows = click_batch_df.collect()
    print(f"\nBatch {batch_id} — processing {len(rows)} user-product combinations")

    mongo = MongoClient(MONGO_URI)
    db    = mongo["blinkit"]

    for row in rows:
        user_id    = row["user_id"]
        product_id = row["product_id"]
        clicks     = row["click_count"]

        # Get cart adds for this user+product from MongoDB
        # (cart events are also stored in MongoDB via sync)
        user_doc = db["users"].find_one({"_id": ObjectId(user_id)})
        cart_adds = 0
        if user_doc:
            cart_items = user_doc.get("cart", [])
            for item in cart_items:
                if item.get("product_id") == product_id:
                    cart_adds = item.get("qty", 0)
                    break

        # Compute interest score
        interest_score = (clicks * CLICK_WEIGHT) + (cart_adds * CART_WEIGHT)
        interest_score = round(interest_score, 2)

        print(f"  User: {user_id[:8]} | Product: {row['product_name']}")
        print(f"  Clicks: {clicks} | Cart adds: {cart_adds} | Score: {interest_score}")

        # Decide notification type based on score
        if interest_score >= HIGH_SCORE_THRESHOLD:
            notification_type = "discount_alert"
            title   = "🎉 Special offer just for you!"
            message = f"You love {row['product_name']}! Here's 10% off — use code BLINKIT10"
            priority = "high"
            print(f"  → HIGH score — sending discount notification")

        elif interest_score >= MEDIUM_SCORE_THRESHOLD:
            notification_type = "reminder"
            title   = "👀 Still thinking about it?"
            message = f"{row['product_name']} is waiting for you in our store!"
            priority = "medium"
            print(f"  → MEDIUM score — sending reminder notification")

        else:
            print(f"  → LOW score ({interest_score}) — ignoring")
            continue

        # Write notification to MongoDB
        db["notifications"].update_one(
            {
                "user_id":    user_id,
                "product_id": product_id,
                "type":       notification_type,
                "status":     "pending"
            },
            {"$set": {
                "user_id":         user_id,
                "type":            notification_type,
                "product_id":      product_id,
                "product_name":    row["product_name"],
                "title":           title,
                "message":         message,
                "interest_score":  interest_score,
                "click_count":     clicks,
                "cart_adds":       cart_adds,
                "priority":        priority,
                "status":          "pending",
                "created_at":      str(current_timestamp()),
            }},
            upsert=True
        )

        # Also update user's interest score in their profile
        # Useful for recommendation system later
        db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                f"interest_scores.{product_id}": interest_score
            }}
        )

    mongo.close()

# ─── Start streaming ──────────────────────────────────────────────────────────

query = click_counts.writeStream \
    .foreachBatch(compute_and_notify) \
    .outputMode("update") \
    .trigger(processingTime="2 minutes") \
    .start()

query.awaitTermination()
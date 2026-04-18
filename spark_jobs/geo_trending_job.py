from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, count, window,
    current_timestamp, desc, dense_rank,
    collect_list, struct
)
from pyspark.sql.types import (
    StructType, StructField, StringType, FloatType
)
from pyspark.sql.window import Window as W
from pymongo import MongoClient
from bson import ObjectId
import os

KAFKA_BROKER       = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
MONGO_URI          = os.getenv("MONGO_URI")
TRENDING_THRESHOLD = 5
WINDOW_MINUTES     = 10   # top products in last 10 mins

click_schema = StructType([
    StructField("event_type",   StringType()),
    StructField("user_id",      StringType()),
    StructField("product_id",   StringType()),
    StructField("product_name", StringType()),
    StructField("category_id",  StringType()),
    StructField("area_bucket",  StringType()),
    StructField("lat",          FloatType()),
    StructField("lon",          FloatType()),
    StructField("timestamp",    StringType()),
])

spark = SparkSession.builder \
    .appName("BlinkitGeoTrending") \
    .config(
        "spark.sql.streaming.checkpointLocation",
        "s3://blinkit-spark-jobs/checkpoints/trending/"
    ) \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

raw_df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", KAFKA_BROKER) \
    .option("subscribe", "click-events") \
    .option("startingOffsets", "latest") \
    .load()

clicks_df = raw_df.select(
    from_json(col("value").cast("string"), click_schema).alias("data"),
    col("timestamp").alias("kafka_ts")
).select("data.*", "kafka_ts")

# ─── Sliding window — top products per area in last 10 minutes ────────────────
# Window slides every 2 minutes so results are very fresh

area_product_counts = clicks_df \
    .withWatermark("kafka_ts", "3 minutes") \
    .groupBy(
        window(col("kafka_ts"), f"{WINDOW_MINUTES} minutes", "2 minutes"),
        col("area_bucket"),
        col("product_id"),
        col("product_name"),
        col("category_id")
    ) \
    .agg(count("*").alias("click_count")) \
    .filter(col("click_count") >= TRENDING_THRESHOLD)

# ─── Process each batch ───────────────────────────────────────────────────────

def process_trending(batch_df, batch_id):
    """
    For each area:
      1. Rank products by click count (dense_rank)
      2. Take top 5 trending products
      3. Update MongoDB trending collection
      4. Find all users in that area
      5. Send them a trending notification
    """

    if batch_df.isEmpty():
        return

    mongo = MongoClient(MONGO_URI)
    db    = mongo["blinkit"]

    rows = batch_df.collect()
    print(f"\nBatch {batch_id} — {len(rows)} area-product trending events")

    # Group by area_bucket — find top 5 per area
    from collections import defaultdict
    area_products = defaultdict(list)

    for row in rows:
        area_products[row["area_bucket"]].append({
            "product_id":   row["product_id"],
            "product_name": row["product_name"],
            "category_id":  row["category_id"],
            "click_count":  row["click_count"],
        })

    for area_bucket, products in area_products.items():
        # Sort by click count descending and take top 5
        top_products = sorted(
            products,
            key=lambda x: x["click_count"],
            reverse=True
        )[:5]

        print(f"\n  Area: {area_bucket}")
        for rank, p in enumerate(top_products, 1):
            print(f"    #{rank} {p['product_name']} — {p['click_count']} clicks")

        # Update trending collection for this area
        db["trending"].update_one(
            {"area_bucket": area_bucket},
            {"$set": {
                "area_bucket":    area_bucket,
                "top_products":   top_products,
                "window_minutes": WINDOW_MINUTES,
                "updated_at":     str(current_timestamp()),
            }},
            upsert=True
        )

        # Notify users in this area about top trending product
        top_product = top_products[0]

        # Find users whose selected address is in this area bucket
        users_in_area = db["users"].find({
            "addresses": {
                "$elemMatch": {
                    "area_bucket": area_bucket
                }
            }
        })

        notified = 0
        for user in users_in_area:
            user_id = str(user["_id"])

            # Don't notify if user already bought this product
            already_bought = any(
                p.get("product_id") == top_product["product_id"]
                for p in user.get("purchases", [])
            )
            if already_bought:
                continue

            db["notifications"].update_one(
                {
                    "user_id":    user_id,
                    "product_id": top_product["product_id"],
                    "type":       "trending_alert",
                    "status":     "pending"
                },
                {"$set": {
                    "user_id":      user_id,
                    "type":         "trending_alert",
                    "product_id":   top_product["product_id"],
                    "product_name": top_product["product_name"],
                    "area_bucket":  area_bucket,
                    "click_count":  top_product["click_count"],
                    "title":        "🔥 Trending near you!",
                    "message":      f"{top_product['product_name']} is the most popular product in your area right now!",
                    "all_trending": top_products,
                    "priority":     "medium",
                    "status":       "pending",
                    "created_at":   str(current_timestamp()),
                }},
                upsert=True
            )
            notified += 1

        print(f"  → Notified {notified} users in {area_bucket}")

    mongo.close()

query = area_product_counts.writeStream \
    .foreachBatch(process_trending) \
    .outputMode("update") \
    .trigger(processingTime="2 minutes") \
    .start()

query.awaitTermination()
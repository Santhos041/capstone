from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, collect_list, explode,
    count, desc, window, current_timestamp
)
from pyspark.sql.types import (
    StructType, StructField, StringType,
    FloatType, IntegerType, ArrayType
)
from pymongo import MongoClient
import os

KAFKA_BROKER = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
MONGO_URI    = os.getenv("MONGO_URI")

# ─── Schema ───────────────────────────────────────────────────────────────────

order_schema = StructType([
    StructField("event_type",    StringType()),
    StructField("user_id",       StringType()),
    StructField("order_id",      StringType()),
    StructField("product_ids",   ArrayType(StringType())),
    StructField("product_names", ArrayType(StringType())),
    StructField("total_amount",  FloatType()),
    StructField("area_bucket",   StringType()),
    StructField("timestamp",     StringType()),
])

spark = SparkSession.builder \
    .appName("BlinkitRecommendation") \
    .config(
        "spark.sql.streaming.checkpointLocation",
        "s3://blinkit-spark-jobs/checkpoints/recommendations/"
    ) \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

# ─── Read order events ────────────────────────────────────────────────────────

raw_df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", KAFKA_BROKER) \
    .option("subscribe", "order-events") \
    .option("startingOffsets", "earliest") \
    .load()

orders_df = raw_df.select(
    from_json(col("value").cast("string"), order_schema).alias("data"),
    col("timestamp").alias("kafka_ts")
).select("data.*", "kafka_ts")

# ─── Build co-occurrence matrix ───────────────────────────────────────────────

def build_cooccurrence_and_recommend(batch_df, batch_id):
    """
    Co-occurrence matrix:
    If product A and product B are bought together frequently,
    recommend B to users who view A.

    Example:
      Order 1: [Amul Butter, Amul Milk, Eggs]
      Order 2: [Amul Butter, Bread]
      Order 3: [Amul Butter, Amul Milk]

    Co-occurrence of Amul Butter:
      Amul Milk → 2 times
      Eggs      → 1 time
      Bread     → 1 time

    So if user views Amul Butter → recommend Amul Milk first
    """

    if batch_df.isEmpty():
        return

    mongo  = MongoClient(MONGO_URI)
    db     = mongo["blinkit"]
    co_col = db["cooccurrence"]

    rows = batch_df.collect()
    print(f"\nBatch {batch_id} — building co-occurrence from {len(rows)} orders")

    for row in rows:
        products = row["product_ids"]
        names    = row["product_names"]

        if not products or len(products) < 2:
            continue

        # For each pair of products in this order
        for i in range(len(products)):
            for j in range(len(products)):
                if i == j:
                    continue

                prod_a    = products[i]
                prod_b    = products[j]
                name_a    = names[i]
                name_b    = names[j]

                # Increment co-occurrence count
                co_col.update_one(
                    {
                        "product_a_id": prod_a,
                        "product_b_id": prod_b
                    },
                    {
                        "$inc": {"count": 1},
                        "$set": {
                            "product_a_name": name_a,
                            "product_b_name": name_b,
                            "updated_at":     str(current_timestamp()),
                        }
                    },
                    upsert=True
                )

    # Now build recommendation list for each product
    # Top 5 most co-occurring products = recommendations
    pipeline = [
        {"$sort": {"product_a_id": 1, "count": -1}},
        {
            "$group": {
                "_id":          "$product_a_id",
                "product_name": {"$first": "$product_a_name"},
                "recommendations": {
                    "$push": {
                        "product_id":   "$product_b_id",
                        "product_name": "$product_b_name",
                        "score":        "$count"
                    }
                }
            }
        },
        {
            "$project": {
                "product_id":    "$_id",
                "product_name":  1,
                "recommendations": {"$slice": ["$recommendations", 5]}
            }
        }
    ]

    recommendations = list(co_col.aggregate(pipeline))
    print(f"  Built recommendations for {len(recommendations)} products")

    # Store in recommendations collection
    for rec in recommendations:
        db["recommendations"].update_one(
            {"product_id": rec["product_id"]},
            {"$set": {
                "product_id":      rec["product_id"],
                "product_name":    rec.get("product_name", ""),
                "recommendations": rec["recommendations"],
                "updated_at":      str(current_timestamp()),
            }},
            upsert=True
        )

    mongo.close()
    print(f"  Recommendations updated in MongoDB")

query = orders_df.writeStream \
    .foreachBatch(build_cooccurrence_and_recommend) \
    .outputMode("update") \
    .trigger(processingTime="5 minutes") \
    .start()

query.awaitTermination()
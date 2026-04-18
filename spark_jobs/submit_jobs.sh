#!/bin/bash

CLUSTER_ID="j-XXXXXXXXXXXXX"   # your EMR cluster ID
S3_BUCKET="s3://blinkit-spark-jobs"
KAFKA_BROKER="b-1.capstonekafka.xxxxx.kafka.us-east-1.amazonaws.com:9092"
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/"

PACKAGES="org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0,\
org.mongodb.spark:mongo-spark-connector_2.12:10.3.0"

# Submit interest scoring job
aws emr add-steps \
  --cluster-id $CLUSTER_ID \
  --steps Type=Spark,\
Name="UserInterestScore",\
ActionOnFailure=CONTINUE,\
Args=[--deploy-mode,cluster,\
--packages,$PACKAGES,\
--conf,spark.mongodb.write.connection.uri=$MONGO_URI,\
--conf,spark.env.KAFKA_BOOTSTRAP_SERVERS=$KAFKA_BROKER,\
--conf,spark.env.MONGO_URI=$MONGO_URI,\
$S3_BUCKET/jobs/user_interest_score_job.py]

# Submit recommendation job
aws emr add-steps \
  --cluster-id $CLUSTER_ID \
  --steps Type=Spark,\
Name="Recommendations",\
ActionOnFailure=CONTINUE,\
Args=[--deploy-mode,cluster,\
--packages,$PACKAGES,\
$S3_BUCKET/jobs/recommendation_job.py]

# Submit geo trending job
aws emr add-steps \
  --cluster-id $CLUSTER_ID \
  --steps Type=Spark,\
Name="GeoTrending",\
ActionOnFailure=CONTINUE,\
Args=[--deploy-mode,cluster,\
--packages,$PACKAGES,\
$S3_BUCKET/jobs/geo_trending_job.py]

echo "All 3 Spark jobs submitted to EMR cluster $CLUSTER_ID"
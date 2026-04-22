from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient, NewTopic
import json
import os
from dotenv import load_dotenv

load_dotenv()

KAFKA_BROKER = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

# Topic names
TOPIC_CLICKS = "click-events"
TOPIC_CART   = "cart-events"
TOPIC_ORDERS = "order-events"

# ─── Initialize producer ──────────────────────────────────────────────────────

_producer = None

def get_producer():
    global _producer

    if _producer is None:
        print(f"🔌 Connecting to Kafka: {KAFKA_BROKER}")

        _producer = Producer({
            "bootstrap.servers": KAFKA_BROKER,
            "client.id": "blinkit-producer",

            # ✅ Reliability
            "acks": "all",
            "retries": 5,

            # ✅ REQUIRED for MSK stability
            "security.protocol": "PLAINTEXT",

            # 🔥 CRITICAL FIX (timeouts)
            "message.timeout.ms": 60000,
            "socket.timeout.ms": 60000,
            "request.timeout.ms": 30000,

            # ✅ Performance tuning
            "linger.ms": 10,
            "batch.num.messages": 1000
        })

        print(f"✅ Kafka producer connected to {KAFKA_BROKER}")

    return _producer
# ─── Create topics on startup ─────────────────────────────────────────────────

def create_topics():
    try:
        admin = AdminClient({"bootstrap.servers": KAFKA_BROKER})
        topics = [
            NewTopic(TOPIC_CLICKS, num_partitions=3, replication_factor=1),
            NewTopic(TOPIC_CART,   num_partitions=3, replication_factor=1),
            NewTopic(TOPIC_ORDERS, num_partitions=3, replication_factor=1),
        ]
        results = admin.create_topics(topics)
        for topic, future in results.items():
            try:
                future.result()
                print(f"✅ Topic created: {topic}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"ℹ️  Topic exists: {topic}")
                else:
                    print(f"❌ Topic error {topic}: {e}")
    except Exception as e:
        print(f"❌ Kafka admin error (is Kafka running?): {e}")

# ─── Publish ──────────────────────────────────────────────────────────────────

def delivery_report(err, msg):
    if err:
        print(f"❌ Kafka failed | {msg.topic()} | {err}")
    else:
        print(f"✅ Kafka sent | {msg.topic()} | partition:{msg.partition()} offset:{msg.offset()}")

def publish(topic: str, event: dict):
    """
    Publish event to Kafka.
    Never raises — always fails silently to protect API responses.
    """
    try:
        p = get_producer()
        p.produce(
            topic=topic,
            key=str(event.get("user_id", "unknown")),
            value=json.dumps(event),
            callback=delivery_report
        )
        p.flush(timeout=40)  # non-blocking
        return True
    except Exception as e:
        print(f"❌ Kafka publish error: {e}")
        return False

def flush():
    try:
        if _producer:
            _producer.flush(timeout=5)
    except Exception as e:
        print(f"❌ Kafka flush error: {e}")
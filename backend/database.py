import motor.motor_asyncio
import os

from dotenv import load_dotenv
# add this to database.py temporarily to find your encoded password
from urllib.parse import quote_plus
print(quote_plus("your_actual_password_here"))
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client["quick_commerce"]

products_collection = db["products"]
categories_collection = db["categories"]
users_collection = db["users"]
import requests
import json
import uuid
import random
from datetime import datetime, timedelta
import time

# Configuration
API_BASE = "http://localhost:8000"
BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2ODhhNDQ2NDRlNTA1ZjhjOTljZWVkZjIiLCJleHAiOjE3NTQwMDUwNTh9.XC5iYjhLGvp9S0N4Va7w-Dw_8kOX50cOCx2-KcVmXBc"  # Replace with your actual token
HEADERS = {
    "Authorization": f"Bearer {BEARER_TOKEN}",
    "Content-Type": "application/json"
}

# Sample data for randomization
MERCHANTS = ["AMAZON", "WALMART", "TARGET", "BEST_BUY", "APPLE", "GOOGLE", "NETFLIX", "SPOTIFY", "UBER", "LYFT"]
CATEGORIES = ["shopping_net", "food_dining", "gas_transport", "entertainment", "travel", "health_fitness", "home", "personal_care"]
FIRST_NAMES = ["John", "Jane", "Mike", "Sarah", "David", "Lisa", "Tom", "Emma", "Chris", "Anna"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"]
STATES = ["NY", "CA", "IL", "TX", "AZ", "PA", "FL", "OH", "GA", "NC"]
JOBS = ["Engineer", "Teacher", "Doctor", "Manager", "Sales", "Designer", "Developer", "Analyst", "Consultant", "Director"]

def generate_random_transaction():
    """Generate a random transaction with realistic data"""
    
    # Generate random date within last 2 years
    end_date = datetime.now()
    start_date = end_date - timedelta(days=730)  # 2 years back
    random_days = random.randint(0, (end_date - start_date).days)
    random_date = start_date + timedelta(days=random_days)
    
    # Random amount between $10 and $1000
    amount = round(random.uniform(10, 1000), 2)
    
    # Random fraud probability (30% chance of fraud)
    is_fraud = random.choices([0, 1], weights=[50, 50])[0]
    fraud_score = round(random.uniform(0.1, 0.95), 2) if is_fraud else round(random.uniform(0.01, 0.3), 2)
    
    # Random location
    city = random.choice(CITIES)
    state = random.choice(STATES)
    lat = round(random.uniform(25, 50), 4)  # US latitude range
    long = round(random.uniform(-125, -65), 4)  # US longitude range
    
    transaction = {
        "trans_num": str(uuid.uuid4()),
        "trans_date_trans_time": random_date.strftime("%Y-%m-%d %H:%M:%S"),
        "cc_num": random.randint(1000000000000000, 9999999999999999),
        "merchant": random.choice(MERCHANTS),
        "category": random.choice(CATEGORIES),
        "amt": amount,
        "first": random.choice(FIRST_NAMES),
        "last": random.choice(LAST_NAMES),
        "gender": random.choice(["M", "F"]),
        "street": f"{random.randint(1, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Elm', 'Maple'])} St",
        "city": city,
        "state": state,
        "zip": random.randint(10000, 99999),
        "lat": lat,
        "long": long,
        "city_pop": random.randint(50000, 1000000),
        "job": random.choice(JOBS),
        "dob": f"{random.randint(1960, 2000)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
        "unix_time": int(random_date.timestamp()),
        "merch_lat": lat + random.uniform(-0.01, 0.01),
        "merch_long": long + random.uniform(-0.01, 0.01),
        "is_fraud": 0,
        "fraud_score": 0.5
    }
    
    return transaction

def seed_transactions(count=100):
    """Seed the database with random transactions"""
    
    print(f"Starting to seed {count} transactions...")
    success_count = 0
    error_count = 0
    
    for i in range(count):
        try:
            transaction = generate_random_transaction()
            
            # Call the API
            response = requests.post(
                f"{API_BASE}/transactions/all",
                headers=HEADERS,
                json=transaction
            )
            
            if response.status_code == 200:
                success_count += 1
                print(f"✓ Transaction {i+1}/{count} created successfully")
            else:
                error_count += 1
                print(f"✗ Transaction {i+1}/{count} failed: {response.status_code} - {response.text}")
                
        except Exception as e:
            error_count += 1
            print(f"✗ Transaction {i+1}/{count} error: {str(e)}")
        
        # Small delay to avoid overwhelming the server
        time.sleep(0.1)
    
    print(f"\nSeeding completed!")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")
    print(f"Total: {count}")

def test_success_rate():
    """Test the success rate endpoint"""
    try:
        response = requests.get(f"{API_BASE}/fraud/successRate", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            print(f"\nSuccess Rate Data:")
            print(f"Total Cases: {data.get('total_cases', 0)}")
            print(f"Fraud Percentage: {data.get('fraud_percentage', 0):.1f}%")
            print(f"Non-Fraud Percentage: {data.get('non_fraud_percentage', 0):.1f}%")
        else:
            print(f"Failed to get success rate: {response.status_code}")
    except Exception as e:
        print(f"Error testing success rate: {str(e)}")

if __name__ == "__main__":
    # First, test the success rate
    print("Testing current success rate...")
    test_success_rate()
    
    # Ask user for number of transactions to seed
    try:
        count = int(input("\nHow many transactions to seed? (default 50): ") or "50")
    except ValueError:
        count = 50
    
    # Seed the transactions
    seed_transactions(count)
    
    # Test success rate again
    print("\nTesting success rate after seeding...")
    test_success_rate() 
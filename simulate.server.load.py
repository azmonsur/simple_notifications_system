import requests
import random
import string
import concurrent.futures

counter = 0


# API endpoint
URL = "http://localhost:3001/api/v1/users"
URL = "http://localhost:3001/api/v1/admin/auth/login"

# Generate a random username
def random_username():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

# Generate a random first and last name
def random_name():
    first_names = ["John", "Jane", "Mike", "Sarah", "Emma", "Chris", "Paul", "Lisa", "David", "Olivia"]
    last_names = ["Doe", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Wilson"]
    return random.choice(first_names), random.choice(last_names)

# Generate a random gender
def random_gender():
    return random.choice(["Male", "Female", "Other"])

# Generate a random age
def random_age():
    return random.randint(18, 65)

# Function to send one POST request
def send_request(_):
    first_name, last_name = random_name()
    data = {
        "username": random_username(),
        "first_name": first_name,
        "last_name": last_name,
        "age": random_age(),
        "gender": random_gender()
    }

    data3 = {
        "email": "info@cyberbridgesoft.com",
        "password": "Admin@123"
    }

    try:
        response = requests.post(URL, json=data3, timeout=5)
        if response.status_code == 201 or response.status_code == 200:
            # print(f"✅ Inserted: {data['username']}")
            counter += 1
        else:
            # print(f"⚠️ Failed ({response.status_code}): {response.text}")
            pass
    except Exception as e:
        print(f"❌ Error: {e}")

# Main runner — simulate 10,000 concurrent requests
def main():
    total_requests = 10000
    print(f"🚀 Sending {total_requests} requests to {URL}...\n")

    # Use ThreadPoolExecutor for concurrency
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
        executor.map(send_request, range(total_requests))

    print("\n✅ Done sending all requests.")
    print(f"Total successful requests: {counter}/{total_requests}")

if __name__ == "__main__":
    main()

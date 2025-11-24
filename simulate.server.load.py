import requests
import random
import string
import concurrent.futures
import time
from threading import Lock

# Track metrics
metrics = {
    'total': 0,
    'success': 0,
    'failed': 0,
    'errors': 0,
    'response_times': [],
}
metrics_lock = Lock()

# API endpoint
BASE_URL = "http://localhost:3001/api/v1"
BASE_URL = "https://notification.cyberbridgesoft.com/api/v1"
LOGIN_URL = f"{BASE_URL}/admin/auth/login"
USERS_URL = f"{BASE_URL}/users"

def random_username():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def random_name():
    first_names = ["John", "Jane", "Mike", "Sarah", "Emma", "Chris", "Paul", "Lisa", "David", "Olivia"]
    last_names = ["Doe", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Wilson"]
    return random.choice(first_names), random.choice(last_names)

def random_gender():
    return random.choice(["Male", "Female", "Other"])

def random_age():
    return random.randint(18, 65)

def send_login_request(_):
    """Send login request"""
    data = {
        "email": "info@cyberbridgesoft.com",
        "password": "Admin@123"
    }
    
    start_time = time.time()
    
    try:
        response = requests.post(LOGIN_URL, json=data, timeout=5)
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        with metrics_lock:
            metrics['total'] += 1
            metrics['response_times'].append(response_time)
            
            if response.status_code in [200, 201]:
                metrics['success'] += 1
                print(f"✅ Login successful ({response_time:.0f}ms)")
            else:
                metrics['failed'] += 1
                print(f"⚠️ Login failed ({response.status_code}): {response.text[:100]}")
                
    except Exception as e:
        with metrics_lock:
            metrics['total'] += 1
            metrics['errors'] += 1
        print(f"❌ Error: {e}")

def send_user_creation_request(_):
    """Send user creation request"""
    first_name, last_name = random_name()
    data = {
        "username": f"u{int(time.time()*1000000)}{random_username()}",
        "first_name": first_name,
        "last_name": last_name,
        "age": random_age(),
        "gender": random_gender()
    }
    
    start_time = time.time()
    
    try:
        response = requests.post(USERS_URL, json=data, timeout=5)
        response_time = (time.time() - start_time) * 1000
        
        with metrics_lock:
            metrics['total'] += 1
            metrics['response_times'].append(response_time)
            
            if response.status_code in [200, 201]:
                metrics['success'] += 1
                print(f"✅ User created: {data['username']} ({response_time:.0f}ms)")
            else:
                metrics['failed'] += 1
                print(f"⚠️ Failed ({response.status_code}): {response.text[:100]}")
                
    except Exception as e:
        with metrics_lock:
            metrics['total'] += 1
            metrics['errors'] += 1
        print(f"❌ Error: {e}")

def print_statistics():
    """Print final statistics"""
    print("\n" + "="*60)
    print("📊 LOAD TEST RESULTS")
    print("="*60)
    
    print(f"\n📈 Request Statistics:")
    print(f"  Total Requests:    {metrics['total']}")
    print(f"  ✅ Successful:     {metrics['success']} ({metrics['success']/metrics['total']*100:.1f}%)")
    print(f"  ⚠️  Failed:         {metrics['failed']} ({metrics['failed']/metrics['total']*100:.1f}%)")
    print(f"  ❌ Errors:         {metrics['errors']} ({metrics['errors']/metrics['total']*100:.1f}%)")
    
    if metrics['response_times']:
        sorted_times = sorted(metrics['response_times'])
        print(f"\n⏱️  Response Times:")
        print(f"  Average:   {sum(sorted_times)/len(sorted_times):.0f}ms")
        print(f"  Min:       {sorted_times[0]:.0f}ms")
        print(f"  Max:       {sorted_times[-1]:.0f}ms")
        print(f"  P50:       {sorted_times[len(sorted_times)//2]:.0f}ms")
        print(f"  P95:       {sorted_times[int(len(sorted_times)*0.95)]:.0f}ms")
        print(f"  P99:       {sorted_times[int(len(sorted_times)*0.99)]:.0f}ms")

def main():
    total_requests = 50000
    max_workers = 500
    
    # Choose which endpoint to test
    print("Select test type:")
    print("1. Login endpoint")
    print("2. User creation endpoint")
    choice = input("Enter choice (1 or 2): ")
    
    if choice == "1":
        test_function = send_login_request
        url = LOGIN_URL
    else:
        test_function = send_user_creation_request
        url = USERS_URL
    
    print(f"\n🚀 Load Test Configuration:")
    print(f"  Endpoint:      {url}")
    print(f"  Total requests: {total_requests}")
    print(f"  Concurrency:    {max_workers} workers")
    print(f"\n⏳ Starting load test...\n")
    
    start_time = time.time()
    
    # Run load test
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(test_function, range(total_requests))
    
    duration = time.time() - start_time
    
    # Print statistics
    print_statistics()
    
    print(f"\n⏱️  Total Duration: {duration:.2f}s")
    print(f"📊 Throughput: {total_requests/duration:.2f} req/s")
    print("\n✅ Load test completed!")

if __name__ == "__main__":
    main()
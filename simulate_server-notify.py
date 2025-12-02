import requests
import random
import string
import concurrent.futures
import time
from threading import Lock

# --- Configuration & Security ---
# !!! WARNING: The API Key below is now in the conversation log. Please revoke/regenerate it. !!!
API_KEY = ""
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

BASE_URL = "http://localhost:3001/api/v1" 
NOTIFICATION_URL = f"{BASE_URL}/notification"

# Load Test Parameters
TOTAL_REQUESTS = 500
MAX_WORKERS = 5     

# --- Metrics and Locking ---
metrics = {
    'total': 0,
    'success': 0,
    'failed': 0,
    'errors': 0,
    'response_times': [],
}
metrics_lock = Lock()

# --- Random Data Generation Functions ---

def random_tracking_number():
    """Generates a random tracking number like NIP675VGF"""
    chars = string.ascii_uppercase + string.digits
    return 'NIP' + ''.join(random.choices(chars, k=10))

def random_phone():
    """Generates a random Nigerian-style phone number (+234...)."""
    return '+234' + ''.join(random.choices(string.digits, k=10))

def random_email(name):
    """Generates a random email based on a name."""
    domains = ["example.com", "testmail.org", "inbox.net", "corpmail.co"]
    sanitized_name = name.lower().replace(" ", ".").split(".")[0] 
    return f"{sanitized_name}.{random.randint(10,99)}@{random.choice(domains)}"

def random_name():
    """Generates a random first and last name."""
    first_names = ["John", "Jane", "Mike", "Sarah", "Emma", "Chris", "Paul", "Lisa", "David", "Olivia", "Biola", "Azeez", "Tunde"]
    last_names = ["Doe", "Smith", "Johnson", "Williams", "Brown", "Jones", "Abodunrin", "Monsur", "Koa"]
    return random.choice(first_names) + " " + random.choice(last_names)

def random_center():
    """Generates a random office location."""
    centers = ["Abuja office", "Lagos office", "Kano office", "Port Harcourt office", "Ibadan office"]
    return random.choice(centers)

def random_amount():
    """Generates a random amount."""
    return random.randint(500, 50000)

def random_channel():
    """Generates a random list of 1, 2, or all 3 preferred channels."""
    all_channels = ["email", "whatsapp", "sms"]
    num_channels = random.randint(1, 3)
    return random.sample(all_channels, num_channels)

# --- Request Function ---

def send_notification_request(_):
    """Send notification request with a randomized payload and authorization header."""
    sender_name = random_name()
    receiver_name = random_name()
    
    data = {
        "payload": {
            "tracking_number": random_tracking_number(),
            "parcel_status": random.choice(["pending", "dispatched", "arrived", "received", "returned"]),
            "amount": random_amount(),
            "origin_center": random_center(),
            "destination_center": random_center(),
            "sender": {
                "name": sender_name,
                "phone": random_phone(),
                "email": random_email(sender_name),
                "preferred_channels": random_channel()
            },
            "receiver": {
                "name": receiver_name,
                "phone": random_phone(),
                "email": random_email(receiver_name),
                "preferred_channels": random_channel()
            }
        }
    }
    
    start_time = time.time()
    
    try:
        # Pass the HEADERS dictionary with the API key
        response = requests.post(NOTIFICATION_URL, json=data, headers=HEADERS, timeout=30) 
        response_time = (time.time() - start_time) * 1000 
        
        with metrics_lock:
            metrics['total'] += 1
            metrics['response_times'].append(response_time)
            
            if response.status_code in [200, 201, 202]: 
                metrics['success'] += 1
            elif response.status_code == 401:
                 # Specific check for failed authorization
                 metrics['failed'] += 1
                 print(f"❌ AUTH FAILED (401). Check API key/URL.")
            else:
                metrics['failed'] += 1
                
    except requests.exceptions.Timeout:
        with metrics_lock:
            metrics['total'] += 1
            metrics['errors'] += 1

    except Exception as e:
        with metrics_lock:
            metrics['total'] += 1
            metrics['errors'] += 1

# --- Statistics Printing Function ---

def print_statistics(duration, total_requests):
    """Print final statistics"""
    print("\n" + "="*60)
    print("📊 LOAD TEST RESULTS")
    print("="*60)
    
    total_completed = metrics['total']
    
    if total_completed == 0:
        print("No requests were successfully attempted.")
        return
        
    print(f"\n📈 Request Statistics:")
    print(f"  Total Requests Scheduled: {total_requests}")
    print(f"  Total Requests Completed: {total_completed}")
    print(f"  ✅ Successful:           {metrics['success']} ({metrics['success']/total_completed*100:.1f}%)")
    print(f"  ⚠️  Failed (App/Auth):    {metrics['failed']} ({metrics['failed']/total_completed*100:.1f}%)")
    print(f"  ❌ Errors (Network/Timeout): {metrics['errors']} ({metrics['errors']/total_completed*100:.1f}%)")
    
    if metrics['response_times']:
        sorted_times = sorted(metrics['response_times'])
        
        def percentile(data, p):
            if not data: return 0
            index = int(len(data) * p / 100)
            return data[min(index, len(data) - 1)]

        print(f"\n⏱️  Response Times (ms):")
        print(f"  Average:    {sum(sorted_times)/len(sorted_times):.0f}")
        print(f"  Min:        {sorted_times[0]:.0f}")
        print(f"  Max:        {sorted_times[-1]:.0f}")
        print(f"  P50 (Median): {percentile(sorted_times, 50):.0f}")
        print(f"  P95:        {percentile(sorted_times, 95):.0f}") 
        print(f"  P99:        {percentile(sorted_times, 99):.0f}")
        
    print(f"\n⏱️  Total Duration: {duration:.2f}s")
    print(f"📊 Throughput: {total_requests/duration:.2f} req/s")
    print("\n✅ Load test completed!")

# --- Main Execution ---

def main():
    total_requests = TOTAL_REQUESTS
    max_workers = MAX_WORKERS
    
    print(f"\n🚀 Load Test Configuration:")
    print(f"  Endpoint:      {NOTIFICATION_URL}")
    print(f"  Total requests: {total_requests}")
    print(f"  Concurrency:   {max_workers} workers")
    print(f"  Authorization: Using Bearer Token (API Key)")
    print(f"\n⏳ Starting load test... (Output suppressed until summary)\n")
    
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(send_notification_request, range(total_requests))
    
    duration = time.time() - start_time
    
    print_statistics(duration, total_requests)

if __name__ == "__main__":
    main()
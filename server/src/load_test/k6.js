// load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 }, // Ramp up to 50 users
    { duration: "3m", target: 50 }, // Stay at 50 users
    { duration: "1m", target: 100 }, // Ramp up to 100 users
    { duration: "3m", target: 100 }, // Stay at 100 users
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.05"], // Error rate under 5%
  },
};

export default function () {
  // Login request
  const loginRes = http.post(
    "http://localhost:3001/api/v1/admin/auth/login",
    JSON.stringify({
      email: "info@cyberbridgesoft.com",
      password: "Admin@123",
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(loginRes, {
    "login successful": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}

// Run with:
// k6 run load-test.js

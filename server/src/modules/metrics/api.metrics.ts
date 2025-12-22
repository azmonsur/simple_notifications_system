import { Counter, Histogram, Registry } from "prom-client";

// Optionally use a shared registry (so PrometheusModule picks it up)
export const register = new Registry();

// Count total requests per endpoint and method
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Histogram to track response times
export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Error counter
export const httpErrorsTotal = new Counter({
  name: "http_errors_total",
  help: "Total number of failed HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Throttle counter (for rate-limited responses)
export const throttledRequestsTotal = new Counter({
  name: "throttled_requests_total",
  help: "Number of requests blocked by rate limiting",
  labelNames: ["method", "route"],
  registers: [register],
});

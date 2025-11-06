

SCALING: RabbitMQ now uses a topic exchange `notifications.exchange` and routing keys `notifications.<channel>`.
Workers use prefetch and a requeueOrDLQ helper to implement retry/backoff policies.

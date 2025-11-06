Monitoring Guide
- Prometheus scrapes the /metrics endpoint exposed by NestJS (prom-client).
- Use RabbitMQ exporter for Prometheus to expose queue depths and consumer counts.
- Import grafana-dashboard.json into Grafana (Dashboards -> Import).
- Create alerts for:
  - notifications_failed_total spike
  - rabbitmq queue depth > threshold
  - worker error rate > threshold
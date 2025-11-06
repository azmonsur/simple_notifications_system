# Monitoring & Alerts Guide

- Import Grafana dashboard provided.
- Configure Prometheus scrape targets and RabbitMQ exporter.
- Suggested Alert rules:
  - annotations: summary "High failure rate" expr: rate(notifications_failed_total[5m]) > 10
  - queue depth alert: rabbitmq_queue_messages{queue='notifications.delivery'} > 1000
# Deployment Guide (Production)

## Overview
This guide helps deploy the Notification Platform for NIPOST in production. Two deployment options are supported: Kubernetes (recommended) and Docker Compose (quick start).

## Prerequisites
- Container registry (ECR/GCR/DockerHub)
- Kubernetes cluster (EKS/GKE/AKS) or VM with Docker + Docker Compose
- PostgreSQL (managed or self-hosted)
- RabbitMQ (managed or self-hosted)
- Secrets manager (AWS Secrets Manager / Vault) for credentials

## Steps (Kubernetes recommended)
1. Build and push images to registry
2. Create namespace: `kubectl apply -f kubernetes/namespace.yaml`
3. Create secrets: `kubectl create secret generic notif-secrets --from-literal=DATABASE_URL=$DATABASE_URL ...`
4. Apply deployments and services: `kubectl apply -f kubernetes/`
5. Configure HPA and ingress with TLS
6. Run DB migrations and apply indexes
7. Configure Prometheus & Grafana monitoring

## Docker Compose (quick demo)
1. Create env files under `env/` with production values
2. Run: `docker-compose -f docker-compose.prod.yml up -d --build`

## Post-deploy checks
- Health endpoints return 200
- Workers consuming messages; queue depth remains stable
- Test sending a sample notification through webhook
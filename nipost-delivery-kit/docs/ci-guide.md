# CI/CD Guide

- The GitHub Actions workflow builds and tests the server and client on pushes to `main`.
- Configure repository secrets: REGISTRY, IMAGE_NAME, AWS_CREDENTIALS, etc.
- For Kubernetes deploy, add a deploy step using `kubectl` with service account credentials.
- Use image tags for blue/green or canary deployments.
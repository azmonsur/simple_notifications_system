GitHub Actions CI/CD notes:
- Provide secrets: REGISTRY, IMAGE_NAME, AWS credentials, etc.
- Replace client deploy step with your preferred host (Netlify, Vercel, or S3/CloudFront).
- For zero-downtime deployments use rolling updates in Kubernetes or ECS blue/green deployments.
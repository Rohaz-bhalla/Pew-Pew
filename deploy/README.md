# AWS deployment notes

This repository deploys to EC2 with Docker Compose, Nginx, and Amazon ECR. GitHub Actions builds versioned Docker images, pushes them to ECR, then connects to EC2 over SSH to restart the Compose stack.

## EC2 preparation

1. Launch Ubuntu 24.04 LTS EC2. A t3.small is a reasonable starting point for a small demo, but monitor memory; t3.medium provides more headroom. Allow inbound TCP 80 (and 443 after HTTPS setup). Restrict SSH 22 to your own IP.
2. Install Docker Engine and the Docker Compose plugin, AWS CLI v2, and create /opt/pew-pew.
3. Copy docker-compose.yml and nginx/nginx.conf to /opt/pew-pew. Copy deploy/.env.example as /opt/pew-pew/.env, fill real values, and chmod 600 /opt/pew-pew/.env.
4. Attach an EC2 instance profile with AmazonEC2ContainerRegistryReadOnly (or equivalent pull-only permissions).

## GitHub repository variables

- AWS_REGION (e.g. ap-south-1)
- AWS_ACCOUNT_ID
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (public Clerk key)
- NEXT_PUBLIC_API_URL (public site origin, e.g. http://EC2_PUBLIC_DNS)

## GitHub repository secrets

- AWS_ROLE_ARN (OIDC role ARN with ECR push permission)
- EC2_HOST (EC2 public DNS or IP)
- EC2_USER (usually ubuntu)
- EC2_SSH_PRIVATE_KEY (private key used by Actions)

## IAM and ECR

Create private ECR repositories named pew-pew-backend and pew-pew-frontend. Configure the GitHub OIDC provider at https://token.actions.githubusercontent.com with audience sts.amazonaws.com. The role trust policy must restrict sub to this repository and the main branch. For repositories created before 15 July 2026, the typical sub is repo:Rohaz-bhalla/Pew-Pew:ref:refs/heads/main; repositories using immutable subject claims include the numeric owner and repository IDs. Check the actual sub claim format in the GitHub OIDC token if role assumption fails.

Grant the GitHub Actions role ECR push permissions scoped to both repositories plus ecr:GetAuthorizationToken. Configure the EC2 instance role for ECR pull-only access.

## Application configuration

- Frontend NEXT_PUBLIC_* values are embedded during next build. Changing either requires rebuilding the image.
- Browser calls and WebSockets use the public origin; Nginx forwards /api, /ws, and /db-check to the backend.
- Backend environment variables use Spring relaxed binding: SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, SPRING_JPA_HIBERNATE_DDL_AUTO, CLERK_JWKS_URL, APP_CORS_ALLOWED_ORIGIN.
- Keep the production Clerk secret key and Neon credentials only in the EC2 .env file, never in Git.

## HTTPS

Before using this with real users or credentials, configure a domain and TLS (for example, Nginx with Let's Encrypt), and use the matching HTTPS origin for NEXT_PUBLIC_API_URL and Clerk production settings.

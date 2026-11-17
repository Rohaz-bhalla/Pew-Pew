# AWS deployment notes

Pew-Pew deploys to an Ubuntu EC2 instance using Docker Compose, Nginx, and Amazon ECR. GitHub Actions uses GitHub OIDC for short-lived AWS credentials, pushes versioned images to ECR, and invokes the deployment script through AWS Systems Manager (SSM). No SSH key or inbound SSH rule is required by the deployment workflow.

## 1. Create AWS resources

1. Choose an AWS Region (for example, ap-south-1) and note your AWS account ID.
2. Create two **private** ECR repositories named `pew-pew-backend` and `pew-pew-frontend`.
3. Launch an Ubuntu 24.04 LTS EC2 instance. A t3.small is a starting point for a small demo; monitor memory, and use a larger instance if builds/runtime need it.
4. Attach an EC2 instance role with both:
   - `AmazonSSMManagedInstanceCore`
   - `AmazonEC2ContainerRegistryReadOnly`
5. Ensure the SSM Agent is installed and the instance appears as **Online** in Systems Manager > Fleet Manager / Managed nodes. The instance needs outbound access to Systems Manager and ECR endpoints (internet/NAT or suitable VPC endpoints).
6. Configure the EC2 security group to allow inbound TCP 80 and 443. SSH 22 is not needed for this workflow. Keep it closed unless you separately need administrative SSH access.

## 2. Prepare the EC2 instance

Install Docker Engine, the Docker Compose plugin, AWS CLI v2, and Git. Then prepare the deployment directory:

```bash
sudo mkdir -p /opt/pew-pew
sudo chown "$USER":"$USER" /opt/pew-pew
git clone https://github.com/Rohaz-bhalla/Pew-Pew.git /tmp/Pew-Pew
cp /tmp/Pew-Pew/docker-compose.yml /opt/pew-pew/
cp -r /tmp/Pew-Pew/nginx /opt/pew-pew/
cp /tmp/Pew-Pew/deploy/.env.example /opt/pew-pew/.env
chmod 600 /opt/pew-pew/.env
```

Edit `/opt/pew-pew/.env` and fill every value:

- `ECR_REGISTRY`: `AWS_ACCOUNT_ID.dkr.ecr.AWS_REGION.amazonaws.com`
- `SPRING_DATASOURCE_URL`: Neon JDBC URL, for example `jdbc:postgresql://HOST/DB?sslmode=require`
- `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD`: Neon database credentials
- `CLERK_JWKS_URL`: JWKS URL from Clerk Dashboard
- `CLERK_SECRET_KEY`: Clerk secret key
- `APP_CORS_ALLOWED_ORIGIN`: public site origin, with no trailing slash (for example `https://pew-pew.example.com`)

The Compose file sets Hibernate DDL mode to `update`, matching the repository README's expectation that tables are created automatically. Review schema changes carefully before using a production database.

## 3. Configure GitHub OIDC and IAM

Create the GitHub OIDC identity provider in IAM:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

This repository was created on 27 October 2026 and uses GitHub's immutable OIDC subject format. The trust policy example in `github-actions-trust-policy.json.example` is prefilled with this repository's owner and repository IDs. Replace `YOUR_AWS_ACCOUNT_ID` with your account ID, then use it as the IAM role's trust relationship.

Attach an inline permissions policy based on `github-actions-permissions-policy.json.example`. Replace the region, AWS account ID, and EC2 instance ID. It grants ECR push access only to the two Pew-Pew repositories, and SSM command execution only against the specified EC2 instance and the AWS-RunShellScript document.

Create a GitHub Actions IAM role with these trust and permission policies. Put its ARN in the GitHub repository secret `AWS_ROLE_ARN`.

## 4. Configure GitHub repository variables and secrets

In GitHub: Settings > Secrets and variables > Actions.

**Repository variables**

- `AWS_REGION`: selected AWS region, e.g. `ap-south-1`
- `AWS_ACCOUNT_ID`: 12-digit AWS account ID
- `EC2_INSTANCE_ID`: instance ID, e.g. `i-0123456789abcdef0`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key for the deployed instance
- `NEXT_PUBLIC_API_URL`: public origin of the app, e.g. `https://pew-pew.example.com` (or the temporary EC2 HTTP origin while testing)

**Repository secrets**

- `AWS_ROLE_ARN`: ARN of the GitHub Actions IAM role

No AWS access keys, EC2 SSH private key, or SSH credentials are stored in GitHub.

## 5. Deploy

The workflow `.github/workflows/deploy.yml` runs on every push to `main` and can also be started manually with `workflow_dispatch`.

It:
1. Authenticates to AWS using GitHub OIDC.
2. Builds both Docker images and tags them with the commit SHA.
3. Pushes the images to ECR.
4. Runs the deployment commands on the EC2 instance using SSM.
5. Pulls the new images and recreates the Docker Compose services.

The separate `.github/workflows/ci.yml` validates both Docker builds on pull requests into `main`.

## Application routing and configuration

- The browser-facing API URL must be the public website origin, not the Docker-only hostname `backend`.
- Nginx routes `/api/`, `/ws`, and `/db-check` to Spring Boot. Other paths go to Next.js.
- Frontend `NEXT_PUBLIC_*` values are embedded during `next build`; changing either requires a new build/deploy.
- Backend environment variables use Spring relaxed binding: `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SPRING_JPA_HIBERNATE_DDL_AUTO`, `CLERK_JWKS_URL`, and `APP_CORS_ALLOWED_ORIGIN`.
- Keep Neon credentials and the Clerk secret key only in the EC2 `.env` file. Never commit them.

## HTTPS before production

For real users and credentials, configure a domain and HTTPS (for example, Nginx with Let's Encrypt). Set `NEXT_PUBLIC_API_URL` and `APP_CORS_ALLOWED_ORIGIN` to the HTTPS origin, and use the matching Clerk production instance/keys and allowed domains. Do not treat an HTTP EC2 test URL as a production setup.

# ============================================================================
# VOID Cloud IDE - Deployment Documentation
# ============================================================================

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM, 10GB+ disk space
- Domain name (for production)

### One-Click Deployment

```bash
# Clone and enter directory
cd voidspace

# Copy environment template and configure
cp .env.template .env
nano .env  # Edit with your API keys and settings

# Run deployment script
./deploy/deploy.sh
```

That's it! Your VOID Cloud IDE is now running at http://localhost:3000.

## 📁 Project Structure

```
voidspace/
├── deploy/                    # Deployment scripts
│   ├── deploy.sh             # Main deployment script
│   ├── health-check.sh       # Health monitoring
│   ├── rollback.sh           # Rollback to previous version
│   ├── migrate.sh            # Database migrations
│   ├── setup-ssl.sh          # SSL certificate setup
│   ├── cloudrun-service.yaml # Cloud Run config
│   └── terraform/            # GCP IaC
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── .github/workflows/        # CI/CD pipelines
│   ├── ci-cd.yml             # Main pipeline
│   ├── db-migrate.yml        # DB migrations
│   └── monitoring.yml        # Monitoring jobs
├── nginx/                    # Reverse proxy config
│   ├── nginx.conf           # Main config
│   ├── conf.d/              # Site configs
│   └── ssl/                 # SSL certificates
├── monitoring/               # Observability stack
│   ├── prometheus/          # Metrics collection
│   ├── grafana/             # Dashboards
│   ├── loki/                # Log aggregation
│   └── promtail/            # Log collection
├── docker-compose.yml        # Service orchestration
├── Dockerfile               # Container image
├── cloudbuild.yaml          # GCP Cloud Build
└── deploy/init.sql          # Database schema
```

## 🔧 Configuration

### Environment Variables

Copy `.env.template` to `.env` and configure:

```bash
# Required for operation
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Generate strong secrets (32+ chars)
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Optional customization
DOMAIN=yourdomain.com
NODE_ENV=production
```

### SSL/TLS Setup

**Development (self-signed):**
```bash
./deploy/setup-ssl.sh --self-signed
```

**Production (Let's Encrypt):**
```bash
./deploy/setup-ssl.sh --letsencrypt --domain yourdomain.com --email admin@yourdomain.com
```

## 🐳 Docker Services

The `docker-compose.yml` orchestrates:

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | Main Node.js application |
| nginx | 80/443 | Reverse proxy & SSL termination |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Cache & sessions |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Visualization dashboards |
| loki | 3100 | Log aggregation |

### Starting Individual Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d app nginx postgres

# View logs
docker-compose logs -f app

# Stop everything
docker-compose down

# Restart single service
docker-compose restart app
```

## 🔍 Monitoring & Observability

### Health Checks

```bash
# Run comprehensive health check
./deploy/health-check.sh

# Manual API health check
curl http://localhost/api/health

# Detailed health check
curl http://localhost/api/health/detailed
```

### Metrics Dashboard

1. **Grafana:** http://localhost:3001
   - Default login: admin / admin (change immediately)
   - Pre-configured dashboards in `monitoring/grafana/dashboards/`

2. **Prometheus:** http://localhost:9090
   - Query metrics using PromQL
   - Example: `rate(http_requests_total[1m])`

3. **Loki (logs):** http://localhost:3100
   - Query logs via Grafana Explore or Loki API

### Alerts

Configure alerts in `monitoring/grafana/provisioning/` or via Grafana UI.

## 🗄️ Database Management

```bash
# Create new migration
./deploy/migrate.sh create "Add user preferences"

# List migrations (with status)
./deploy/migrate.sh list

# Apply pending migrations
./deploy/migrate.sh apply

# Rollback last migration
./deploy/migrate.sh rollback

# Reset database (WARNING: deletes all data)
./deploy/migrate.sh reset

# View migration status
./deploy/migrate.sh status
```

Database access:
```bash
docker-compose exec postgres psql -U void void
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

**CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)
- Runs on push to main/master
- Executes tests and linter
- Builds Docker image
- Deploys to staging (if tests pass)
- Deploys to production on release

**Database Migrations** (`.github/workflows/db-migrate.yml`)
- Runs on push to migrations folder
- Backs up database before migration
- Applies migrations
- Reports results

**Monitoring** (`.github/workflows/monitoring.yml`)
- Scheduled health checks (every 6 hours)
- Log aggregation
- Alerts on failures

### Manual Deployment

```bash
# Build without cache
./deploy/deploy.sh --no-cache

# Skip build (just restart)
./deploy/deploy.sh --skip-build

# Skip migrations
./deploy/deploy.sh --skip-migrate

# Full redeploy
docker-compose down
./deploy/deploy.sh
```

## ☁️ Cloud Deployment

### Google Cloud Run

1. **Prerequisites:**
   - GCP project created
   - `gcloud` CLI installed and authenticated
   - Docker images pushed to GCR

2. **Deploy with Terraform:**
   ```bash
   cd deploy/terraform
   terraform init
   terraform apply \
     -var="project_id=your-project" \
     -var="container_image=gcr.io/your-project/void-cloud-ide:latest"
   ```

3. **Or deploy manually:**
   ```bash
   gcloud run deploy void-cloud-ide \
     --image gcr.io/your-project/void-cloud-ide:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --set-secrets ANTHROPIC_API_KEY=void-api-keys:latest
   ```

### Auto-Scaling Configuration

Cloud Run auto-scaling parameters:
- `min-instances`: 1 (warm start)
- `max-instances`: 100 (scale limit)
- `concurrency`: 50 (requests per container)

Tune these based on your workload and budget.

## 🎯 Rollback Strategy

### Quick Rollback (stop/start)
```bash
./deploy/rollback.sh --quick
```

### Snapshot & Restore
```bash
# Create snapshot before update
./deploy/rollback.sh --create-snapshot pre-update-$(date +%Y%m%d)

# List available snapshots
./deploy/rollback.sh --list

# Restore from snapshot
./deploy/rollback.sh --restore pre-update-20240101
```

Snapshots include:
- Database backup
- Volume contents
- Docker image digests
- Git commit hash

## 📊 Metrics Reference

### Application Metrics

- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request duration histogram
- `active_connections` - Active WebSocket connections
- `colab_sessions_active` - Active Colab sessions
- `code_executions_total` - Total code executions
- `ai_requests_total` - AI API calls
- `users_online` - Currently online users

### System Metrics

- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_eventloop_lag_seconds` - Event loop latency

## 🔐 Security

### Network Security
- All internal traffic on Docker bridge network
- External traffic goes through Nginx
- Rate limiting enabled (10 req/s for API, 100 for WebSocket)

### Secrets Management
- Use Docker secrets or GCP Secret Manager
- Never commit `.env` to git
- Rotate secrets regularly

### Database Security
- Strong passwords
- RLS (Row Level Security) enabled
- Limited connection pooling

### Container Security
- Non-root user (`nodejs`)
- Read-only filesystem where possible
- Minimal base image (`node:20-alpine`)
- Regular security updates

## 🚨 Troubleshooting

### Common Issues

**1. Port already in use**
```bash
# Check what's using port 3000
lsof -i :3000
# Or change APP_PORT in .env
```

**2. Container keeps restarting**
```bash
# View logs
docker-compose logs app

# Common causes:
# - Missing environment variables
# - Database not accessible
# - Port already in use
```

**3. Database connection refused**
```bash
# Check postgres status
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Reset database
./deploy/migrate.sh reset
```

**4. SSL certificate issues**
```bash
# Verify certificate
openssl x509 -in /workspace/voidspace/nginx/ssl/fullchain.pem -text -noout

# Regenerate self-signed
./deploy/setup-ssl.sh --self-signed
```

**5. Out of memory**
```bash
# Increase Docker memory limit in Docker Desktop settings
# Or adjust in docker-compose.yml:
# deploy.resources.limits.memory: 8G
```

### Debug Mode

Enable verbose logging:
```bash
# Edit .env
DEBUG=*
LOG_LEVEL=debug

# Restart services
docker-compose restart
```

### Getting Help

1. Check logs: `docker-compose logs -f`
2. Run health check: `./deploy/health-check.sh`
3. Consult metrics in Grafana
4. Open an issue with logs attached

## 📈 Scaling

### Horizontal Scaling

**Multiple app instances (Docker Compose):**
```yaml
# docker-compose.yml
services:
  app:
    # ... existing config
    deploy:
      replicas: 3
```

**Kubernetes:** See `deploy/kubernetes/` (future)

### Vertical Scaling

Increase resources in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
```

### Database Scaling

- Add read replicas
- Use connection pooling (PgBouncer)
- Enable query caching
- Consider Cloud SQL for managed service

### CDN for Static Assets

Configure CloudFlare or similar:
- Cache static assets aggressively
- Enable HTTP/2 and Brotli
- Set up WAF rules

## 🔄 Updates & Maintenance

### Routine Updates

1. Pull latest code
2. Create backup snapshot: `./deploy/rollback.sh --create-snapshot`
3. Run migrations: `./deploy/migrate.sh apply`
4. Deploy: `./deploy/deploy.sh --skip-build`
5. Run health check: `./deploy/health-check.sh`
6. Monitor for 24h

### Backup Strategy

Automated backups:
```bash
# Database backup (daily cron)
0 2 * * * cd /workspace/voidspace && ./deploy/migrate.sh backup > /dev/null 2>&1

# Volume snapshots (weekly)
0 3 * * 0 docker run --rm -v void_postgres-data:/data -v /backups/void:/backup alpine tar czf /backup/postgres-weekly-$(date +%Y%m%d).tar.gz /data
```

### Log Rotation

Logs are automatically rotated by Docker and Promtail.
To manually clean old logs:
```bash
find logs/ -type f -mtime +30 -delete
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/)
- [Cloud Run Best Practices](https://cloud.google.com/run/docs/best-practices)

## 📄 License

See project LICENSE file.

---

**Last Updated:** 2026-04-29
**Version:** 1.0.0

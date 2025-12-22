# Staging Environment & Deployment Setup

This document describes the staging and production environment setup.

## Quick Start

### Automated Deployment (Recommended)

Deployments are now **fully automated** via GitHub Actions:

- **Push to `develop`** → Auto-deploys to staging
- **Push to `main`** → Auto-deploys to production

See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for complete details.

### Manual Deployment (Legacy)

If you need to deploy manually (not recommended):

```bash
# Deploy to Staging
npm run deploy:staging

# Deploy to Production
npm run deploy:production
```

**Note**: Manual deployments require SSH access and are only for emergency situations. All regular deployments should use the automated GitHub Actions workflow.

### Build for TestFlight (iOS - Staging)
```bash
npm run cap:ios:staging
```

### Build for App Store (iOS - Production)
```bash
npm run cap:ios:prod
```

---

## Environment Configuration

| Environment | Domain | Directory | Env File |
|-------------|--------|-----------|----------|
| Development | localhost:5175 | local | `.env` |
| Staging | staging.slushdating.com | /var/www/slush-staging | `.env.staging` |
| Production | app.slushdating.com | /var/www/slush-prod | `.env.production` |

### Environment Variables

```env
# Required for all environments
VITE_ENV=staging | production | development
VITE_APP_URL=https://staging.slushdating.com
VITE_API_URL=https://staging.slushdating.com/api
```

---

## First-Time VPS Setup

### 1. Create DNS Records
Add A records pointing to `80.190.80.106`:
- `staging.slushdating.com`
- `app.slushdating.com`

### 2. Run VPS Setup Script
```bash
scp deploy/vps-setup.sh root@80.190.80.106:/tmp/ && \
ssh root@80.190.80.106 "chmod +x /tmp/vps-setup.sh && /tmp/vps-setup.sh"
```

### 3. Install Nginx Configs
```bash
# Upload configs
scp deploy/nginx-staging.conf root@80.190.80.106:/etc/nginx/sites-available/staging-slushdating-com
scp deploy/nginx-production.conf root@80.190.80.106:/etc/nginx/sites-available/app-slushdating-com

# Enable sites (on VPS)
ssh root@80.190.80.106
ln -sf /etc/nginx/sites-available/staging-slushdating-com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/app-slushdating-com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 4. Get SSL Certificates
```bash
# On VPS, after DNS propagation
certbot --nginx -d staging.slushdating.com
certbot --nginx -d app.slushdating.com
```

---

## Capacitor / TestFlight

TestFlight builds **always point to staging** by default.

| Script | Environment | Hostname |
|--------|-------------|----------|
| `npm run cap:ios:staging` | Staging | staging.slushdating.com |
| `npm run cap:ios:prod` | Production | app.slushdating.com |

The Capacitor hostname is controlled by the `CAPACITOR_HOSTNAME` environment variable.

---

## Automated CI/CD

### GitHub Actions Workflows

- **`.github/workflows/deploy-staging.yml`** - Deploys on push to `develop`
- **`.github/workflows/deploy-production.yml`** - Deploys on push to `main`

### Required GitHub Secrets

Configure these in your repository settings (`Settings` → `Secrets and variables` → `Actions`):

- `VPS_HOST` - VPS IP address (e.g., `80.190.80.106`)
- `VPS_USER` - SSH username (e.g., `root`)
- `VPS_PASSWORD` - SSH password

### Deployment Process

1. **Frontend**: Always deployed (React app built and uploaded)
2. **Backend**: Only deployed if `server/` directory files changed
3. **PM2 Restart**: Automatic if server code changed
4. **No nginx restart**: Not needed for app updates

See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for complete workflow documentation.

## Troubleshooting

### Check Deployment Status

View GitHub Actions logs:
1. Go to `Actions` tab in GitHub
2. Select the workflow run
3. Review logs for errors

### Check VPS Status
```bash
ssh root@80.190.80.106 "pm2 status && nginx -t"
```

### View Logs
```bash
ssh root@80.190.80.106 "pm2 logs slush-server --lines 50"
```

### Test Staging
```bash
curl -I https://staging.slushdating.com
```

### Deployment Failed

1. Check GitHub Actions logs for error messages
2. Verify GitHub Secrets are configured correctly
3. Check VPS connectivity: `ping 80.190.80.106`
4. Verify PM2 is running: `ssh root@80.190.80.106 "pm2 status"`

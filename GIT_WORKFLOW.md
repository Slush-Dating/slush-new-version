# Git Workflow & CI/CD Setup

This document describes the git workflow and automated deployment setup for the Slush Dating app.

## Branch Strategy

### Branches

- **`develop`** → Auto-deploys to **staging** environment
- **`main`** → Auto-deploys to **production** environment

### Workflow Rules

1. **Push to `develop`** → Automatically deploys to `staging.slushdating.com`
2. **Push to `main`** → Automatically deploys to `app.slushdating.com`
3. **No manual SSH** required for deployments
4. **No manual nginx restarts** required for app updates

## Development Workflow

### Daily Development

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "feat: your feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request to develop
# After PR is merged, staging will auto-deploy
```

### Deploying to Staging

```bash
# Merge your feature branch into develop
git checkout develop
git pull origin develop
git merge feature/your-feature-name
git push origin develop

# GitHub Actions will automatically:
# 1. Build the React app for staging
# 2. Upload to VPS at /var/www/slush-staging
# 3. Restart PM2 if server code changed
# 4. Deploy complete within minutes
```

### Deploying to Production

```bash
# Merge develop into main (after testing on staging)
git checkout main
git pull origin main
git merge develop
git push origin main

# GitHub Actions will automatically:
# 1. Build the React app for production
# 2. Upload to VPS at /var/www/slush-prod
# 3. Restart PM2 if server code changed
# 4. Deploy complete within minutes
```

## GitHub Actions Setup

### Required Secrets

Configure these secrets in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `VPS_HOST` | VPS IP address or hostname | `80.190.80.106` |
| `VPS_USER` | SSH username | `root` |
| `VPS_PASSWORD` | SSH password | `your-password` |

### Adding Secrets

1. Go to your GitHub repository
2. Navigate to `Settings` → `Secrets and variables` → `Actions`
3. Click `New repository secret`
4. Add each secret listed above

### Workflow Files

- **`.github/workflows/deploy-staging.yml`** - Deploys on push to `develop`
- **`.github/workflows/deploy-production.yml`** - Deploys on push to `main`

## What Gets Deployed

### Frontend (Always)
- React app built for the target environment
- Uploaded to `/var/www/slush-staging` (staging) or `/var/www/slush-prod` (production)

### Backend (Conditional)
- Server code is only deployed if files in `server/` directory changed
- If server code changed:
  - Server files are uploaded
  - Dependencies are installed
  - PM2 process is restarted

## Deployment Process

### Automatic Steps

1. **Code Checkout** - GitHub Actions checks out your code
2. **Install Dependencies** - Runs `npm ci` to install dependencies
3. **Build** - Builds React app with environment-specific config
4. **Detect Changes** - Checks if server code changed
5. **Deploy Frontend** - Uploads `dist/` folder to VPS
6. **Deploy Backend** (if changed) - Uploads server code and restarts PM2
7. **Verify** - Confirms deployment success

### Manual Trigger

You can also trigger deployments manually:

1. Go to `Actions` tab in GitHub
2. Select the workflow (`Deploy to Staging` or `Deploy to Production`)
3. Click `Run workflow`
4. Select the branch and click `Run workflow`

## Staging Rules

Staging must:

✅ **Behave exactly like production**
- Same environment variables structure
- Same build process
- Same deployment process

✅ **Surface production bugs before production**
- All features tested on staging first
- If it works on staging, it should work on production

✅ **If something breaks in production but not staging, the setup is considered failed**
- Staging must mirror production exactly
- Any discrepancies indicate a configuration issue

## Definition of Done

✅ **I can push code and see it live on staging within minutes**
- Push to `develop` → Auto-deploy to staging
- Deployment completes in 2-5 minutes typically

✅ **I never manually SSH to deploy**
- All deployments via GitHub Actions
- SSH only used for infrastructure changes

✅ **I never restart nginx for app updates**
- Nginx configuration is static
- Only file uploads, no nginx restarts needed

✅ **TestFlight always points to staging**
- iOS builds use `npm run cap:ios:staging`
- TestFlight builds connect to `staging.slushdating.com`

✅ **Production deployments are boring and predictable**
- Same process every time
- No surprises
- Automated and reliable

## Troubleshooting

### Deployment Failed

1. **Check GitHub Actions logs**
   - Go to `Actions` tab
   - Click on the failed workflow run
   - Review error messages

2. **Common Issues**
   - **Build failed**: Check for TypeScript/ESLint errors
   - **Upload failed**: Verify VPS credentials in secrets
   - **PM2 restart failed**: Check if server is running on VPS

### Server Not Restarting

If server code changed but PM2 didn't restart:

```bash
# Check PM2 status on VPS
ssh root@80.190.80.106 "pm2 status"

# Manually restart if needed
ssh root@80.190.80.106 "pm2 restart slush-server"
```

### Frontend Not Updating

If frontend changes aren't visible:

1. Check deployment logs in GitHub Actions
2. Verify files were uploaded: `ssh root@80.190.80.106 "ls -la /var/www/slush-staging"`
3. Clear browser cache
4. Check nginx is serving the correct directory

## Best Practices

1. **Always test on staging first**
   - Merge to `develop` and verify on staging
   - Only merge to `main` after staging verification

2. **Use meaningful commit messages**
   - Follow conventional commits: `feat:`, `fix:`, `docs:`, etc.

3. **Keep branches up to date**
   - Regularly pull latest `develop` into your feature branches
   - Resolve conflicts early

4. **Monitor deployments**
   - Watch GitHub Actions for deployment status
   - Verify deployments on staging/production URLs

5. **Never commit secrets**
   - Use GitHub Secrets for sensitive data
   - Never commit `.env` files or passwords

## Environment URLs

- **Staging**: https://staging.slushdating.com
- **Production**: https://app.slushdating.com

## Quick Reference

```bash
# Deploy to staging
git checkout develop
git pull origin develop
git push origin develop
# Wait for GitHub Actions to deploy

# Deploy to production
git checkout main
git pull origin main
git merge develop
git push origin main
# Wait for GitHub Actions to deploy
```


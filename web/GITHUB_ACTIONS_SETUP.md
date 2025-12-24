# GitHub Actions Setup Guide

This repository uses GitHub Actions to automatically deploy code when you push to specific branches, similar to how Vercel works.

## How It Works

- **Push to `develop` branch** → Automatically deploys to staging environment
- **Push to `main` branch** → Automatically deploys to production environment

## Required GitHub Secrets

You need to set up the following secrets in your GitHub repository for the workflows to work:

### Steps to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

### Required Secrets

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `VPS_HOST` | Your VPS server IP address | `80.190.80.106` |
| `VPS_USER` | SSH username for your VPS | `root` |
| `VPS_PASSWORD` | SSH password for your VPS | `YourPassword123!` |

⚠️ **Important**: Never commit passwords or secrets to your repository. Always use GitHub Secrets.

## What Gets Deployed

### Frontend (React App)
- Built React app from `dist/` folder
- Deployed to `/root/slush-app/dist/` on the server
- Served at `https://www.slushdating.com/app`

### Backend (Node.js Server)
- Server code from `server/` folder
- Only deployed if server files changed (optimised)
- Deployed to `/root/slush-app/server/` on the server
- PM2 automatically restarts the server

### Nginx Configuration
- Nginx config file is deployed and applied
- Nginx is restarted automatically

## Deployment Process

When you push code:

1. ✅ Code is checked out
2. ✅ Dependencies are installed
3. ✅ React app is built
4. ✅ Frontend files are uploaded to server
5. ✅ Server code is uploaded (if changed)
6. ✅ Nginx config is applied
7. ✅ PM2 services are restarted
8. ✅ Deployment is verified

## Testing the Setup

### Test Staging Deployment
```bash
git checkout develop
# Make a small change
git add .
git commit -m "Test staging deployment"
git push origin develop
```

Then check the **Actions** tab in GitHub to see the deployment progress.

### Test Production Deployment
```bash
git checkout main
git merge develop  # or pull latest changes
git push origin main
```

Then check the **Actions** tab in GitHub to see the deployment progress.

## Troubleshooting

### Workflow Fails
1. Check the **Actions** tab in GitHub for error messages
2. Verify all secrets are set correctly
3. Ensure your VPS is accessible from the internet
4. Check that PM2 services exist on the server (`slush-server` and `slush-website`)

### Server Not Updating
- Check if server files actually changed (workflow only deploys server if files changed)
- Verify PM2 is running: `pm2 list`
- Check server logs: `pm2 logs slush-server`

### Frontend Not Updating
- Verify files were uploaded: `ls -la /root/slush-app/dist/`
- Check nginx is running: `sudo systemctl status nginx`
- Clear browser cache

## Manual Deployment (Fallback)

If GitHub Actions fails, you can still deploy manually using the commands in `.deploy-commands.sh`:

```bash
./.deploy-commands.sh
```

## Security Notes

- All secrets are encrypted by GitHub
- Secrets are only available to workflows, never exposed in logs
- Use strong passwords for your VPS
- Consider using SSH keys instead of passwords (more secure)


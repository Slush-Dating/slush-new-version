# 🚀 Deployment Guide - www.slushdating.com

## Quick Deploy

When you need to deploy updates to production:

1. **View deployment commands:**
   ```bash
   ./.deploy-commands.sh
   ```

2. **Run the commands manually** (copy-paste from the output above)

3. **Test the deployment:**
   ```bash
   curl -k -s -I https://www.slushdating.com/api/events  # Should return HTTP/2 200
   ```

## What's Deployed

- **React App** (`/app`) - Built from `src/`
- **API** (`/api`) - Node.js backend
- **Admin Panel** (`/admin`) - Redirects to `/app/admin`

## ⚠️  IMPORTANT: Marketing Site Protection

**The marketing site at `www.slushdating.com` (`/`) is SEPARATE and must NEVER be overwritten.**

- The marketing site is served from `/root/slush-app/marketing/` on the server
- **DO NOT** deploy the `marketing/` folder from this repository
- Only deploy proxies (`/app`, `/api`, `/admin`) - never touch the marketing directory
- The `marketing/` folder in this repo is for reference only, not for deployment

## Security

- Deployment commands are stored in `.deploy-commands.sh` (gitignored)
- Never commit passwords or sensitive data
- SSL certificates auto-renew via Let's Encrypt

## Emergency Contacts

- VPS Provider: Contabo (support@contabo.com)
- Server IP: 80.190.80.106
- Domains: www.slushdating.com, slushdating.com



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
- **Marketing Site** (`/`) - Static HTML from `marketing/`
- **API** (`/api`) - Node.js backend
- **Admin Panel** (`/admin`) - Redirects to `/app/admin`

## Security

- Deployment commands are stored in `.deploy-commands.sh` (gitignored)
- Never commit passwords or sensitive data
- SSL certificates auto-renew via Let's Encrypt

## Emergency Contacts

- VPS Provider: Contabo (support@contabo.com)
- Server IP: 80.190.80.106
- Domains: www.slushdating.com, slushdating.com

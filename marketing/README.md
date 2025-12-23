# ⚠️  DO NOT DEPLOY THIS FOLDER

This `marketing/` folder is for **reference only** and must **NEVER** be deployed to the server.

## Why?

The marketing site at `www.slushdating.com` is served from `/root/slush-app/marketing/` on the server and is **separately managed**. Deploying this folder would overwrite the live marketing site.

## What Should Be Deployed?

Only deploy:
- `/app` - React application (from `dist/` folder)
- `/api` - Backend API (from `server/` folder)
- `/admin` - Admin panel (redirects to `/app/admin`)

## What Should NOT Be Deployed?

- ❌ **`marketing/` folder** - This will overwrite `www.slushdating.com`
- ❌ Never run: `scp -r marketing/* root@server:/root/slush-app/marketing/`

## Deployment Commands

When deploying to `www.slushdating.com`, only deploy:
```bash
# ✅ CORRECT - Deploy app only
scp -r dist/* root@server:/root/slush-app/dist/

# ❌ WRONG - Never deploy marketing
# scp -r marketing/* root@server:/root/slush-app/marketing/
```

The marketing site is managed separately and should never be touched by this codebase's deployment process.




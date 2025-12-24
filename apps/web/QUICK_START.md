# Quick Start Guide - VPS Setup

## What You're Setting Up

- ✅ `www.slushdating.com` → VPS (marketing website)
- ✅ `www.slushdating.com/app` → VPS (React app)
- ✅ `www.slushdating.com/api` → VPS (backend API)
- ✅ `www.slushdating.com/admin` → VPS (admin panel)

---

## VPS Setup

1. **Update nginx config**: Copy `nginx-config-www-slushdating-com.conf` to your VPS
2. **Get SSL certificate** for `www.slushdating.com` and `slushdating.com`
3. **Restart nginx**

📖 **Detailed instructions**: See `WWW_SLUSHDATING_SETUP.md`

---

## Test URLs

After setup, test these:

- `https://www.slushdating.com` → Marketing website
- `https://www.slushdating.com/app` → React app
- `https://www.slushdating.com/api/events` → API
- `https://www.slushdating.com/admin` → Admin panel

---

## Need Help?

- **VPS issues**: Check `WWW_SLUSHDATING_SETUP.md`
- **General questions**: See `PROXY_SETUP_SUMMARY.md`




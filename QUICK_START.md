# Quick Start Guide - Vercel + VPS Setup

## What You're Setting Up

- ✅ `www.slushdating.com` → Vercel (your website - already working)
- ✅ `www.slushdating.com/app` → VPS (React app)
- ✅ `www.slushdating.com/api` → VPS (backend API)
- ✅ `www.slushdating.com/admin` → VPS (admin panel)

---

## Two Simple Steps

### Step 1: Vercel (5 minutes)

1. **Make sure `vercel.json` is in your project root** ✅ (already done)
2. **Deploy to Vercel**:
   - Push to Git, OR
   - Redeploy in Vercel dashboard
3. **Done!** Routes will work automatically

📖 **Detailed instructions**: See `VERCEL_SETUP_INSTRUCTIONS.md`

---

### Step 2: VPS (10 minutes)

1. **Add DNS record**: `app.slushdating.com` → `80.190.80.106`
2. **Update nginx** to accept `app.slushdating.com`
3. **Get SSL certificate** for `app.slushdating.com`
4. **Restart nginx**

📖 **Detailed instructions**: See `VPS_SETUP_FOR_VERCEL.md`

---

## Test URLs

After setup, test these:

- `https://www.slushdating.com` → Your website
- `https://www.slushdating.com/app` → React app
- `https://www.slushdating.com/api/events` → API
- `https://www.slushdating.com/admin` → Admin panel

---

## Need Help?

- **Vercel issues**: Check `VERCEL_SETUP_INSTRUCTIONS.md`
- **VPS issues**: Check `VPS_SETUP_FOR_VERCEL.md`
- **General questions**: See `VERCEL_ROUTING_SETUP.md`



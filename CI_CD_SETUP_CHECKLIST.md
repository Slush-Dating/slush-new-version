# CI/CD Setup Checklist

Complete this checklist to enable automated deployments.

## ✅ Pre-Setup Requirements

- [ ] VPS is set up and accessible
- [ ] Staging domain (`staging.slushdating.com`) is configured
- [ ] Production domain (`app.slushdating.com`) is configured
- [ ] Nginx configs are installed on VPS
- [ ] SSL certificates are installed
- [ ] PM2 is running the server (`slush-server`)

## ✅ GitHub Repository Setup

### 1. Configure GitHub Secrets

- [ ] Go to repository **Settings** → **Secrets and variables** → **Actions**
- [ ] Add `VPS_HOST` secret (e.g., `80.190.80.106`)
- [ ] Add `VPS_USER` secret (e.g., `root`)
- [ ] Add `VPS_PASSWORD` secret (your actual password)

See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for detailed instructions.

### 2. Verify Branch Structure

- [ ] `develop` branch exists (for staging deployments)
- [ ] `main` branch exists (for production deployments)
- [ ] Workflow files are committed:
  - [ ] `.github/workflows/deploy-staging.yml`
  - [ ] `.github/workflows/deploy-production.yml`

## ✅ Test Staging Deployment

1. [ ] Make a small change (e.g., update README)
2. [ ] Commit and push to `develop` branch:
   ```bash
   git checkout develop
   git add .
   git commit -m "test: verify staging deployment"
   git push origin develop
   ```
3. [ ] Go to **Actions** tab in GitHub
4. [ ] Watch the "Deploy to Staging" workflow run
5. [ ] Verify deployment succeeds (green checkmark)
6. [ ] Check staging site: https://staging.slushdating.com
7. [ ] Verify your changes are live

## ✅ Test Production Deployment

**Only after staging works!**

1. [ ] Merge `develop` into `main`:
   ```bash
   git checkout main
   git pull origin main
   git merge develop
   git push origin main
   ```
2. [ ] Go to **Actions** tab in GitHub
3. [ ] Watch the "Deploy to Production" workflow run
4. [ ] Verify deployment succeeds (green checkmark)
5. [ ] Check production site: https://app.slushdating.com
6. [ ] Verify your changes are live

## ✅ Verify Automated Features

### Frontend Deployment
- [ ] Push to `develop` → Frontend updates on staging
- [ ] Push to `main` → Frontend updates on production

### Backend Deployment
- [ ] Make a change in `server/` directory
- [ ] Push to `develop`
- [ ] Verify PM2 restarts automatically
- [ ] Check server logs: `ssh root@80.190.80.106 "pm2 logs slush-server"`

### No Manual Steps Required
- [ ] No SSH needed for deployments ✅
- [ ] No nginx restart needed ✅
- [ ] No manual file uploads ✅

## ✅ Definition of Done Checklist

- [ ] ✅ I can push code and see it live on staging within minutes
- [ ] ✅ I never manually SSH to deploy
- [ ] ✅ I never restart nginx for app updates
- [ ] ✅ TestFlight always points to staging
- [ ] ✅ Production deployments are boring and predictable

## 🐛 Troubleshooting

If something doesn't work:

1. **Check GitHub Actions logs**
   - Go to **Actions** tab
   - Click on failed workflow
   - Review error messages

2. **Verify Secrets**
   - Check secrets are configured correctly
   - Test SSH manually: `ssh root@80.190.80.106`

3. **Check VPS Status**
   ```bash
   ssh root@80.190.80.106 "pm2 status && nginx -t"
   ```

4. **Review Documentation**
   - [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Complete workflow guide
   - [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Secrets setup
   - [STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md) - Deployment details

## 📚 Documentation Reference

- **[GIT_WORKFLOW.md](./GIT_WORKFLOW.md)** - Complete git workflow and CI/CD guide
- **[GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)** - How to configure GitHub Secrets
- **[STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md)** - Staging and production setup

## 🎉 Success!

Once all checkboxes are complete, you have:
- ✅ Automated deployments on push
- ✅ Staging environment for testing
- ✅ Production deployments via GitHub Actions
- ✅ No manual SSH required
- ✅ Predictable, boring deployments

**You're all set!** Just push to `develop` or `main` and watch the magic happen. 🚀


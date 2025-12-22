# GitHub Secrets Setup Guide

This guide explains how to configure GitHub Secrets for automated deployments.

## Required Secrets

You need to configure these secrets in your GitHub repository for the CI/CD workflows to function:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `VPS_HOST` | Your VPS IP address or hostname | `80.190.80.106` |
| `VPS_USER` | SSH username for VPS access | `root` |
| `VPS_PASSWORD` | SSH password for VPS access | `your-actual-password` |

## Setup Instructions

### Step 1: Access Repository Settings

1. Go to your GitHub repository
2. Click on **Settings** (top navigation bar)
3. In the left sidebar, click **Secrets and variables** → **Actions**

### Step 2: Add Each Secret

For each secret listed above:

1. Click **New repository secret**
2. Enter the **Name** exactly as shown (case-sensitive)
3. Enter the **Secret** value
4. Click **Add secret**

### Step 3: Verify Secrets

After adding all secrets, you should see:
- ✅ `VPS_HOST`
- ✅ `VPS_USER`
- ✅ `VPS_PASSWORD`

## Security Best Practices

⚠️ **Important Security Notes:**

1. **Never commit secrets to git**
   - Secrets are encrypted by GitHub
   - Only accessible to GitHub Actions workflows
   - Not visible in logs (they're masked)

2. **Use strong passwords**
   - Your VPS password should be strong and unique
   - Consider using SSH keys instead of passwords (future enhancement)

3. **Limit access**
   - Only repository collaborators with admin access can view/edit secrets
   - Review who has access to your repository

   DA49-D5B7

4. **Rotate secrets regularly**
   - Change passwords periodically
   - Update secrets if compromised

## Testing the Setup

After configuring secrets:

1. **Push to `develop` branch** to test staging deployment
2. Go to **Actions** tab in GitHub
3. Watch the workflow run
4. Verify deployment succeeds

If deployment fails:
- Check workflow logs for errors
- Verify secrets are spelled correctly
- Ensure VPS is accessible from the internet
- Check that SSH credentials are correct

## Troubleshooting

### "Secret not found" Error

- Verify secret names match exactly (case-sensitive)
- Ensure secrets are added to the correct repository
- Check you're using the right secret name in the workflow

### "Connection refused" Error

- Verify `VPS_HOST` is correct
- Check VPS firewall allows SSH (port 22)
- Ensure VPS is running and accessible

### "Authentication failed" Error

- Verify `VPS_USER` and `VPS_PASSWORD` are correct
- Test SSH connection manually: `ssh root@80.190.80.106`
- Check if password has special characters that need escaping

### "Permission denied" Error

- Verify user has write access to deployment directories
- Check directory permissions on VPS
- Ensure PM2 is accessible to the user

## Manual Testing

Test SSH connection manually:

```bash
# Test connection
ssh root@80.190.80.106

# Test password (if using password auth)
# You'll be prompted for password
```

If manual SSH works but GitHub Actions fails:
- Check GitHub Actions logs for specific error
- Verify secrets are configured correctly
- Ensure VPS allows connections from GitHub Actions IPs

## Next Steps

After setting up secrets:

1. ✅ Push a test commit to `develop` branch
2. ✅ Watch GitHub Actions deploy to staging
3. ✅ Verify staging site updates
4. ✅ Read [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for workflow details

## Support

If you encounter issues:
1. Check GitHub Actions logs
2. Review [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)
3. Verify VPS connectivity
4. Test secrets manually


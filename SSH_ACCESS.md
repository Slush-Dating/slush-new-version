# SSH Access to Slush Dating Server

This guide explains how to set up and use SSH access to the staging server at `80.190.80.106`.

## Server Details

- **Host**: `80.190.80.106`
- **User**: `root`
- **Purpose**: Staging environment for `staging.slushdating.com`

## Prerequisites

### Install sshpass

**macOS**:
```bash
brew install hudochenkov/sshpass/sshpass
```

**Ubuntu/Debian**:
```bash
sudo apt update && sudo apt install sshpass
```

**CentOS/RHEL**:
```bash
sudo yum install sshpass
```

## Setup

1. **Run the setup script**:
   ```bash
   ./setup-ssh.sh
   ```

2. **Edit the environment file**:
   ```bash
   nano ssh-env.sh
   ```
   Or use VS Code:
   ```bash
   code ssh-env.sh
   ```

3. **Set your server password** in `ssh-env.sh`:
   ```bash
   export VPS_PASSWORD="your_actual_server_password"
   ```

4. **Load the environment variables**:
   ```bash
   source ssh-env.sh
   ```

## Usage

### Interactive SSH Session
```bash
./ssh-to-server.sh
```

### Run Commands Remotely
```bash
# Check server status
./ssh-to-server.sh 'pm2 status'

# View server logs
./ssh-to-server.sh 'pm2 logs slush-server-staging'

# Check disk usage
./ssh-to-server.sh 'df -h'

# Restart services
./ssh-to-server.sh 'sudo systemctl restart nginx'
```

### Useful Server Commands

```bash
# Check PM2 processes
pm2 list
pm2 status
pm2 logs slush-server-staging

# Nginx commands
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t

# System monitoring
htop
df -h
free -h

# View logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## Troubleshooting

### Connection Refused
- Check if the server is accessible: `ping 80.190.80.106`
- Verify your password is correct
- Ensure SSH service is running on the server

### Permission Denied
- Double-check your password in `ssh-env.sh`
- Make sure you're using the correct username (`user`)

### sshpass Not Found
- Install sshpass as shown in Prerequisites
- Restart your terminal after installation

## Security Notes

- Never commit `ssh-env.sh` to version control
- Use strong passwords
- Consider using SSH keys instead of passwords for better security
- The `.gitignore` file should exclude `ssh-env.sh`

## File Structure

```
├── ssh-to-server.sh          # Main SSH connection script
├── setup-ssh.sh             # Setup and testing script
├── ssh-env-example.sh       # Environment template
└── ssh-env.sh               # Your personal environment file (create from template)
```

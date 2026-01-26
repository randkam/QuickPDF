# CI/CD Setup for Existing EC2 Instance

Quick guide to connect your existing EC2 instance to GitHub Actions for automated deployments.

## Prerequisites

✅ You have an EC2 instance running  
✅ QuickPDF is deployed on EC2  
✅ You have SSH access to the instance  
✅ Docker and Docker Compose are installed  

---

## Step 1: Prepare Your EC2 Instance (5 min)

SSH into your EC2 instance and make sure everything is ready:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### 1.1 Verify Your Setup

```bash
# Check Docker is installed
docker --version

# Check Docker Compose is installed
docker compose version

# Navigate to your app directory
cd /home/ubuntu/quickpdf
# (or wherever your app is located)

# Verify git is set up
git remote -v
```

### 1.2 Set Up Git Repository

If your code isn't already in a git repo on EC2:

```bash
# If not already initialized
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Or if already initialized, just pull latest
git pull origin main
```

### 1.3 Verify Docker Compose File

Make sure your `docker-compose.prod.yml` exists in the app directory:

```bash
ls -la docker-compose.prod.yml
```

### 1.4 Test Your Current Deployment

```bash
# Make sure your app runs with docker-compose
docker compose -f docker-compose.prod.yml ps

# Should show running containers
```

---

## Step 2: Configure GitHub Secrets (3 min)

Go to your GitHub repository:  
`Settings → Secrets and variables → Actions → New repository secret`

Add these **5 secrets**:

### Required Secrets:

| Secret Name | How to Get It | Example |
|------------|---------------|---------|
| **EC2_SSH_PRIVATE_KEY** | Copy contents of your `.pem` file:<br>`cat your-key.pem` | Entire key including<br>`-----BEGIN ... END-----` |
| **EC2_HOST** | Your EC2 public IP or domain | `54.123.45.67` or<br>`api.yourdomain.com` |
| **EC2_USER** | SSH user (usually `ubuntu` or `ec2-user`) | `ubuntu` |
| **SECRET_KEY** | Your Flask secret key from `.env` | Random string |
| **CORS_ORIGINS** | Your frontend domain(s) | `https://yourdomain.com` |

### Get Your EC2 Private Key:

```bash
# On your local machine
cat /path/to/your-key.pem
```

Copy the **entire output** (including BEGIN/END lines) and paste as `EC2_SSH_PRIVATE_KEY`

---

## Step 3: Update EC2 Security Group (2 min)

Your EC2 security group needs to allow SSH from GitHub Actions servers.

**Option A: Allow GitHub IPs (More Secure)**
1. Go to EC2 → Security Groups
2. Find your instance's security group
3. Edit Inbound Rules → SSH (22)
4. Add GitHub Actions IP ranges from: https://api.github.com/meta
   - Look for `actions` IPs

**Option B: Allow All IPs (Easier, Less Secure)**
1. Edit SSH rule to allow `0.0.0.0/0`
2. ⚠️ Make sure you have other security measures in place

---

## Step 4: Update Deployment Workflow (1 min)

The workflow at `.github/workflows/deploy.yml` should work as-is, but verify the app directory path:

```yaml
# In deploy.yml, check this matches your actual path:
cd /home/$USER/quickpdf
```

If your app is in a different directory, update the workflow:

```bash
# Find your app directory
pwd
# e.g., /home/ubuntu/myapp

# Update deploy.yml to use the correct path
```

---

## Step 5: Push and Deploy! (1 min)

```bash
# On your local machine
git add .
git commit -m "Add CI/CD pipeline"
git push origin main
```

### Watch the Deployment:

1. Go to GitHub → Actions tab
2. Click on the running workflow
3. Watch the deployment progress in real-time

---

## Step 6: Verify Deployment

After GitHub Actions completes:

```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Check containers are running
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs --tail=50

# Test the API
curl http://localhost/api/health
```

---

## 🎉 Done!

Every push to `main` will now:
1. SSH into your EC2
2. Pull latest code
3. Rebuild containers
4. Restart application

---

## Workflow Behavior

### What Gets Deployed:
- All code in your GitHub repository
- Environment variables from GitHub Secrets
- Docker images rebuilt from latest code

### What Stays the Same:
- Uploaded PDFs in `/data/uploads`
- Job data in `/data/jobs`
- SSL certificates (if configured)

### Deployment Process:
```
Push to GitHub 
  ↓
GitHub Actions triggers
  ↓
SSH to EC2
  ↓
Pull latest code (git pull)
  ↓
Rebuild containers
  ↓
Restart application
  ↓
Clean up old images
  ↓
Report success ✅
```

---

## Testing Your Pipeline

### Make a Small Change:

```bash
# Add a comment to any file
echo "# CI/CD test" >> README.md

git add .
git commit -m "Test CI/CD deployment"
git push origin main
```

Watch it deploy automatically in GitHub Actions!

---

## Common Issues

### ❌ SSH Connection Failed

**Problem:** Can't connect to EC2

**Solutions:**
1. Verify `EC2_HOST` is correct (use public IP, not private)
2. Check security group allows SSH from `0.0.0.0/0` or GitHub IPs
3. Verify `EC2_SSH_PRIVATE_KEY` is complete (including BEGIN/END lines)
4. Make sure key permissions are correct on EC2

### ❌ Permission Denied

**Problem:** Can't access docker or git

**Solutions:**
```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in
exit
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Verify
docker ps
```

### ❌ Directory Not Found

**Problem:** Can't find `/home/$USER/quickpdf`

**Solutions:**
```bash
# Find your actual directory
pwd

# Update deploy.yml with correct path
nano .github/workflows/deploy.yml
# Change: cd /home/$USER/quickpdf
# To: cd /home/$USER/your-actual-directory
```

### ❌ Container Won't Start

**Problem:** Application fails after deployment

**Solutions:**
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Verify .env file exists
cat .env

# Rebuild from scratch
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Manual Deployment

If you need to deploy without pushing to GitHub:

1. Go to GitHub → Actions
2. Select "Deploy to AWS EC2" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

---

## Rollback

If a deployment breaks something:

```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
cd ~/quickpdf

# Go back to previous commit
git log --oneline  # Find the commit hash
git reset --hard COMMIT_HASH

# Rebuild
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Monitoring

### View Logs:
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose logs backend
docker compose logs worker
docker compose logs nginx
```

### Check Status:
```bash
docker compose -f docker-compose.prod.yml ps
```

### Resource Usage:
```bash
# Memory and CPU
docker stats

# Disk space
df -h
docker system df
```

---

## Next Steps

✅ Set up staging environment  
✅ Add automated tests before deployment  
✅ Configure SSL/HTTPS  
✅ Set up monitoring (CloudWatch, Sentry)  
✅ Configure automated backups  

---

## Quick Reference

```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart
docker compose -f docker-compose.prod.yml restart

# Rebuild
docker compose -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.prod.yml down

# Clean up
docker system prune -f
```

Happy deploying! 🚀

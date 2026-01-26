# QuickPDF CI/CD Pipeline 🚀

Automated deployment from GitHub to your existing AWS EC2 instance.

---

## 📋 Quick Start

**You have 3 options based on how much detail you want:**

### Option 1: Super Quick (5 min) ⚡
**→ Read: `CICD_QUICK_SETUP.md`**
- Just the essentials
- 3 steps to get deploying

### Option 2: Detailed Guide (15 min) 📚
**→ Read: `CICD_EXISTING_EC2.md`**
- Complete walkthrough
- Troubleshooting included
- Best practices

### Option 3: Jump Right In 🏃
If you're experienced with CI/CD:
1. Add 5 GitHub Secrets (see below)
2. Update security group for SSH
3. Push to main branch
4. Done!

---

## 🔑 Required GitHub Secrets

Add these in: **Settings → Secrets and variables → Actions**

| Secret | What It Is | How to Get It |
|--------|-----------|---------------|
| `EC2_SSH_PRIVATE_KEY` | Your EC2 private key | `cat your-key.pem` |
| `EC2_HOST` | EC2 public IP or domain | AWS Console |
| `EC2_USER` | SSH username | Usually `ubuntu` |
| `SECRET_KEY` | Flask secret key | From your `.env` file |
| `CORS_ORIGINS` | Frontend domain | Your website URL |

---

## 🎯 What This Does

Every time you push to `main` branch:

1. ✅ GitHub Actions triggers automatically
2. ✅ SSHs into your EC2 instance
3. ✅ Pulls latest code from GitHub
4. ✅ Rebuilds Docker containers
5. ✅ Restarts your application
6. ✅ Cleans up old images
7. ✅ Verifies health check

**Zero downtime. Zero manual work.** 🎉

---

## 📁 Files Created

```
.github/workflows/deploy.yml  ← Main CI/CD workflow
scripts/health-check.sh       ← Health verification script
CICD_QUICK_SETUP.md          ← 5-minute setup guide
CICD_EXISTING_EC2.md         ← Detailed setup guide
```

---

## 🧪 Test Your Pipeline

```bash
# Make any small change
echo "# CI/CD test" >> README.md

# Commit and push
git add .
git commit -m "Test deployment"
git push origin main

# Watch it deploy in GitHub → Actions tab!
```

---

## 📊 Monitoring Your Deployments

### In GitHub:
- Go to **Actions** tab
- Click on any workflow run
- See real-time deployment logs

### On Your EC2:
```bash
# SSH in
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Run health check
./scripts/health-check.sh
```

---

## 🔄 Manual Deployment

Need to deploy without pushing code?

1. Go to **GitHub → Actions**
2. Select "Deploy to AWS EC2"
3. Click **"Run workflow"**
4. Choose branch and click **"Run workflow"**

---

## ⚙️ Customization

### Deploy Different Branch

Edit `.github/workflows/deploy.yml`:
```yaml
on:
  push:
    branches:
      - production  # Instead of 'main'
```

### Change App Directory

If your app is not in `/home/ubuntu/quickpdf`:
```yaml
# In deploy.yml
cd /home/$USER/your-actual-directory
```

### Add Tests Before Deploy

Add this step in `deploy.yml` before deployment:
```yaml
- name: Run Tests
  run: |
    python -m pytest tests/
```

---

## 🆘 Troubleshooting

### Deployment Fails?
1. Check GitHub Actions logs
2. Verify all 5 secrets are set
3. Check EC2 security group allows SSH
4. See `CICD_EXISTING_EC2.md` for detailed solutions

### Can't Connect to EC2?
```bash
# Test SSH locally first
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# If this works, check GitHub secrets
```

### Containers Not Starting?
```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Check logs
docker compose -f docker-compose.prod.yml logs

# Rebuild
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📚 Documentation

- **Quick Setup**: `CICD_QUICK_SETUP.md` (5 min)
- **Full Guide**: `CICD_EXISTING_EC2.md` (comprehensive)
- **Workflow**: `.github/workflows/deploy.yml` (actual pipeline)

---

## 🎉 Ready to Deploy?

1. **Start here**: `CICD_QUICK_SETUP.md`
2. **Add secrets** in GitHub
3. **Push to main** branch
4. **Watch it deploy!** 🚀

Questions? Check `CICD_EXISTING_EC2.md` for detailed troubleshooting.

---

**Happy deploying!** 🎊

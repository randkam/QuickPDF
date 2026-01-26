# 🎯 CI/CD Pipeline - START HERE

Your CI/CD pipeline is ready! Here's everything you need to know.

---

## 🚨 FIRST TIME SETUP?

**If you need to find your EC2 setup info (app directory, SECRET_KEY, etc.):**

### Run this on your EC2:
```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/scripts/ec2-info-collector.sh | bash
```

Or manually:
```bash
bash scripts/ec2-info-collector.sh
```

**This will show you everything you need for GitHub Secrets!** ✨

Then continue below...

---

## ✅ What Was Created

```
📁 .github/workflows/
   └── deploy.yml              ← GitHub Actions workflow (auto-deploys on push)

📁 scripts/
   └── health-check.sh         ← Verify deployment health

📄 CICD_QUICK_SETUP.md         ← Quick 5-minute setup guide
📄 CICD_EXISTING_EC2.md        ← Detailed setup guide with troubleshooting
📄 README_CICD.md              ← Complete documentation
```

---

## 🚀 Get Started in 3 Steps

### Step 1: Read the Quick Setup (5 min)
Open: **`CICD_QUICK_SETUP.md`**

This tells you exactly:
- What GitHub secrets to add
- How to get each secret value
- How to allow SSH access

### Step 2: Add Secrets to GitHub (3 min)
Go to: **Your GitHub Repo → Settings → Secrets and variables → Actions**

Add these 5 secrets:
1. `EC2_SSH_PRIVATE_KEY` (your .pem file contents)
2. `EC2_HOST` (your EC2 IP)
3. `EC2_USER` (usually `ubuntu`)
4. `SECRET_KEY` (from your .env)
5. `CORS_ORIGINS` (your frontend URL)

### Step 3: Deploy! (30 seconds)
```bash
git add .
git commit -m "Add CI/CD pipeline"
git push origin main
```

Watch it deploy in **GitHub → Actions** tab! 🎉

---

## 📖 Documentation

| File | Use This If... |
|------|----------------|
| **CICD_QUICK_SETUP.md** | You want to get started ASAP (5 min) |
| **CICD_EXISTING_EC2.md** | You want detailed instructions + troubleshooting |
| **README_CICD.md** | You want complete documentation |

---

## 🎯 How It Works

```
You push code to GitHub
        ↓
GitHub Actions detects push
        ↓
Workflow connects to EC2 via SSH
        ↓
Pulls latest code
        ↓
Rebuilds Docker containers
        ↓
Restarts application
        ↓
Runs health check
        ↓
Reports success! ✅
```

**Time per deployment:** ~2-3 minutes  
**Your effort:** Just `git push`  
**Downtime:** Zero

---

## ✨ Key Features

✅ **Automatic** - Deploys on every push to main  
✅ **Manual Trigger** - Deploy via GitHub UI when needed  
✅ **Health Checks** - Verifies deployment succeeded  
✅ **Clean Up** - Removes old Docker images  
✅ **Zero Downtime** - Graceful container restarts  
✅ **Secure** - Uses SSH keys, not passwords  

---

## 🧪 Test It

After setup, test the pipeline:

```bash
# Make a small change
echo "# Test CI/CD" >> README.md

git add .
git commit -m "Test automated deployment"
git push origin main
```

Then watch:
1. GitHub → Actions tab
2. See the workflow run
3. Check logs in real-time
4. Verify success! ✅

---

## 🔍 Monitor Deployments

### In GitHub (Web):
**GitHub → Actions tab**
- See all deployments
- View logs
- Check status
- Manually trigger deployments

### On EC2 (SSH):
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Check containers
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Health check
curl http://localhost/api/health
```

---

## ⚠️ Before You Start

Make sure you have:
- ✅ Your EC2 instance running
- ✅ SSH access to EC2 (can connect with your .pem key)
- ✅ Docker & Docker Compose installed on EC2
- ✅ Your app code on EC2 (in a git repo)
- ✅ Docker Compose file: `docker-compose.prod.yml`

Not sure? See `CICD_EXISTING_EC2.md` → "Prerequisites" section.

---

## 🆘 Need Help?

### Something not working?
1. **Check GitHub Actions logs** for error messages
2. **See troubleshooting** in `CICD_EXISTING_EC2.md`
3. **Verify secrets** are set correctly

### Common issues:
- "Permission denied" → Check SSH key secret
- "Directory not found" → Update path in deploy.yml
- "Docker not found" → Add user to docker group on EC2

All solutions in **`CICD_EXISTING_EC2.md`**

---

## 🎊 Next Steps

After getting CI/CD working:

1. ✅ Set up staging environment
2. ✅ Add automated tests
3. ✅ Configure SSL/HTTPS
4. ✅ Set up monitoring
5. ✅ Add Slack/Discord notifications

---

## 📚 Quick Links

- **Quick Setup**: Open `CICD_QUICK_SETUP.md`
- **Full Guide**: Open `CICD_EXISTING_EC2.md`  
- **All Docs**: Open `README_CICD.md`
- **Workflow File**: `.github/workflows/deploy.yml`

---

## 🎯 TL;DR

1. Add 5 secrets to GitHub
2. Allow SSH in EC2 security group
3. Push to main
4. Done! 🚀

**Start with:** `CICD_QUICK_SETUP.md`

---

Happy deploying! 🎉

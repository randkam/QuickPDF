# CI/CD Quick Setup (Existing EC2)

Connect your existing EC2 instance to GitHub Actions in 3 steps! ⚡

---

## Step 1: Add GitHub Secrets (3 minutes)

Go to: **GitHub Repo → Settings → Secrets and variables → Actions**

Click **"New repository secret"** and add each of these:

### 1. EC2_SSH_PRIVATE_KEY
```bash
# On your local machine, copy your EC2 key:
cat /path/to/your-ec2-key.pem
```
Paste the **entire output** (including BEGIN/END lines)

### 2. EC2_HOST
Your EC2 public IP or domain:
```
54.123.45.67
```
or
```
api.yourdomain.com
```

### 3. EC2_USER
SSH username (usually `ubuntu` or `ec2-user`):
```
ubuntu
```

### 4. SECRET_KEY
Your Flask secret key:
```bash
# Option A: Get from your EC2 .env file (if it exists):
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
cat ~/quickpdf/.env | grep SECRET_KEY

# Option B: If .env doesn't exist, check running container:
docker exec $(docker ps -q --filter name=backend) env | grep SECRET_KEY

# Option C: Generate a new one:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 5. CORS_ORIGINS
Your frontend domain(s):
```
https://yourdomain.com
```

---

## Step 2: Update Security Group (1 minute)

**Allow GitHub Actions to SSH into EC2:**

### Option A (Easier):
EC2 Console → Security Groups → Your SG → Edit Inbound Rules
- **Type**: SSH
- **Port**: 22
- **Source**: `0.0.0.0/0`

### Option B (More Secure):
Add only GitHub Actions IPs from: https://api.github.com/meta

---

## Step 3: Deploy! (30 seconds)

```bash
git add .
git commit -m "Add CI/CD"
git push origin main
```

Watch deployment in **GitHub → Actions** tab! 🎉

---

## ✅ Verify It Works

```bash
# SSH to your EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Check containers
docker compose -f docker-compose.prod.yml ps

# Test API
curl http://localhost/api/health
```

Should return: `{"status":"ok"}`

---

## 🎯 What Happens on Each Push?

```
You push code
    ↓
GitHub Actions triggers
    ↓
SSH to your EC2
    ↓
Pull latest code
    ↓
Rebuild containers
    ↓
Restart app
    ↓
Done! ✅
```

---

## 🔧 Troubleshooting

### "Permission denied (publickey)"
- Check `EC2_SSH_PRIVATE_KEY` includes BEGIN/END lines
- Verify `EC2_HOST` is the public IP (not private)
- Security group allows SSH

### "Directory not found"
Update `.github/workflows/deploy.yml`:
```yaml
cd /home/$USER/quickpdf  # Change to your actual path
```

### "Docker command not found"
SSH to EC2 and run:
```bash
sudo usermod -aG docker $USER
exit
# SSH back in
```

---

## 📚 Need More Help?

See **CICD_EXISTING_EC2.md** for detailed guide

---

That's it! Push to `main` and your app auto-deploys! 🚀

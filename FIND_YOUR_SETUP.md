# Find Your EC2 Setup

Quick commands to find your current setup on EC2.

---

## 🔍 Step 1: Find Your App Directory

Run these commands on your EC2:

```bash
# Check common locations
ls -la ~/quickpdf
ls -la ~/QuickPDF
ls -la ~/app
ls -la /opt/quickpdf

# Or search for it
find ~ -name "docker-compose*.yml" 2>/dev/null

# Show current directory with docker-compose files
sudo find / -name "docker-compose.prod.yml" 2>/dev/null | grep -v "/proc"
```

**Note the directory path** - you'll need it for the GitHub workflow!

---

## 🔍 Step 2: Check What's Running

```bash
# See if Docker containers are running
docker ps

# If containers are running, check where they're running from
docker inspect $(docker ps -q --filter name=backend) | grep -A 5 "Binds"
```

---

## 🔍 Step 3: Find Your SECRET_KEY

### Option A: From Running Container
```bash
# Get SECRET_KEY from running backend container
docker exec $(docker ps -q --filter name=backend) env | grep SECRET_KEY
```

### Option B: Check for .env Files
```bash
# Search for .env files
find ~ -name ".env" 2>/dev/null

# If found, check it
cat /path/to/.env | grep SECRET_KEY
```

### Option C: Generate New SECRET_KEY
```bash
# Generate a secure random key
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"

# Or using openssl
openssl rand -hex 32
```

---

## 🔍 Step 4: Check Your Username

```bash
# What username are you?
whoami

# Usually one of these:
# - ubuntu (Ubuntu AMI)
# - ec2-user (Amazon Linux)
# - admin (Debian)
```

---

## 📝 Step 5: Document Your Setup

Fill this out based on what you found:

```bash
# App Directory:
APP_DIR="/home/ec2-user/quickpdf"  # ← Change this

# SSH Username:
SSH_USER="ec2-user"  # ← Change this if different

# SECRET_KEY:
SECRET_KEY="your-secret-key-here"  # ← From step 3

# CORS_ORIGINS:
CORS_ORIGINS="https://yourdomain.com"  # ← Your frontend URL
```

---

## 🔧 Step 6: Create .env File (If Missing)

If you don't have a `.env` file:

```bash
# Navigate to your app directory
cd /path/to/your/app  # Use the path from Step 1

# Create .env file
cat > .env << 'EOF'
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=https://yourdomain.com
MAX_CONTENT_LENGTH=52428800
RQ_JOB_TIMEOUT_S=180
CLEANUP_INPUTS=1
EOF

# Secure it
chmod 600 .env

# Verify
cat .env
```

---

## 🔧 Step 7: Update GitHub Workflow

Based on your findings, update `.github/workflows/deploy.yml`:

### If your username is NOT `ubuntu`:

```yaml
# In deploy.yml, find this line:
SSH_USER: ${{ secrets.EC2_USER }}

# Make sure EC2_USER secret in GitHub is set to: ec2-user
```

### If your app directory is NOT `/home/$USER/quickpdf`:

```yaml
# In deploy.yml, find this section:
cd /home/$USER/quickpdf || cd ~/quickpdf

# Change to your actual path:
cd /home/ec2-user/your-actual-directory
```

---

## ✅ Quick Verification

Run this complete check:

```bash
echo "=== EC2 Setup Check ==="
echo "Username: $(whoami)"
echo "Home: $HOME"
echo ""

echo "=== Docker Status ==="
docker --version
docker compose version
docker ps
echo ""

echo "=== App Location ==="
find ~ -name "docker-compose.prod.yml" 2>/dev/null
echo ""

echo "=== Environment Variables ==="
if docker ps -q --filter name=backend > /dev/null 2>&1; then
  echo "Backend container is running"
  docker exec $(docker ps -q --filter name=backend) env | grep -E "(SECRET_KEY|CORS_ORIGINS)" | sed 's/=.*/=***HIDDEN***/'
else
  echo "No backend container running"
fi
echo ""

echo "=== Git Repository ==="
cd ~ && find . -maxdepth 3 -name ".git" -type d 2>/dev/null | head -5
echo ""

echo "Complete! Use the info above to configure GitHub secrets."
```

---

## 📋 GitHub Secrets Checklist

Once you have all the info, add to GitHub:

- [ ] `EC2_SSH_PRIVATE_KEY` = Your .pem file contents
- [ ] `EC2_HOST` = Your EC2 public IP (find in AWS Console)
- [ ] `EC2_USER` = `ec2-user` (or whatever `whoami` shows)
- [ ] `SECRET_KEY` = From Step 3 above
- [ ] `CORS_ORIGINS` = Your frontend domain

---

## 🆘 Still Can't Find It?

If you still can't locate your app:

```bash
# Check if app is running at all
curl http://localhost/api/health

# If it responds, find what's serving it
sudo netstat -tlnp | grep :80
# or
sudo lsof -i :80

# Check nginx/apache configs
sudo find /etc -name "*.conf" 2>/dev/null | xargs grep -l "quickpdf" 2>/dev/null
```

---

## 💡 Common Scenarios

### Scenario 1: App in /home/ec2-user/quickpdf
```bash
# Update workflow to use:
cd /home/ec2-user/quickpdf
```

### Scenario 2: App in /opt/quickpdf
```bash
# Update workflow to use:
cd /opt/quickpdf
```

### Scenario 3: Different username (not ubuntu)
```bash
# Set GitHub secret EC2_USER to:
ec2-user  # or whatever whoami shows
```

---

## 🎯 Next Steps

1. ✅ Run the verification script above
2. ✅ Document your findings
3. ✅ Create/verify .env file
4. ✅ Update GitHub secrets
5. ✅ Update deploy.yml if needed
6. ✅ Test deployment!

---

Need more help? Check `CICD_EXISTING_EC2.md` for detailed troubleshooting.

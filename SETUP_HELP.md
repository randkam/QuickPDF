# Quick Help - Can't Find .env File?

You're seeing: `cat: /home/ec2-user/quickpdf/.env: No such file or directory`

Here's how to fix it and get the info you need.

---

## Option 1: Use the Auto-Collector Script (Easiest) ✨

On your EC2, run:

```bash
# If you have the repo already cloned
cd ~/quickpdf
bash scripts/ec2-info-collector.sh

# Or download it directly
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/scripts/ec2-info-collector.sh | bash
```

This will automatically find everything and show you what to put in GitHub Secrets!

---

## Option 2: Manual Steps

### Step 1: Find Where Your App Is

```bash
# Try these commands:
ls -la ~/quickpdf
ls -la ~/QuickPDF
ls -la /opt/quickpdf

# Or search for it
find ~ -name "docker-compose.prod.yml" 2>/dev/null
```

Once you find it, remember that path!

### Step 2: Get SECRET_KEY from Running Container

If your app is already running:

```bash
# Get SECRET_KEY from backend container
docker ps  # Check if backend is running

# If yes, get the SECRET_KEY:
docker exec $(docker ps -q --filter name=backend) env | grep SECRET_KEY
```

### Step 3: If No Container Running, Generate New SECRET_KEY

```bash
# Generate a new random secret key
python3 -c "import secrets; print(secrets.token_hex(32))"

# Or use openssl
openssl rand -hex 32
```

### Step 4: Get CORS_ORIGINS

```bash
# From running container (if exists)
docker exec $(docker ps -q --filter name=backend) env | grep CORS_ORIGINS

# Or just use your frontend domain
# Example: https://yourwebsite.com
```

### Step 5: Get Your EC2 Public IP

```bash
# On EC2, run:
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Or get from AWS Console → EC2 → Instances
```

---

## Option 3: Complete Setup Script

Copy-paste this entire script on your EC2:

```bash
#!/bin/bash
echo "=== QuickPDF Setup Info ==="
echo ""

# 1. Username
echo "1. EC2_USER (GitHub Secret):"
echo "   $(whoami)"
echo ""

# 2. Public IP
echo "2. EC2_HOST (GitHub Secret):"
curl -s http://169.254.169.254/latest/meta-data/public-ipv4
echo ""
echo ""

# 3. App Directory
echo "3. App Directory:"
APP_DIR=$(find ~ -name "docker-compose.prod.yml" 2>/dev/null | head -1 | xargs dirname)
if [ -n "$APP_DIR" ]; then
  echo "   Found: $APP_DIR"
else
  echo "   Not found - please locate manually"
fi
echo ""

# 4. SECRET_KEY
echo "4. SECRET_KEY (GitHub Secret):"
if docker ps -q --filter name=backend > /dev/null 2>&1; then
  SECRET=$(docker exec $(docker ps -q --filter name=backend) env 2>/dev/null | grep "^SECRET_KEY=" | cut -d= -f2)
  if [ -n "$SECRET" ]; then
    echo "   Found: $SECRET"
  else
    echo "   Generate new: python3 -c \"import secrets; print(secrets.token_hex(32))\""
  fi
else
  NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null)
  if [ -n "$NEW_SECRET" ]; then
    echo "   Generated: $NEW_SECRET"
  else
    echo "   Generate with: openssl rand -hex 32"
  fi
fi
echo ""

# 5. CORS_ORIGINS
echo "5. CORS_ORIGINS (GitHub Secret):"
if docker ps -q --filter name=backend > /dev/null 2>&1; then
  CORS=$(docker exec $(docker ps -q --filter name=backend) env 2>/dev/null | grep "^CORS_ORIGINS=" | cut -d= -f2)
  if [ -n "$CORS" ]; then
    echo "   Found: $CORS"
  else
    echo "   Set to: https://yourdomain.com"
  fi
else
  echo "   Set to: https://yourdomain.com"
fi
echo ""

echo "=== Docker Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | head -5 || echo "Docker not accessible"
echo ""

echo "=== Done! ==="
echo "Copy the values above to GitHub Secrets"
echo "Then follow: CICD_QUICK_SETUP.md"
```

Save as `get-info.sh`, make executable, and run:

```bash
chmod +x get-info.sh
./get-info.sh
```

---

## What to Do with This Info

Once you have all the values:

1. **Go to GitHub**: Your repo → Settings → Secrets and variables → Actions

2. **Add 5 secrets**:
   - `EC2_SSH_PRIVATE_KEY` = Your .pem file contents
   - `EC2_HOST` = Your EC2 public IP (from above)
   - `EC2_USER` = `ec2-user` (from above)
   - `SECRET_KEY` = From above
   - `CORS_ORIGINS` = Your frontend URL

3. **Update security group**: Allow SSH (port 22)

4. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add CI/CD"
   git push origin main
   ```

5. **Watch it deploy** in GitHub → Actions tab!

---

## Still Stuck?

See the detailed guides:
- `FIND_YOUR_SETUP.md` - Step-by-step finding your setup
- `CICD_EXISTING_EC2.md` - Complete CI/CD guide
- `CICD_QUICK_SETUP.md` - Quick reference

---

**TL;DR:** Run the info collector script on EC2, copy the values to GitHub Secrets, push to main! 🚀

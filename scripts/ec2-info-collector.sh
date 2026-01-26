#!/bin/bash
# EC2 Information Collector for CI/CD Setup
# Run this on your EC2 instance to gather all needed information

echo "╔════════════════════════════════════════╗"
echo "║  QuickPDF CI/CD Setup Info Collector  ║"
echo "╔════════════════════════════════════════╗"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. USER INFORMATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Username:${NC} $(whoami)"
echo -e "${GREEN}Home Directory:${NC} $HOME"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. APP DIRECTORY SEARCH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

APP_DIR=""
echo "Searching for docker-compose.prod.yml..."

# Check common locations
for dir in "$HOME/quickpdf" "$HOME/QuickPDF" "$HOME/app" "/opt/quickpdf"; do
  if [ -f "$dir/docker-compose.prod.yml" ]; then
    echo -e "${GREEN}✓ Found at:${NC} $dir"
    APP_DIR="$dir"
    break
  fi
done

# If not found in common locations, search
if [ -z "$APP_DIR" ]; then
  echo "Searching entire home directory (this may take a moment)..."
  FOUND=$(find "$HOME" -name "docker-compose.prod.yml" 2>/dev/null | head -1)
  if [ -n "$FOUND" ]; then
    APP_DIR=$(dirname "$FOUND")
    echo -e "${GREEN}✓ Found at:${NC} $APP_DIR"
  else
    echo -e "${RED}✗ Not found${NC}"
    echo "Please manually locate your app directory."
  fi
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. DOCKER STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v docker &> /dev/null; then
  echo -e "${GREEN}✓ Docker installed:${NC} $(docker --version)"
  
  if docker compose version &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose:${NC} $(docker compose version)"
  else
    echo -e "${YELLOW}⚠ Docker Compose not found${NC}"
  fi
  
  echo ""
  echo "Running containers:"
  if docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -q "backend\|worker\|redis\|nginx"; then
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "NAME|backend|worker|redis|nginx"
  else
    echo "No QuickPDF containers running"
  fi
else
  echo -e "${RED}✗ Docker not installed${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. SECRET_KEY SEARCH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SECRET_FOUND=false

# Try to get from running container
if docker ps -q --filter name=backend > /dev/null 2>&1; then
  SECRET_KEY=$(docker exec $(docker ps -q --filter name=backend) env 2>/dev/null | grep "^SECRET_KEY=" | cut -d= -f2)
  if [ -n "$SECRET_KEY" ]; then
    echo -e "${GREEN}✓ Found in running container${NC}"
    echo "SECRET_KEY=${SECRET_KEY:0:10}...${SECRET_KEY: -10}"
    SECRET_FOUND=true
  fi
fi

# Try to find .env file
if [ ! "$SECRET_FOUND" = true ]; then
  if [ -n "$APP_DIR" ] && [ -f "$APP_DIR/.env" ]; then
    SECRET_KEY=$(grep "^SECRET_KEY=" "$APP_DIR/.env" 2>/dev/null | cut -d= -f2)
    if [ -n "$SECRET_KEY" ]; then
      echo -e "${GREEN}✓ Found in .env file:${NC} $APP_DIR/.env"
      echo "SECRET_KEY=${SECRET_KEY:0:10}...${SECRET_KEY: -10}"
      SECRET_FOUND=true
    fi
  fi
fi

if [ ! "$SECRET_FOUND" = true ]; then
  echo -e "${YELLOW}⚠ SECRET_KEY not found${NC}"
  echo "Generate a new one with:"
  echo "  python3 -c \"import secrets; print(secrets.token_hex(32))\""
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. CORS_ORIGINS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CORS_FOUND=false

# Try running container
if docker ps -q --filter name=backend > /dev/null 2>&1; then
  CORS_ORIGINS=$(docker exec $(docker ps -q --filter name=backend) env 2>/dev/null | grep "^CORS_ORIGINS=" | cut -d= -f2)
  if [ -n "$CORS_ORIGINS" ]; then
    echo -e "${GREEN}✓ Found in running container:${NC} $CORS_ORIGINS"
    CORS_FOUND=true
  fi
fi

# Try .env file
if [ ! "$CORS_FOUND" = true ]; then
  if [ -n "$APP_DIR" ] && [ -f "$APP_DIR/.env" ]; then
    CORS_ORIGINS=$(grep "^CORS_ORIGINS=" "$APP_DIR/.env" 2>/dev/null | cut -d= -f2)
    if [ -n "$CORS_ORIGINS" ]; then
      echo -e "${GREEN}✓ Found in .env:${NC} $CORS_ORIGINS"
      CORS_FOUND=true
    fi
  fi
fi

if [ ! "$CORS_FOUND" = true ]; then
  echo -e "${YELLOW}⚠ CORS_ORIGINS not found${NC}"
  echo "Set to your frontend domain (e.g., https://yourdomain.com)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. GIT REPOSITORY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$APP_DIR" ] && [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  echo -e "${GREEN}✓ Git repository found${NC}"
  echo "Remote URL: $(git remote get-url origin 2>/dev/null || echo 'Not configured')"
  echo "Current branch: $(git branch --show-current 2>/dev/null || echo 'Unknown')"
else
  echo -e "${YELLOW}⚠ Git repository not found in app directory${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. SUMMARY FOR GITHUB SECRETS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Copy these values to GitHub Secrets:"
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│ EC2_USER:                               │"
echo "│   $(whoami)"
echo "│                                         │"
echo "│ EC2_HOST:                               │"
echo "│   (Your EC2 Public IP - get from AWS)  │"
echo "│                                         │"
echo "│ SECRET_KEY:                             │"
if [ "$SECRET_FOUND" = true ]; then
  echo "│   ${SECRET_KEY}"
else
  echo "│   (Generate with command above)        │"
fi
echo "│                                         │"
echo "│ CORS_ORIGINS:                           │"
if [ "$CORS_FOUND" = true ]; then
  echo "│   ${CORS_ORIGINS}"
else
  echo "│   (Your frontend domain)               │"
fi
echo "│                                         │"
echo "│ EC2_SSH_PRIVATE_KEY:                    │"
echo "│   (Contents of your .pem file)         │"
echo "└─────────────────────────────────────────┘"
echo ""

if [ -n "$APP_DIR" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "8. WORKFLOW CONFIGURATION"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Your app directory: $APP_DIR"
  echo ""
  if [ "$APP_DIR" != "/home/$(whoami)/quickpdf" ]; then
    echo -e "${YELLOW}⚠ Update .github/workflows/deploy.yml${NC}"
    echo "Change app directory to: $APP_DIR"
  else
    echo -e "${GREEN}✓ Default path matches your setup${NC}"
  fi
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Information Collection Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Add the 5 secrets to GitHub (see summary above)"
echo "2. Update security group to allow SSH"
echo "3. Push to main branch"
echo "4. Watch deployment in GitHub Actions!"
echo ""

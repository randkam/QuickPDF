#!/bin/bash
# Health check script for QuickPDF

set -e

HOST=${1:-localhost}
PORT=${2:-80}

echo "🏥 Checking QuickPDF health at $HOST:$PORT..."

# Check if backend is responding
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$HOST:$PORT/api/health)

if [ "$RESPONSE" -eq 200 ]; then
    echo "✅ Backend is healthy!"
    
    # Test a simple job creation (optional)
    echo "🧪 Testing job creation..."
    # Uncomment if you want to test actual operations
    # TEST_RESPONSE=$(curl -s -X POST http://$HOST:$PORT/api/jobs ...)
    
    exit 0
else
    echo "❌ Backend health check failed (HTTP $RESPONSE)"
    echo "📋 Checking container status..."
    docker compose -f docker-compose.prod.yml ps
    echo ""
    echo "📋 Recent logs:"
    docker compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

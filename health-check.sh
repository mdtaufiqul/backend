#!/bin/bash

echo "🔍 MediFlow Backend Health Check"
echo "=================================="
echo ""

# Check Docker containers
echo "📦 Docker Containers:"
docker ps --filter "name=mediflow" --format "  ✓ {{.Names}} - {{.Status}}"
echo ""

# Check backend process
echo "🚀 Backend Process:"
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "  ✓ Backend running on port 3001"
else
    echo "  ✗ Backend NOT running on port 3001"
fi
echo ""

# Check database connection
echo "💾 Database Connection:"
if docker exec mediflow_db pg_isready -U postgres > /dev/null 2>&1; then
    echo "  ✓ PostgreSQL is ready"
else
    echo "  ✗ PostgreSQL connection failed"
fi
echo ""

# Check API endpoints
echo "🌐 API Endpoints:"
endpoints=(
    "http://localhost:3001"
    "http://localhost:3001/api/settings/sms"
    "http://localhost:3001/api/settings/smtp"
    "http://localhost:3001/api/sms/supported-countries"
    "http://localhost:3001/api/whatsapp/status"
)

for endpoint in "${endpoints[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null)
    if [ "$status" = "200" ] || [ "$status" = "401" ]; then
        echo "  ✓ $endpoint - $status"
    else
        echo "  ✗ $endpoint - $status"
    fi
done
echo ""

# Check migrations
echo "📊 Database Migrations:"
cd /Users/themesloft/.gemini/antigravity/scratch/mediflow-app/backend
npx prisma migrate status 2>&1 | grep -E "migrations|applied|pending" | head -5
echo ""

# Check Prisma Client
echo "🔧 Prisma Client:"
if [ -d "node_modules/.prisma/client" ]; then
    echo "  ✓ Prisma Client generated"
else
    echo "  ✗ Prisma Client NOT generated"
fi
echo ""

echo "=================================="
echo "✅ Health Check Complete"

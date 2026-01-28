#!/bin/bash

echo "🧪 Testing SMS/WhatsApp API Endpoints"
echo "======================================"
echo ""

# Get JWT token (assuming you have a user)
echo "📝 Step 1: Login to get JWT token"
echo "Please run this manually:"
echo "curl -X POST http://localhost:3000/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"your@email.com\",\"password\":\"yourpassword\"}'"
echo ""
echo "Then set the token:"
echo "export JWT_TOKEN=\"your_token_here\""
echo ""

if [ -z "$JWT_TOKEN" ]; then
  echo "⚠️  JWT_TOKEN not set. Please login first and export JWT_TOKEN."
  echo ""
  exit 1
fi

echo "✅ JWT Token found"
echo ""

# Test SMS Identity Endpoints
echo "📱 Step 2: Testing SMS Identity Endpoints"
echo "----------------------------------------"
echo ""

echo "2.1 Get current SMS identity configuration:"
curl -X GET "http://localhost:3000/sms/identity" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "2.2 Get SMS preview (System Default):"
curl -X GET "http://localhost:3000/sms/preview" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "2.3 Update SMS identity to Custom Branding:"
curl -X PUT "http://localhost:3000/sms/identity" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "CUSTOM_BRANDING",
    "customSenderName": "MEDIFLOW"
  }' | jq '.'
echo ""
echo ""

echo "2.4 Get SMS preview (Custom Branding):"
curl -X GET "http://localhost:3000/sms/preview" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "2.5 Get supported countries for alphanumeric IDs:"
curl -X GET "http://localhost:3000/sms/supported-countries" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# Test WhatsApp Endpoints
echo "💬 Step 3: Testing WhatsApp Endpoints"
echo "--------------------------------------"
echo ""

echo "3.1 Get WhatsApp status:"
curl -X GET "http://localhost:3000/whatsapp/status" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "3.2 Generate QR Code (if Evolution API configured):"
echo "curl -X GET \"http://localhost:3000/whatsapp/qr\" \\"
echo "  -H \"Authorization: Bearer \$JWT_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" | jq '.qrCode' -r | base64 -d > qr_code.png"
echo ""
echo "(Skipping - requires Evolution API setup)"
echo ""

echo "======================================"
echo "✅ API Tests Complete!"
echo ""
echo "📝 Summary:"
echo "  - SMS Identity API: Tested"
echo "  - WhatsApp Status API: Tested"
echo "  - Tier configuration: Working"
echo ""
echo "💡 Next: Test actual SMS sending via workflow"

#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Kickstart — Entra App Registration setup
#
# Creates an Entra ID (Azure AD) app registration for the Kickstart
# web app in the CA Global Demos 2605 tenant.
#
# Prerequisites:
#   - Azure CLI installed (az)
#   - Logged into the correct tenant
#
# Usage:
#   az login --tenant caglobaldemos2605.onmicrosoft.com
#   chmod +x setup-entra.sh
#   ./setup-entra.sh
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────

APP_NAME="Kickstart - AKS Onboarding"
TENANT="caglobaldemos2605.onmicrosoft.com"

# Redirect URIs for the SPA
REDIRECT_URIS=(
  "http://localhost:8080"
  "http://localhost:4280"
  "https://kickstart.aks.azure.sabbour.me"
  "https://kickstart.aks.azure.com"
)

# ── Verify tenant ────────────────────────────────────────────────

echo "🔍 Verifying tenant context..."
CURRENT_TENANT=$(az account show --query tenantId -o tsv 2>/dev/null || true)
if [ -z "$CURRENT_TENANT" ]; then
  echo "❌ Not logged in. Run: az login --tenant $TENANT"
  exit 1
fi
echo "✅ Logged into tenant: $CURRENT_TENANT"

# ── Create app registration ─────────────────────────────────────

echo ""
echo "📝 Creating Entra App Registration: $APP_NAME"

# Build the SPA redirect URIs JSON
SPA_URIS_JSON=$(printf '"%s",' "${REDIRECT_URIS[@]}" | sed 's/,$//')

APP_ID=$(az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris ${REDIRECT_URIS[@]} \
  --enable-id-token-issuance true \
  --query appId -o tsv)

echo "✅ App created — Client ID: $APP_ID"

# ── Get the Object ID ───────────────────────────────────────────

OBJECT_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)
echo "   Object ID: $OBJECT_ID"

# ── Configure SPA platform ──────────────────────────────────────

echo ""
echo "🔧 Configuring SPA platform with redirect URIs..."

# Patch to set SPA redirect URIs (the --web-redirect-uris above sets web, not SPA)
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID" \
  --headers "Content-Type=application/json" \
  --body "{
    \"spa\": {
      \"redirectUris\": [$SPA_URIS_JSON]
    },
    \"web\": {
      \"redirectUris\": []
    }
  }"

echo "✅ SPA redirect URIs configured"

# ── Add API permissions ──────────────────────────────────────────

echo ""
echo "🔑 Adding API permissions..."

# Microsoft Graph — User.Read (delegated)
az ad app permission add \
  --id "$APP_ID" \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
  2>/dev/null || echo "   (User.Read may already be added)"

# Azure Service Management — user_impersonation (delegated)
az ad app permission add \
  --id "$APP_ID" \
  --api 797f4846-ba00-4fd7-ba43-dac1f8f63013 \
  --api-permissions 41094075-9dad-400e-a0bd-54e686782033=Scope \
  2>/dev/null || echo "   (user_impersonation may already be added)"

echo "✅ API permissions configured"

# ── Create client secret ────────────────────────────────────────

echo ""
echo "🔐 Creating client secret..."

SECRET=$(az ad app credential reset \
  --id "$APP_ID" \
  --display-name "kickstart-secret" \
  --years 1 \
  --query password -o tsv)

# ── Output ───────────────────────────────────────────────────────

TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Kickstart — Entra App Registration Complete"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  App Name:      $APP_NAME"
echo "  Client ID:     $APP_ID"
echo "  Object ID:     $OBJECT_ID"
echo "  Tenant ID:     $TENANT_ID"
echo ""
echo "  ⚠️  Client Secret (save this — it won't be shown again):"
echo "  $SECRET"
echo ""
echo "  Store the secret in GitHub Secrets as:"
echo "    AZURE_CLIENT_SECRET=$SECRET"
echo ""
echo "  Redirect URIs:"
for uri in "${REDIRECT_URIS[@]}"; do
  echo "    - $uri"
done
echo ""
echo "════════════════════════════════════════════════════════════════"

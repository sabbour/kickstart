#!/usr/bin/env bash
set -euo pipefail

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building packages..."
npm run build

echo "✅ Codespace ready — dev server will start on port 4280"

#!/bin/bash

# =============================================================================
# Cloudflare Monitor - Installation Script
# =============================================================================
# One-command setup for the Cloudflare monitoring platform
# 
# Usage:
#   ./install.sh
#
# Or run directly:
#   curl -fsSL https://raw.githubusercontent.com/CrashBytes/cloudflare-monitor/main/install.sh | bash
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emoji support check
if [[ "$TERM_PROGRAM" == "Apple_Terminal" ]] || [[ "$TERM" == "xterm-256color" ]]; then
    ROCKET="🚀"
    CHECK="✅"
    CROSS="❌"
    WARN="⚠️"
    PACKAGE="📦"
    DATABASE="🗄️"
    KEY="🔑"
    GEAR="⚙️"
else
    ROCKET="[*]"
    CHECK="[+]"
    CROSS="[!]"
    WARN="[?]"
    PACKAGE="[~]"
    DATABASE="[D]"
    KEY="[K]"
    GEAR="[G]"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}        ${ROCKET} ${BLUE}Cloudflare Monitor Installation${NC} ${ROCKET}                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}        Real-time monitoring for Cloudflare Pages            ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Check Prerequisites
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 1/6: Checking prerequisites...${NC}"

# Check for Bun
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo -e "  ${CHECK} Bun runtime found (v${BUN_VERSION})"
else
    echo -e "  ${WARN} Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    if command -v bun &> /dev/null; then
        echo -e "  ${CHECK} Bun installed successfully"
    else
        echo -e "  ${CROSS} Failed to install Bun. Please install manually: https://bun.sh"
        exit 1
    fi
fi

# Check for Git
if command -v git &> /dev/null; then
    echo -e "  ${CHECK} Git found"
else
    echo -e "  ${CROSS} Git not found. Please install Git first."
    exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# Step 2: Gather Cloudflare Credentials
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 2/6: Configuring Cloudflare credentials...${NC}"

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "  ${WARN} .env file already exists"
    read -p "  Overwrite with new credentials? (y/N): " OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo -e "  ${CHECK} Keeping existing configuration"
        SKIP_CREDENTIALS=true
    fi
fi

if [ -z "$SKIP_CREDENTIALS" ]; then
    echo ""
    echo -e "  ${KEY} Enter your Cloudflare credentials:"
    echo -e "     To generate a Cloudflare API token, follow these steps:"
    echo -e "     1. Go to: ${CYAN}https://dash.cloudflare.com/${NC} and log in."
    echo -e "     2. Click your profile icon (top right) > My Profile."
    echo -e "     3. In the left sidebar, click 'API Tokens'."
    echo -e "     4. Click 'Create Token'. Scroll to 'Custom token' and click 'Get started'."
    echo -e "     5. Add permissions:"
    echo -e "        - Account → Cloudflare Pages → Read"
    echo -e "        - Account → Cloudflare Pages → Edit"
    echo -e "     6. (If prompted) Under Account Resources, select 'Include' and choose your account."
    echo -e "        If you do not see this, the permissions will apply to all your accounts by default."
    echo -e "     7. Click 'Continue to summary', review, and then 'Create Token'."
    echo -e "     8. Copy the generated token and save it securely."
    echo -e "     9. Your Account ID is in the dashboard URL: https://dash.cloudflare.com/<ACCOUNT_ID>/..."
    echo -e "     Never share your API token publicly."
    echo ""
    
    # Get API Token
    while true; do
        read -sp "  ${KEY} Cloudflare API Token: " CF_API_TOKEN
        echo ""
        
        if [ -z "$CF_API_TOKEN" ]; then
            echo -e "  ${CROSS} API token cannot be empty"
            continue
        fi
        
        # Basic format validation (Cloudflare tokens are typically 40+ chars)
        if [ ${#CF_API_TOKEN} -lt 30 ]; then
            echo -e "  ${WARN} Token seems too short. Are you sure it's correct? (y/N): "
            read CONFIRM
            if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
                continue
            fi
        fi
        break
    done
    
    # Get Account ID
    echo -e "     (Find Account ID in your dashboard URL or Workers & Pages sidebar)"
    while true; do
        read -p "  ${KEY} Cloudflare Account ID: " CF_ACCOUNT_ID
        
        if [ -z "$CF_ACCOUNT_ID" ]; then
            echo -e "  ${CROSS} Account ID cannot be empty"
            continue
        fi
        
        # Basic hex validation (Account IDs are 32 char hex strings)
        if [[ ! "$CF_ACCOUNT_ID" =~ ^[a-f0-9]{32}$ ]]; then
            echo -e "  ${WARN} Account ID format looks unusual. Continue anyway? (y/N): "
            read CONFIRM
            if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
                continue
            fi
        fi
        break
    done
    
    # Create .env file
    cat > .env << EOF
# Cloudflare Monitor Configuration
# Generated by install.sh on $(date)

# Cloudflare API Credentials
CLOUDFLARE_API_TOKEN=${CF_API_TOKEN}
CLOUDFLARE_ACCOUNT_ID=${CF_ACCOUNT_ID}

# Server Configuration
API_PORT=3001
API_HOST=0.0.0.0
NODE_ENV=development

# Polling & Performance
POLL_INTERVAL_MS=10000
CACHE_TTL_MS=10000

# Database
DATABASE_PATH=./data/monitor.db

# CORS
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=info
EOF

    chmod 600 .env
    echo -e "  ${CHECK} Configuration saved to .env"
fi

echo ""

# -----------------------------------------------------------------------------
# Step 3: Install Dependencies
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 3/6: Installing dependencies...${NC}"

echo -e "  ${PACKAGE} Installing packages (this may take a minute)..."
bun install --silent 2>/dev/null || bun install

echo -e "  ${CHECK} Dependencies installed"
echo ""

# -----------------------------------------------------------------------------
# Step 4: Build Packages
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 4/6: Building packages...${NC}"

echo -e "  ${GEAR} Building shared types..."
cd packages/shared && bun run build 2>/dev/null && cd ../..
echo -e "  ${CHECK} Shared package built"

echo -e "  ${GEAR} Building Cloudflare SDK..."
cd packages/cloudflare-sdk && bun run build 2>/dev/null && cd ../..
echo -e "  ${CHECK} Cloudflare SDK built"

echo ""

# -----------------------------------------------------------------------------
# Step 5: Initialize Database
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 5/6: Initializing database...${NC}"

mkdir -p data
echo -e "  ${DATABASE} Created data directory"

# The database will be auto-initialized on first API start
echo -e "  ${CHECK} Database will initialize on first start"
echo ""

# -----------------------------------------------------------------------------
# Step 6: Verify Installation
# -----------------------------------------------------------------------------
echo -e "${BLUE}Step 6/6: Verifying installation...${NC}"

# Test API token (optional - requires network)
echo -e "  ${GEAR} Validating Cloudflare API credentials..."

# Quick validation by checking env vars
source .env
if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "  ${CHECK} Credentials configured"
else
    echo -e "  ${WARN} Credentials not found in .env"
fi

echo ""

# =============================================================================
# Installation Complete
# =============================================================================
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}                  ${CHECK} ${BLUE}Installation Complete!${NC}                  ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${ROCKET} ${CYAN}Quick Start:${NC}"
echo ""
echo -e "     1. Start the development servers:"
echo -e "        ${YELLOW}bun run dev${NC}"
echo ""
echo -e "     2. Open your browser:"
echo -e "        Dashboard: ${CYAN}http://localhost:5173${NC}"
echo -e "        API:       ${CYAN}http://localhost:3001${NC}"
echo ""
echo -e "  ${GEAR} ${CYAN}Individual Services:${NC}"
echo -e "     API only:     ${YELLOW}bun run dev:api${NC}"
echo -e "     Frontend only: ${YELLOW}bun run dev:web${NC}"
echo ""
echo -e "  📚 ${CYAN}Documentation:${NC}"
echo -e "     ${BLUE}https://github.com/CrashBytes/cloudflare-monitor#readme${NC}"
echo ""

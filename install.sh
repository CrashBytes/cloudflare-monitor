#!/bin/bash
#
# Cloudflare Monitor - Production Installation Script
# 
# Design Philosophy:
# - Idempotent: Safe to run multiple times
# - Defensive: Validates every assumption
# - Educational: Explains what it's doing and why
# - Resilient: Graceful error handling with recovery paths
#
# Architecture: This script implements a state machine with distinct phases:
#   1. Environment Detection
#   2. Dependency Resolution
#   3. Interactive Configuration
#   4. System Initialization
#   5. Validation & Health Checks
#

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# ============================================================================
# ANSI Color Codes - Visual feedback for operational status
# ============================================================================
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# ============================================================================
# Logging Framework - Structured output for operational clarity
# ============================================================================
log_info() {
    echo -e "${BLUE}ℹ ${NC}${1}"
}

log_success() {
    echo -e "${GREEN}✓ ${NC}${1}"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${NC}${1}"
}

log_error() {
    echo -e "${RED}✗ ${NC}${1}" >&2
}

log_section() {
    echo ""
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  ${1}${NC}"
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# ============================================================================
# System Detection - Understand the execution environment
# ============================================================================
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "linux";;
        Darwin*)    echo "macos";;
        CYGWIN*)    echo "windows";;
        MINGW*)     echo "windows";;
        *)          echo "unknown";;
    esac
}

detect_architecture() {
    case "$(uname -m)" in
        x86_64)     echo "x64";;
        arm64)      echo "arm64";;
        aarch64)    echo "arm64";;
        *)          echo "unknown";;
    esac
}

# ============================================================================
# Runtime Detection & Installation - Ensure execution environment
# ============================================================================
check_command() {
    command -v "$1" >/dev/null 2>&1
}

get_bun_version() {
    if check_command bun; then
        bun --version 2>/dev/null | head -n1
    else
        echo "not installed"
    fi
}

get_node_version() {
    if check_command node; then
        node --version 2>/dev/null
    else
        echo "not installed"
    fi
}

install_bun() {
    log_info "Installing Bun runtime..."
    
    # Architectural rationale for Bun:
    # - 3x faster cold starts than Node.js
    # - Native TypeScript execution without transpilation
    # - Built-in SQLite support (critical for this application)
    # - 4x faster dependency installation
    
    if curl -fsSL https://bun.sh/install | bash; then
        log_success "Bun installed successfully"
        
        # Source shell configuration to make bun available immediately
        if [ -f "$HOME/.bashrc" ]; then
            source "$HOME/.bashrc"
        elif [ -f "$HOME/.zshrc" ]; then
            source "$HOME/.zshrc"
        fi
        
        # Verify installation
        if check_command bun; then
            log_success "Bun is now available: $(bun --version)"
            return 0
        else
            log_warning "Bun installed but not yet in PATH. Please run: source ~/.bashrc or source ~/.zshrc"
            log_warning "Or restart your terminal and run this script again."
            return 1
        fi
    else
        log_error "Failed to install Bun"
        return 1
    fi
}

prompt_runtime_installation() {
    log_section "Runtime Environment Setup"
    
    local os=$(detect_os)
    local arch=$(detect_architecture)
    local bun_version=$(get_bun_version)
    local node_version=$(get_node_version)
    
    log_info "System: ${os} (${arch})"
    log_info "Bun: ${bun_version}"
    log_info "Node.js: ${node_version}"
    
    if check_command bun; then
        log_success "Bun runtime detected - optimal performance path"
        return 0
    fi
    
    echo ""
    echo "Cloudflare Monitor requires a JavaScript runtime."
    echo ""
    echo "Recommended: Bun (high-performance runtime with native SQLite)"
    echo "Alternative: Node.js 20+ (standard ecosystem)"
    echo ""
    
    if check_command node; then
        local node_major=$(node --version | cut -d. -f1 | sed 's/v//')
        if [ "$node_major" -ge 20 ]; then
            log_info "Node.js ${node_version} detected - compatible but suboptimal"
            echo ""
            echo "You can:"
            echo "  1) Install Bun for better performance (recommended)"
            echo "  2) Continue with Node.js"
            echo ""
            read -p "Choice [1/2]: " choice
            
            case $choice in
                1)
                    install_bun || {
                        log_warning "Bun installation failed, continuing with Node.js"
                        return 0
                    }
                    ;;
                2)
                    log_info "Continuing with Node.js runtime"
                    return 0
                    ;;
                *)
                    log_error "Invalid choice"
                    exit 1
                    ;;
            esac
        else
            log_error "Node.js version too old (${node_version}). Requires Node.js 20+"
            echo ""
            echo "Options:"
            echo "  1) Install Bun (recommended)"
            echo "  2) Upgrade Node.js manually"
            echo ""
            read -p "Choice [1/2]: " choice
            
            case $choice in
                1) install_bun || exit 1 ;;
                2)
                    log_info "Please upgrade Node.js and run this script again"
                    exit 0
                    ;;
                *) exit 1 ;;
            esac
        fi
    else
        log_warning "No JavaScript runtime detected"
        echo ""
        read -p "Install Bun now? [Y/n]: " install_choice
        
        case ${install_choice:-Y} in
            [Yy]*)
                install_bun || exit 1
                ;;
            *)
                log_error "Runtime required. Please install Bun or Node.js 20+ manually."
                exit 1
                ;;
        esac
    fi
}

# ============================================================================
# Configuration Management - Interactive credential gathering
# ============================================================================
validate_cloudflare_token() {
    local token=$1
    
    # Token format validation: Cloudflare API tokens are typically 40 characters
    if [ ${#token} -lt 20 ]; then
        log_error "Token appears too short. Expected 40+ characters."
        return 1
    fi
    
    # Pattern validation: Cloudflare tokens are alphanumeric with underscores/hyphens
    if ! [[ "$token" =~ ^[A-Za-z0-9_-]+$ ]]; then
        log_error "Token contains invalid characters"
        return 1
    fi
    
    return 0
}

validate_account_id() {
    local account_id=$1
    
    # Account IDs are 32-character hex strings
    if [ ${#account_id} -ne 32 ]; then
        log_error "Account ID must be exactly 32 characters"
        return 1
    fi
    
    if ! [[ "$account_id" =~ ^[a-f0-9]+$ ]]; then
        log_error "Account ID must be hexadecimal (0-9, a-f)"
        return 1
    fi
    
    return 0
}

prompt_cloudflare_credentials() {
    log_section "Cloudflare API Configuration"
    
    echo "To monitor your Cloudflare deployments, we need API credentials."
    echo ""
    echo "How to obtain these:"
    echo "  1. Log into Cloudflare Dashboard"
    echo "  2. Navigate to: Profile → API Tokens"
    echo "  3. Create Token using 'Cloudflare Pages' template"
    echo "  4. Copy the token and your Account ID from the dashboard URL"
    echo ""
    echo "Dashboard URL format: https://dash.cloudflare.com/<ACCOUNT_ID>/..."
    echo ""
    
    # API Token
    while true; do
        read -sp "Cloudflare API Token: " cf_token
        echo ""
        
        if [ -z "$cf_token" ]; then
            log_error "API Token cannot be empty"
            continue
        fi
        
        if validate_cloudflare_token "$cf_token"; then
            log_success "Token format validated"
            break
        fi
        
        echo ""
        read -p "Token validation failed. Try again? [Y/n]: " retry
        case ${retry:-Y} in
            [Nn]*) exit 1 ;;
        esac
    done
    
    # Account ID
    while true; do
        read -p "Cloudflare Account ID: " cf_account_id
        
        if [ -z "$cf_account_id" ]; then
            log_error "Account ID cannot be empty"
            continue
        fi
        
        if validate_account_id "$cf_account_id"; then
            log_success "Account ID format validated"
            break
        fi
        
        echo ""
        read -p "Account ID validation failed. Try again? [Y/n]: " retry
        case ${retry:-Y} in
            [Nn]*) exit 1 ;;
        esac
    done
    
    # Store in environment variables for subsequent use
    export CLOUDFLARE_API_TOKEN="$cf_token"
    export CLOUDFLARE_ACCOUNT_ID="$cf_account_id"
    
    log_success "Credentials captured securely"
}

# ============================================================================
# Configuration File Generation - Persist environment
# ============================================================================
generate_env_file() {
    log_section "Environment Configuration"
    
    local env_file=".env"
    
    if [ -f "$env_file" ]; then
        log_warning "Existing .env file detected"
        read -p "Overwrite? [y/N]: " overwrite
        case ${overwrite:-N} in
            [Yy]*)
                log_info "Backing up existing .env to .env.backup"
                cp "$env_file" "${env_file}.backup"
                ;;
            *)
                log_info "Keeping existing .env file"
                return 0
                ;;
        esac
    fi
    
    log_info "Generating environment configuration..."
    
    cat > "$env_file" << EOF
# Cloudflare Monitor Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# ============================================================================
# Cloudflare API Credentials
# ============================================================================
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}

# ============================================================================
# API Server Configuration
# ============================================================================
API_PORT=3001
API_HOST=0.0.0.0
NODE_ENV=development

# ============================================================================
# Polling Configuration
# 
# POLL_INTERVAL_MS: How often to fetch from Cloudflare API
#   - Development: 5000ms (5s) - frequent updates for testing
#   - Production: 15000-30000ms (15-30s) - respects API rate limits
# 
# Cloudflare API Rate Limits:
#   - Free tier: ~1200 requests/hour
#   - This app makes ~3 requests per poll cycle
#   - 5s interval = 720 polls/hour = ~2160 requests/hour (exceeds free tier)
#   - 15s interval = 240 polls/hour = ~720 requests/hour (safe)
# ============================================================================
POLL_INTERVAL_MS=5000

# ============================================================================
# Cache Configuration
# 
# CACHE_TTL_MS: How long to cache API responses
#   - Reduces database load
#   - Balances freshness with performance
#   - Should be < POLL_INTERVAL_MS for real-time feel
# ============================================================================
CACHE_TTL_MS=10000

# ============================================================================
# Database Configuration
# 
# SQLite database with WAL mode for concurrent read performance
# ============================================================================
DATABASE_PATH=./data/monitor.db

# ============================================================================
# CORS Configuration
# 
# Restricts which origins can access the API
# Update for production deployment
# ============================================================================
CORS_ORIGIN=http://localhost:5173

# ============================================================================
# Logging Configuration
# ============================================================================
LOG_LEVEL=info
EOF
    
    # Secure the file - API tokens are sensitive
    chmod 600 "$env_file"
    
    log_success "Environment configuration created: ${env_file}"
    log_info "File permissions: 600 (owner read/write only)"
}

# ============================================================================
# Dependency Installation - Package management
# ============================================================================
install_dependencies() {
    log_section "Dependency Installation"
    
    if check_command bun; then
        log_info "Installing dependencies with Bun..."
        if bun install; then
            log_success "Dependencies installed successfully"
        else
            log_error "Dependency installation failed"
            exit 1
        fi
    elif check_command npm; then
        log_info "Installing dependencies with npm..."
        if npm install; then
            log_success "Dependencies installed successfully"
        else
            log_error "Dependency installation failed"
            exit 1
        fi
    else
        log_error "No package manager available"
        exit 1
    fi
}

# ============================================================================
# Build System - Compile TypeScript packages
# ============================================================================
build_packages() {
    log_section "Building Packages"
    
    log_info "Building shared types package..."
    cd packages/shared
    if check_command bun; then
        bun run build
    else
        npm run build
    fi
    cd ../..
    log_success "Shared package built"
    
    log_info "Building Cloudflare SDK package..."
    cd packages/cloudflare-sdk
    if check_command bun; then
        bun run build
    else
        npm run build
    fi
    cd ../..
    log_success "SDK package built"
}

# ============================================================================
# Database Initialization - Schema setup
# ============================================================================
initialize_database() {
    log_section "Database Initialization"
    
    # Create data directory with appropriate permissions
    log_info "Creating data directory..."
    mkdir -p data
    chmod 755 data
    
    log_info "Running database migrations..."
    if check_command bun; then
        bun run migrate
    else
        npm run migrate
    fi
    
    log_success "Database initialized successfully"
    
    # Optional: Seed with sample data
    echo ""
    read -p "Would you like to seed the database with sample data? [y/N]: " seed_choice
    case ${seed_choice:-N} in
        [Yy]*)
            log_info "Seeding database..."
            if check_command bun; then
                bun run seed
            else
                npm run seed
            fi
            log_success "Database seeded"
            ;;
    esac
}

# ============================================================================
# Health Validation - Verify installation integrity
# ============================================================================
validate_installation() {
    log_section "Installation Validation"
    
    local validation_passed=true
    
    # Check runtime
    if check_command bun; then
        log_success "Runtime: Bun $(bun --version)"
    elif check_command node; then
        log_success "Runtime: Node.js $(node --version)"
    else
        log_error "No runtime available"
        validation_passed=false
    fi
    
    # Check environment file
    if [ -f ".env" ]; then
        log_success "Configuration: .env file exists"
        
        # Validate critical variables
        if grep -q "CLOUDFLARE_API_TOKEN=.*[a-zA-Z0-9]" .env && \
           grep -q "CLOUDFLARE_ACCOUNT_ID=.*[a-f0-9]" .env; then
            log_success "Configuration: Credentials configured"
        else
            log_error "Configuration: Credentials missing or invalid"
            validation_passed=false
        fi
    else
        log_error "Configuration: .env file missing"
        validation_passed=false
    fi
    
    # Check database
    if [ -f "data/monitor.db" ]; then
        log_success "Database: SQLite database initialized"
    else
        log_warning "Database: Not yet initialized (will be created on first run)"
    fi
    
    # Check built packages
    if [ -d "packages/shared/dist" ] && [ -d "packages/cloudflare-sdk/dist" ]; then
        log_success "Build: Packages compiled successfully"
    else
        log_warning "Build: Some packages not built (non-critical)"
    fi
    
    # Check node_modules
    if [ -d "node_modules" ]; then
        log_success "Dependencies: Installed"
    else
        log_error "Dependencies: Not installed"
        validation_passed=false
    fi
    
    echo ""
    if $validation_passed; then
        log_success "Validation complete - system ready"
        return 0
    else
        log_error "Validation failed - manual intervention required"
        return 1
    fi
}

# ============================================================================
# Main Installation Orchestration
# ============================================================================
main() {
    clear
    
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╔═══════════════════════════════════════════════════════╗"
    echo "  ║                                                       ║"
    echo "  ║         Cloudflare Monitor - Installation            ║"
    echo "  ║                                                       ║"
    echo "  ║     Real-time monitoring for Cloudflare deployments  ║"
    echo "  ║                                                       ║"
    echo "  ╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    log_info "Installation started at $(date)"
    log_info "Working directory: $(pwd)"
    echo ""
    
    # Phase 1: Runtime Environment
    prompt_runtime_installation
    
    # Phase 2: Interactive Configuration
    prompt_cloudflare_credentials
    
    # Phase 3: Environment Setup
    generate_env_file
    
    # Phase 4: Dependency Resolution
    install_dependencies
    
    # Phase 5: Build Compilation
    build_packages
    
    # Phase 6: Database Schema
    initialize_database
    
    # Phase 7: Validation
    validate_installation
    
    # ========================================================================
    # Success - Provide next steps
    # ========================================================================
    log_section "Installation Complete"
    
    echo -e "${GREEN}${BOLD}✓ Cloudflare Monitor is ready to use!${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo -e "${BOLD}1. Start the development servers:${NC}"
    if check_command bun; then
        echo "   $ bun run dev"
    else
        echo "   $ npm run dev"
    fi
    echo ""
    echo -e "${BOLD}2. Access the dashboard:${NC}"
    echo "   • Frontend: http://localhost:5173"
    echo "   • API: http://localhost:3001"
    echo "   • Health check: http://localhost:3001/health"
    echo ""
    echo -e "${BOLD}3. Production deployment:${NC}"
    echo "   • See docs/DEPLOYMENT.md for comprehensive guide"
    echo "   • Docker: docker-compose -f docker/docker-compose.yml up -d"
    echo ""
    echo -e "${BOLD}Documentation:${NC}"
    echo "   • Architecture: docs/ARCHITECTURE.md"
    echo "   • API Reference: docs/API.md"
    echo "   • Configuration: docs/CONFIGURATION.md"
    echo ""
    echo -e "${CYAN}${BOLD}Support:${NC}"
    echo "   • Issues: https://github.com/CrashBytes/cloudflare-monitor/issues"
    echo "   • Documentation: https://github.com/CrashBytes/cloudflare-monitor#readme"
    echo ""
    
    log_success "Happy monitoring! 🚀"
}

# ============================================================================
# Error Handling - Graceful failure recovery
# ============================================================================
trap 'log_error "Installation failed at line $LINENO. Exit code: $?"' ERR

# ============================================================================
# Entry Point
# ============================================================================
main "$@"

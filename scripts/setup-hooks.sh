#!/usr/bin/env bash

##############################################################################
# Pre-Commit Hook Setup Script
#
# Installs automated secret scanning as a git pre-commit hook
# Prevents credential commits at source - before they reach remote repository
#
# Author: CrashBytes
# Version: 2.0.0 - macOS compatible
##############################################################################

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

readonly HOOK_PATH=".git/hooks/pre-commit"
readonly BACKUP_PATH=".git/hooks/pre-commit.backup"

##############################################################################
# Display Functions
##############################################################################

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║          🔒 Pre-Commit Security Hook Installer                 ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║   Automated secret scanning before every git commit            ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

##############################################################################
# Validation Functions
##############################################################################

check_git_repository() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not a git repository"
        echo "Run this script from the root of your git project"
        exit 1
    fi
    print_success "Git repository detected"
}

backup_existing_hook() {
    if [ -f "$HOOK_PATH" ]; then
        print_warning "Existing pre-commit hook found"
        
        # Create backup
        cp "$HOOK_PATH" "$BACKUP_PATH"
        print_info "Backup created: $BACKUP_PATH"
        
        echo ""
        read -p "Overwrite existing hook? (y/N) " -n 1 -r
        echo ""
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Installation cancelled"
            exit 0
        fi
    fi
}

##############################################################################
# Hook Installation
##############################################################################

create_pre_commit_hook() {
    print_info "Creating pre-commit hook..."
    
    cat > "$HOOK_PATH" << 'EOF'
#!/usr/bin/env bash

##############################################################################
# Git Pre-Commit Hook - Secret Scanner
#
# Automatically scans staged files for credentials before allowing commit
# Compatible with macOS and Linux
##############################################################################

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Scanning staged files for secrets...${NC}"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No files to scan${NC}"
    exit 0
fi

SECRETS_FOUND=0

# Function to report a finding
report_finding() {
    local file="$1"
    local pattern_name="$2"
    
    if [ $SECRETS_FOUND -eq 0 ]; then
        echo ""
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                  ⚠️  COMMIT BLOCKED  ⚠️                         ║${NC}"
        echo -e "${RED}║           Potential credentials detected in staged files       ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi
    
    echo -e "${RED}✗ Potential secret in:${NC} $file"
    echo -e "  Pattern: ${YELLOW}$pattern_name${NC}"
    echo ""
    
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
}

# Files to completely skip
should_skip_file() {
    local file="$1"
    case "$file" in
        package-lock.json|yarn.lock|bun.lockb|*.min.js|*.map)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Files where placeholder tokens are expected (don't scan for generic patterns)
is_documentation_file() {
    local file="$1"
    case "$file" in
        .env.example|*.md|README*|CHANGELOG*|docs/*|install.sh|scripts/*)
            return 0
            ;;
        *test*|*spec*|*mock*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Scan each staged file
for file in $STAGED_FILES; do
    # Skip lock files and minified
    if should_skip_file "$file"; then
        continue
    fi
    
    # Skip binary files
    if [ -f "$file" ] && ! file "$file" | grep -q "text"; then
        continue
    fi
    
    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
        continue
    fi
    
    # Get file content
    content=$(cat "$file")
    
    # ==========================================================================
    # HIGH SEVERITY: Always scan for these (real secrets)
    # ==========================================================================
    
    # AWS Access Key IDs (very specific format)
    if echo "$content" | grep -qE 'AKIA[0-9A-Z]{16}'; then
        report_finding "$file" "AWS Access Key ID"
    fi
    
    # Private keys (use grep with fixed string for the dash issue)
    if echo "$content" | grep -q "BEGIN RSA PRIVATE KEY" || \
       echo "$content" | grep -q "BEGIN OPENSSH PRIVATE KEY" || \
       echo "$content" | grep -q "BEGIN PRIVATE KEY" || \
       echo "$content" | grep -q "BEGIN PGP PRIVATE KEY"; then
        report_finding "$file" "Private Key"
    fi
    
    # Database connection strings with credentials
    if echo "$content" | grep -qE '(postgres|mysql|mongodb)://[^:]+:[^@]+@'; then
        report_finding "$file" "Database credentials in URL"
    fi
    
    # JWT tokens (very specific format)
    if echo "$content" | grep -qE 'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}'; then
        # Exclude if in a test file checking for JWT format
        if ! is_documentation_file "$file"; then
            report_finding "$file" "JWT Token"
        fi
    fi
    
    # ==========================================================================
    # MEDIUM SEVERITY: Skip for documentation/example files
    # ==========================================================================
    
    if ! is_documentation_file "$file"; then
        # Hardcoded token assignments (but not placeholders)
        # Look for actual hex/base64 values, not placeholder text
        if echo "$content" | grep -qE "(api_token|apiToken|API_TOKEN)[[:space:]]*[=:][[:space:]]*['\"][a-zA-Z0-9+/=_-]{32,}['\"]"; then
            # Exclude obvious placeholders
            if ! echo "$content" | grep -qE "(your_|example_|placeholder|xxxx|test_token|fake_)"; then
                report_finding "$file" "Hardcoded API token"
            fi
        fi
        
        # Cloudflare API tokens (40 char, but only if it looks real)
        # Real CF tokens don't contain underscores and are alphanumeric
        if echo "$content" | grep -qE "CF_API_TOKEN[[:space:]]*[=:][[:space:]]*['\"]?[a-zA-Z0-9]{40}['\"]?"; then
            if ! echo "$content" | grep -qE "your_|example|placeholder|xxxx"; then
                report_finding "$file" "Cloudflare API Token"
            fi
        fi
    fi
    
    # ==========================================================================
    # Check for .env file being committed (should never happen)
    # ==========================================================================
    
    if [[ "$file" == ".env" ]] || [[ "$file" == ".env.local" ]] || [[ "$file" == ".env.production" ]]; then
        report_finding "$file" ".env file should not be committed"
    fi
    
done

# Final result
if [ $SECRETS_FOUND -gt 0 ]; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${YELLOW}REMEDIATION STEPS:${NC}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "1. Remove secrets from files"
    echo "2. Unstage: git reset HEAD <file>"
    echo "3. Fix and re-add: git add <file>"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${YELLOW}If this is a false positive:${NC}"
    echo "  git commit --no-verify"
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
else
    echo -e "${GREEN}✓ No secrets detected${NC}"
    exit 0
fi
EOF

    chmod +x "$HOOK_PATH"
    print_success "Pre-commit hook installed"
}

##############################################################################
# Verification
##############################################################################

verify_installation() {
    print_info "Verifying installation..."
    
    if [ ! -f "$HOOK_PATH" ]; then
        print_error "Hook file not found: $HOOK_PATH"
        exit 1
    fi
    
    if [ ! -x "$HOOK_PATH" ]; then
        print_error "Hook file not executable"
        exit 1
    fi
    
    print_success "Hook verified and operational"
}

##############################################################################
# Usage Information
##############################################################################

show_usage_info() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${GREEN}✓ Pre-Commit Hook Installed Successfully${NC}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "WHAT THIS DOES:"
    echo "• Scans every commit for credential patterns"
    echo "• Blocks commits containing potential secrets"
    echo "• Runs automatically - no manual intervention needed"
    echo "• Excludes .env.example, docs, and test files from false positives"
    echo ""
    echo "HOW TO USE:"
    echo "• Continue using git normally: git commit -m \"message\""
    echo "• If secrets detected, commit will be blocked"
    echo "• Remove secrets and retry commit"
    echo ""
    echo "BYPASSING (use sparingly!):"
    echo "• git commit --no-verify -m \"message\""
    echo "  ⚠️  Only for verified false positives"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    print_success "You're protected! Future commits will be scanned automatically."
    echo ""
}

##############################################################################
# Main Execution
##############################################################################

main() {
    print_header
    
    # Validation
    check_git_repository
    backup_existing_hook
    
    echo ""
    
    # Installation
    create_pre_commit_hook
    verify_installation
    
    # Information
    show_usage_info
    
    print_success "Setup complete!"
}

# Script entry point
main "$@"

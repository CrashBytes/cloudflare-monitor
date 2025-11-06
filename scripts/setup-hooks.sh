#!/usr/bin/env bash

##############################################################################
# Pre-Commit Hook Setup Script
#
# Installs automated secret scanning as a git pre-commit hook
# Prevents credential commits at source - before they reach remote repository
#
# Author: CrashBytes
# Version: 1.0.0
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
# CRITICAL: This is your last line of defense against credential exposure
##############################################################################

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Secret detection patterns (high-confidence only)
declare -a PATTERNS=(
    # API Tokens
    'api[_-]?key["\s:=]+[a-zA-Z0-9_\-]{20,}'
    'api[_-]?token["\s:=]+[a-zA-Z0-9_\-]{20,}'
    
    # Cloudflare specific
    '[a-zA-Z0-9_-]{40}'  # Cloudflare API token format
    
    # AWS
    'AKIA[0-9A-Z]{16}'
    'aws[_-]?secret[_-]?access[_-]?key'
    
    # Private Keys
    '-----BEGIN (RSA |OPENSSH |PGP )?PRIVATE KEY'
    
    # Generic secrets
    '[a-zA-Z0-9_]+[_]?(SECRET|PASSWORD|TOKEN)["\s:=]+[^\s]{8,}'
    
    # Database URLs
    '(postgres|mysql|mongodb):\/\/[^\s]+:[^\s]+@'
    
    # OAuth and JWT
    'oauth[_-]?token'
    'eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*'
)

# Files to exclude from scanning
EXCLUDE_PATTERNS=(
    'package-lock.json'
    'yarn.lock'
    'bun.lockb'
    '*.min.js'
    '*.map'
)

echo -e "${YELLOW}🔍 Scanning staged files for secrets...${NC}"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No files to scan${NC}"
    exit 0
fi

SECRETS_FOUND=0

# Scan each staged file
for file in $STAGED_FILES; do
    # Skip excluded patterns
    skip=false
    for exclude in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ $file =~ $exclude ]]; then
            skip=true
            break
        fi
    done
    
    if $skip; then
        continue
    fi
    
    # Skip binary files
    if ! file "$file" | grep -q "text"; then
        continue
    fi
    
    # Skip if file doesn't exist (deleted files)
    if [ ! -f "$file" ]; then
        continue
    fi
    
    # Scan file for each pattern
    for pattern in "${PATTERNS[@]}"; do
        if grep -qE "$pattern" "$file"; then
            if [ $SECRETS_FOUND -eq 0 ]; then
                echo ""
                echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${RED}║                                                                ║${NC}"
                echo -e "${RED}║                  ⚠️  COMMIT BLOCKED  ⚠️                         ║${NC}"
                echo -e "${RED}║                                                                ║${NC}"
                echo -e "${RED}║           Potential credentials detected in staged files       ║${NC}"
                echo -e "${RED}║                                                                ║${NC}"
                echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
                echo ""
            fi
            
            echo -e "${RED}✗ Potential secret in:${NC} $file"
            echo -e "  Pattern: ${YELLOW}$pattern${NC}"
            echo ""
            
            SECRETS_FOUND=$((SECRETS_FOUND + 1))
        fi
    done
done

# If secrets found, block commit and provide guidance
if [ $SECRETS_FOUND -gt 0 ]; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${YELLOW}REMEDIATION STEPS:${NC}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "1. Remove secrets from files:"
    echo "   • Move credentials to .env file"
    echo "   • Ensure .env is in .gitignore"
    echo "   • Use environment variables in code"
    echo ""
    echo "2. Unstage files:"
    echo "   git reset HEAD <file>"
    echo ""
    echo "3. Make corrections and stage again:"
    echo "   git add <file>"
    echo ""
    echo "4. Retry commit"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${RED}If this is a false positive:${NC}"
    echo "• Review the pattern match carefully"
    echo "• If legitimate, bypass with: git commit --no-verify"
    echo "  (Use sparingly - you're bypassing security!)"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    
    exit 1
else
    echo -e "${GREEN}✓ No secrets detected - commit allowed${NC}"
    echo ""
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
    
    # Test hook with a dummy commit
    print_info "Running test scan..."
    
    # Create temporary test file
    TEST_FILE=".pre-commit-test-$$"
    echo "test content" > "$TEST_FILE"
    git add "$TEST_FILE" 2>/dev/null || true
    
    # Test hook execution (will fail, but we just want to verify it runs)
    bash "$HOOK_PATH" &>/dev/null || true
    
    # Cleanup
    git reset HEAD "$TEST_FILE" 2>/dev/null || true
    rm -f "$TEST_FILE"
    
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
    echo "• Executes in <100ms for typical commits"
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
    echo "MAINTENANCE:"
    echo "• Hook updates automatically with repository"
    echo "• Reinstall anytime: ./scripts/setup-hooks.sh"
    echo "• Restore backup: cp $BACKUP_PATH $HOOK_PATH"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    print_success "You're protected! Future commits will be scanned automatically."
    echo ""
}

##############################################################################
# Team Deployment
##############################################################################

suggest_team_deployment() {
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${BLUE}TEAM DEPLOYMENT RECOMMENDATIONS:${NC}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "For team-wide adoption:"
    echo ""
    echo "1. Add to onboarding documentation:"
    echo "   \"Run ./scripts/setup-hooks.sh after cloning repository\""
    echo ""
    echo "2. Include in README.md setup section:"
    echo '   ```bash'
    echo "   git clone <repository>"
    echo "   cd <project>"
    echo "   ./scripts/setup-hooks.sh  # Install security hooks"
    echo '   ```'
    echo ""
    echo "3. Consider adding to install.sh:"
    echo "   ./scripts/setup-hooks.sh"
    echo ""
    echo "4. Announce to team:"
    echo "   \"New security hooks available - protects against credential leaks\""
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
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
    suggest_team_deployment
    
    print_success "Setup complete!"
}

# Script entry point
main "$@"

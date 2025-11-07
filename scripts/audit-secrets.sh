#!/usr/bin/env bash

##############################################################################
# Historical Secret Audit Script
# 
# Scans entire git history for exposed credentials, API keys, and sensitive data
# CRITICAL: Run before making repository public or granting new access
#
# Author: CrashBytes
# Version: 1.0.0
##############################################################################

set -euo pipefail  # Exit on error, undefined variable, or pipe failure

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="Historical Secret Audit"

##############################################################################
# Display Functions
##############################################################################

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║           🔒 ${SCRIPT_NAME} v${SCRIPT_VERSION}                    ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║  Comprehensive credential scanning across entire git history   ║${NC}"
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
        print_error "Not a git repository. Run from project root."
        exit 1
    fi
    print_success "Git repository detected"
}

check_dependencies() {
    local missing_deps=()
    
    # Check for required commands
    command -v git >/dev/null 2>&1 || missing_deps+=("git")
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Install instructions:"
        echo "  macOS:   brew install git"
        echo "  Ubuntu:  sudo apt-get install git"
        exit 1
    fi
    
    print_success "All dependencies available"
}

##############################################################################
# Secret Scanning Patterns
##############################################################################

# High-confidence patterns for common credential formats
declare -A SECRET_PATTERNS=(
    # API Keys and Tokens
    ["Cloudflare API Token"]='[a-zA-Z0-9_-]{40,}'
    ["Generic API Key"]='api[_-]?key["\s:=]+[a-zA-Z0-9_\-]{20,}'
    ["Bearer Token"]='bearer\s+[a-zA-Z0-9_\-\.]{20,}'
    
    # AWS Credentials
    ["AWS Access Key"]='AKIA[0-9A-Z]{16}'
    ["AWS Secret Key"]='aws[_-]?secret[_-]?access[_-]?key["\s:=]+[a-zA-Z0-9/+=]{40}'
    
    # Private Keys
    ["RSA Private Key"]='-----BEGIN RSA PRIVATE KEY-----'
    ["SSH Private Key"]='-----BEGIN OPENSSH PRIVATE KEY-----'
    ["PGP Private Key"]='-----BEGIN PGP PRIVATE KEY BLOCK-----'
    
    # Database Credentials
    ["Database URL"]='(postgres|mysql|mongodb):\/\/[^\s]+:[^\s]+@'
    ["Connection String"]='(server|host|hostname)["\s:=]+[a-zA-Z0-9\.\-]+["\s;,]+.*password["\s:=]+[^\s;,]+'
    
    # Environment Variables (common patterns)
    ["API Token Env Var"]='[A-Z_]+TOKEN["\s:=]+[a-zA-Z0-9_\-]{20,}'
    ["Secret Env Var"]='[A-Z_]+SECRET["\s:=]+[a-zA-Z0-9_\-]{20,}'
    ["Password Env Var"]='[A-Z_]+PASSWORD["\s:=]+[^\s]{8,}'
    
    # OAuth and JWT
    ["OAuth Token"]='oauth[_-]?token["\s:=]+[a-zA-Z0-9_\-\.]{20,}'
    ["JWT Token"]='eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*'
    
    # Generic High-Entropy Strings (potential secrets)
    ["High Entropy String"]='["\047][a-zA-Z0-9+/=]{40,}["\047]'
)

##############################################################################
# Scanning Functions
##############################################################################

scan_git_history() {
    local findings=0
    local scanned_commits=0
    local temp_file="/tmp/git-audit-$$"
    
    print_info "Scanning entire git history for credential patterns..."
    echo ""
    
    # Get all commit hashes
    local commits=$(git rev-list --all)
    local total_commits=$(echo "$commits" | wc -l | tr -d ' ')
    
    print_info "Analyzing $total_commits commits..."
    echo ""
    
    # Scan each pattern
    for pattern_name in "${!SECRET_PATTERNS[@]}"; do
        local pattern="${SECRET_PATTERNS[$pattern_name]}"
        
        print_info "Checking for: $pattern_name"
        
        # Search git log for pattern
        git log --all -p -G"$pattern" --format="%H|%an|%ae|%ad|%s" > "$temp_file" 2>/dev/null || true
        
        if [ -s "$temp_file" ]; then
            print_warning "FOUND: $pattern_name"
            
            # Parse and display findings
            while IFS='|' read -r commit_hash author email date subject; do
                echo "  Commit: $commit_hash"
                echo "  Author: $author <$email>"
                echo "  Date:   $date"
                echo "  Subject: $subject"
                echo ""
                ((findings++))
            done < <(grep -v '^$' "$temp_file" | sort -u)
        fi
    done
    
    rm -f "$temp_file"
    
    return $findings
}

scan_current_working_tree() {
    print_info "Scanning current working tree for uncommitted secrets..."
    echo ""
    
    local findings=0
    
    # Scan tracked files
    for file in $(git ls-files); do
        # Skip binary files
        if file "$file" | grep -q "text"; then
            for pattern_name in "${!SECRET_PATTERNS[@]}"; do
                local pattern="${SECRET_PATTERNS[$pattern_name]}"
                
                if grep -qE "$pattern" "$file" 2>/dev/null; then
                    print_warning "FOUND in working tree: $pattern_name"
                    echo "  File: $file"
                    echo ""
                    ((findings++))
                fi
            done
        fi
    done
    
    if [ $findings -eq 0 ]; then
        print_success "No secrets detected in working tree"
    fi
    
    return $findings
}

##############################################################################
# Remediation Guidance
##############################################################################

show_remediation_steps() {
    local total_findings=$1
    
    if [ $total_findings -eq 0 ]; then
        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                                ║${NC}"
        echo -e "${GREEN}║                  ✓ AUDIT PASSED                                ║${NC}"
        echo -e "${GREEN}║                                                                ║${NC}"
        echo -e "${GREEN}║           No credentials found in git history                  ║${NC}"
        echo -e "${GREEN}║                                                                ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        print_success "Repository is safe for public exposure"
        return 0
    else
        echo ""
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                                                ║${NC}"
        echo -e "${RED}║                  ✗ AUDIT FAILED                                ║${NC}"
        echo -e "${RED}║                                                                ║${NC}"
        echo -e "${RED}║         $total_findings potential credential(s) detected in history          ║${NC}"
        echo -e "${RED}║                                                                ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        
        print_error "CRITICAL: Do NOT make repository public until remediated"
        echo ""
        
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                     REMEDIATION STEPS                          ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo ""
        
        echo "1. ROTATE ALL EXPOSED CREDENTIALS IMMEDIATELY"
        echo "   ↳ Assume any detected secret is compromised"
        echo "   ↳ Generate new keys/tokens with minimum required permissions"
        echo ""
        
        echo "2. REWRITE GIT HISTORY (Choose one method):"
        echo ""
        echo "   Method A: BFG Repo-Cleaner (Recommended - Fast & Safe)"
        echo "   ┌────────────────────────────────────────────────────────────┐"
        echo "   │ brew install bfg                                           │"
        echo "   │                                                            │"
        echo "   │ # Create replacement file (secrets.txt):                  │"
        echo "   │ # EXPOSED_TOKEN_HERE==>***REMOVED***                       │"
        echo "   │                                                            │"
        echo "   │ bfg --replace-text secrets.txt                             │"
        echo "   │ git reflog expire --expire=now --all                       │"
        echo "   │ git gc --prune=now --aggressive                            │"
        echo "   └────────────────────────────────────────────────────────────┘"
        echo ""
        
        echo "   Method B: git-filter-repo (Modern Alternative)"
        echo "   ┌────────────────────────────────────────────────────────────┐"
        echo "   │ pip install git-filter-repo                                │"
        echo "   │ git filter-repo --invert-paths --path .env --force         │"
        echo "   └────────────────────────────────────────────────────────────┘"
        echo ""
        
        echo "3. FORCE PUSH CLEANED HISTORY"
        echo "   ┌────────────────────────────────────────────────────────────┐"
        echo "   │ git push --force-with-lease origin main                    │"
        echo "   └────────────────────────────────────────────────────────────┘"
        echo ""
        
        echo "4. NOTIFY ALL COLLABORATORS"
        echo "   ↳ All contributors must delete local clones"
        echo "   ↳ Re-clone from cleaned remote repository"
        echo ""
        
        echo "5. INSTALL PREVENTIVE CONTROLS"
        echo "   ┌────────────────────────────────────────────────────────────┐"
        echo "   │ ./scripts/setup-hooks.sh                                   │"
        echo "   └────────────────────────────────────────────────────────────┘"
        echo ""
        
        print_warning "DO NOT SKIP CREDENTIAL ROTATION - Exposed secrets are compromised"
        
        return 1
    fi
}

##############################################################################
# Main Execution
##############################################################################

main() {
    print_header
    
    # Pre-flight checks
    check_git_repository
    check_dependencies
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    
    # Run scans
    local history_findings=0
    local working_tree_findings=0
    
    scan_git_history
    history_findings=$?
    
    echo ""
    echo "───────────────────────────────────────────────────────────────────"
    echo ""
    
    scan_current_working_tree
    working_tree_findings=$?
    
    # Calculate total findings
    local total_findings=$((history_findings + working_tree_findings))
    
    # Show results and remediation guidance
    show_remediation_steps $total_findings
    
    # Exit with appropriate code
    exit $total_findings
}

# Script entry point
main "$@"

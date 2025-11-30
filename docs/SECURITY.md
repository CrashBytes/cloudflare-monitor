# Comprehensive Security Guide

## Security Philosophy

This project embodies a security-first architectural approach, recognizing that credential protection transcends mere compliance—it represents a fundamental engineering discipline requiring systematic rigor and continuous vigilance.

### Core Security Principles

1. **Defense in Depth**: Multi-layered security controls across development, CI/CD, and runtime
2. **Principle of Least Privilege**: Minimal permissions for all credentials and service accounts
3. **Secure by Default**: Security controls active from first commit, not retrofitted
4. **Automation Over Process**: Tooling enforces security policies consistently
5. **Transparency**: Security practices documented and auditable

---

## Critical Security Domains

### 1. Credential Management

**Never commit secrets to version control.** This fundamental principle is non-negotiable.

#### Cloudflare API Tokens

**Scoped Token Creation**:
```bash
# Create a minimal-privilege token:
# 1. Navigate to: https://dash.cloudflare.com/profile/api-tokens
# 2. Click "Create Token"
# 3. Use "Create Custom Token"
# 4. Grant ONLY:
#    - Account.Cloudflare Pages:Read
#    - Account.Workers Scripts:Read
#    - Account.Workers KV Storage:Read
```

**Required Permissions by Feature**:

| Feature | Minimum Permission |
|---------|-------------------|
| Pages Monitoring | `Account.Cloudflare Pages:Read` |
| Workers Monitoring | `Account.Workers Scripts:Read` |
| KV Monitoring | `Account.Workers KV Storage:Read` |
| D1 Monitoring | `Account.D1:Read` |
| R2 Monitoring | `Account.R2:Read` |

#### Environment Variable Hygiene

**Local Development**:
```bash
# Copy template
cp .env.example .env

# Edit with your credentials
# .env is in .gitignore - never commit this file
nano .env
```

**Production Deployment**:
```bash
# Use environment-specific secrets management
# Docker Compose:
docker-compose --env-file .env.production up

# Kubernetes:
kubectl create secret generic cf-monitor-secrets \
  --from-literal=CF_API_TOKEN=your_token_here \
  --from-literal=CF_ACCOUNT_ID=your_account_id
```

**Never**:
- Hardcode credentials in source code
- Commit `.env` files to git
- Share credentials via chat/email
- Use production credentials in development
- Store credentials in code comments

---

### 2. Git History Protection

#### Pre-Commit Hook Installation

Automated secret scanning prevents credential leaks at commit-time:

```bash
# One-time setup (recommended)
./scripts/setup-hooks.sh

# Verify installation
ls -la .git/hooks/pre-commit
```

The pre-commit hook:
- Scans staged files for secret patterns
- Blocks commits containing sensitive data
- Provides remediation guidance
- Runs in <100ms for typical commits

#### Historical Audit

**Before making repository public**, audit entire git history:

```bash
# Run comprehensive secret scan
./scripts/audit-secrets.sh

# Review findings carefully
# Remediate any discovered secrets before proceeding
```

**If secrets found in history**:

```bash
# Option 1: BFG Repo-Cleaner (recommended)
brew install bfg
bfg --replace-text secrets.txt  # Contains: SECRET_KEY==>***REMOVED***
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option 2: Git Filter-Repo
pip install git-filter-repo
git filter-repo --invert-paths --path .env --force

# After history rewrite:
# 1. Rotate ALL exposed credentials immediately
# 2. Force-push: git push --force-with-lease origin main
# 3. Notify all collaborators to re-clone
```

---

### 3. Continuous Integration Security

#### GitHub Actions Security Workflow

Automated secret scanning on every push and pull request:

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]

jobs:
  secret-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for comprehensive scanning
      
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Workflow Features**:
- Scans all commits in push
- Blocks merges if secrets detected
- Reports findings as GitHub Security Alerts
- Zero false-positive configuration

---

### 4. `.gitignore` Enforcement

Comprehensive patterns prevent accidental commits:

```gitignore
# Environment files (CRITICAL)
.env
.env.*
!.env.example

# Credentials and keys
*.key
*.pem
*.p12
*.pfx
secrets/
credentials/
.secrets/

# Database files
*.db
*.sqlite
*.sqlite3

# IDE and OS files
.vscode/settings.json
.idea/workspace.xml
*~
.DS_Store

# Dependency directories
node_modules/
bun.lockb

# Build outputs
dist/
build/
*.log
```

**Verification**:
```bash
# Test .gitignore patterns
echo "CF_API_TOKEN=test" > .env
git status  # Should NOT show .env

# Check for tracked sensitive files
git ls-files | grep -E '\.(env|key|pem)$'  # Should return empty
```

---

## Incident Response Procedures

### Secret Exposure Protocol

**If credentials are committed and pushed**:

#### Immediate Actions (< 5 minutes)
1. **Rotate compromised credentials instantly**
   ```bash
   # Cloudflare: Revoke token at
   # https://dash.cloudflare.com/profile/api-tokens
   ```

2. **Force-remove from remote repository**
   ```bash
   # Assuming secret in last commit
   git reset --hard HEAD~1
   git push --force-with-lease origin main
   ```

3. **Monitor for unauthorized access**
   - Check Cloudflare audit logs
   - Review API usage metrics for anomalies

#### Post-Incident (< 24 hours)
4. **Audit full git history** (see Historical Audit above)
5. **Implement preventive controls** (pre-commit hooks)
6. **Document incident** for team learning
7. **Review access controls** and permissions

#### Team Communication
```markdown
## Security Incident Report

**Date**: YYYY-MM-DD HH:MM UTC
**Severity**: High
**Summary**: API token exposed in commit [SHA]

**Actions Taken**:
- [x] Token revoked at HH:MM UTC
- [x] History rewritten and force-pushed
- [x] New token generated with reduced scope
- [x] Pre-commit hooks installed

**Lessons Learned**:
- Reinforce .env.example vs .env distinction
- Mandate pre-commit hook installation in onboarding
```

---

## Security Best Practices

### Development Workflow

1. **Initialize Project Security**
   ```bash
   # For every new checkout
   cp .env.example .env
   ./scripts/setup-hooks.sh
   git config --local commit.gpgsign true  # Optional: sign commits
   ```

2. **Credential Rotation Schedule**
   - Development tokens: Every 90 days
   - Production tokens: Every 30 days
   - After team member departure: Immediately

3. **Code Review Checklist**
   - [ ] No hardcoded credentials
   - [ ] No commented-out secrets
   - [ ] Environment variables properly referenced
   - [ ] No test credentials in production code
   - [ ] Appropriate error messages (no credential leaks)

### Secure Coding Patterns

**Correct Environment Variable Usage**:
```typescript
// CORRECT: Fail-fast validation
import { z } from 'zod';

const envSchema = z.object({
  CF_API_TOKEN: z.string().min(40),
  CF_ACCOUNT_ID: z.string().uuid(),
});

export const config = envSchema.parse(process.env);
```

**Logging Security**:
```typescript
// WRONG: Logs credential
console.log('API Response:', { token: apiToken, data });

// CORRECT: Sanitized logging
console.log('API Response:', { 
  token: '***REDACTED***', 
  data: sanitize(data) 
});
```

**Error Handling**:
```typescript
// WRONG: Exposes credential in error
throw new Error(`Auth failed with token: ${token}`);

// CORRECT: Generic error message
throw new Error('Authentication failed. Check credentials configuration.');
```

---

## Security Resources

### Recommended Tools

**Secret Scanning**:
- [Gitleaks](https://github.com/gitleaks/gitleaks) - Comprehensive secret detection
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - High entropy string detection
- [git-secrets](https://github.com/awslabs/git-secrets) - Pre-commit prevention

**History Rewriting**:
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) - Fast, safe history modification
- [git-filter-repo](https://github.com/newren/git-filter-repo) - Modern filter-branch replacement

**Credential Management**:
- [1Password CLI](https://developer.1password.com/docs/cli) - Programmatic secret access
- [HashiCorp Vault](https://www.vaultproject.io/) - Enterprise secret management
- [Doppler](https://www.doppler.com/) - Developer-focused secrets platform

### Installation Commands

```bash
# macOS (Homebrew)
brew install gitleaks bfg git-secrets

# Linux (Ubuntu/Debian)
curl -sSfL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_x64.tar.gz | \
  tar -xz -C /usr/local/bin
```

---

## Security Certification Checklist

Before making repository public or deploying to production:

### Critical Requirements
- [ ] Historical audit completed with zero findings
- [ ] `.gitignore` includes all security patterns
- [ ] Pre-commit hooks installed and tested
- [ ] All API tokens are scoped to minimum required permissions
- [ ] GitHub Actions security workflow configured and passing
- [ ] Credentials rotated to fresh values (never reuse exposed tokens)
- [ ] `.env.example` contains only placeholder values
- [ ] README.md includes zero actual credentials

### Recommended Practices
- [ ] Credential rotation schedule documented
- [ ] Incident response procedure tested with tabletop exercise
- [ ] Security contact published in SECURITY.md
- [ ] Monitoring configured for unauthorized API usage
- [ ] Branch protection rules enabled (require status checks)
- [ ] Team security training completed

### Advanced Controls
- [ ] Signed commits enforced (GPG/SSH signatures)
- [ ] Dependency vulnerability scanning (Dependabot/Snyk)
- [ ] Security.txt file published per RFC 9116
- [ ] Bug bounty program considered for public repos
- [ ] Penetration testing completed for production deployments

---

## Continuous Improvement

Security is not a one-time achievement but a continuous discipline requiring vigilance and adaptation.

### Monthly Review
- Audit recent commits for security best practices
- Review access logs for anomalous patterns
- Update dependencies for security patches
- Rotate credentials per schedule

### Quarterly Assessment
- Penetration testing (if public-facing)
- Review and update security documentation
- Team security training refresher
- Evaluate new security tooling

### Incident Retrospectives
After any security incident:
1. Document timeline and root cause
2. Identify systemic failures
3. Implement preventive controls
4. Share learnings (anonymized) with team

---

## Security Contact

**Non-urgent security questions**: Open GitHub issue with `security` label  
**Potential vulnerability**: Email security@crashbytes.com  
**Active incident**: Follow incident response protocol above

Response time commitments:
- Critical incidents: < 4 hours
- High severity: < 24 hours
- Medium/Low: < 5 business days

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2024-11-06 | Initial comprehensive security framework | CrashBytes |
| 2024-11-06 | Added pre-commit hook automation | CrashBytes |
| 2024-11-06 | GitHub Actions security workflow integrated | CrashBytes |

---

**Remember**: Security is everyone's responsibility. When in doubt, ask. It's always better to raise a false alarm than to miss a real threat.

*Built with security-first principles by CrashBytes*

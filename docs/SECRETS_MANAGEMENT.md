# Secrets Management Guide

## Overview

This document outlines how the R3 team manages secrets and credentials across all environments.

## Vault Access

### Getting Started

1. **Request Access**
   - Contact team admin for vault access
   - Specify which environment(s) you need
   - Provide GitHub username for audit trail

2. **Vault Structure**
   ```
   R3 Vault/
   ├── r3-dev-secrets/      # All developers
   ├── r3-stage-secrets/    # Senior developers
   └── r3-prod-secrets/     # Admin only
   ```

3. **Access Levels**
   - **Developer**: Read access to dev/test secrets
   - **Senior Developer**: Read access to dev/stage secrets
   - **Admin**: Full access to all secrets

## Secret Categories

### Public Information (Safe to Share)
These can be committed to code or documentation:
- Stripe publishable keys (pk_test_*, pk_live_*)
- Shopify store domain
- Public API endpoints
- Theme IDs

### Private Secrets (Vault Only)
Never commit these to code:
- Stripe secret keys (sk_test_*, sk_live_*)
- Webhook secrets
- Admin API tokens
- Database credentials
- Redis/KV tokens

## Environment-Specific Secrets

### Development
```yaml
Location: r3-dev-secrets/
Access: All developers
Contains:
  - Stripe test keys
  - Shopify dev store tokens
  - Local Redis credentials
```

### Staging
```yaml
Location: r3-stage-secrets/
Access: Senior developers
Contains:
  - Stripe test keys (staging-specific)
  - Shopify staging theme tokens
  - Staging Vercel tokens
```

### Production
```yaml
Location: r3-prod-secrets/
Access: Admin only
Contains:
  - Stripe live keys
  - Production API tokens
  - Production webhook secrets
```

## Using Secrets in Development

### Local Development

1. **Get secrets from vault**
   ```bash
   # Access vault (1Password example)
   op signin
   op get item "r3-dev-secrets"
   ```

2. **Create local .env file**
   ```bash
   cp .env.example .env
   # Add secrets from vault to .env
   ```

3. **Never commit .env files**
   ```bash
   # .gitignore should include
   .env
   .env.*
   ```

### CI/CD Secrets

GitHub Actions secrets are managed separately:
1. Go to repository Settings → Secrets
2. Add secrets with same names as vault
3. Reference in workflows: `${{ secrets.SECRET_NAME }}`

## Secret Rotation

### Schedule
- **API Keys**: Every 90 days
- **Webhook Secrets**: Every 180 days
- **Admin Tokens**: Every 60 days
- **Immediately**: If compromise suspected

### Rotation Process

1. **Generate new secret** in provider dashboard
2. **Update vault** with new value
3. **Update production** environment variables
4. **Test** with new secret
5. **Revoke old secret** after verification
6. **Notify team** of rotation

## Security Best Practices

### DO's
✅ Use vault for all secrets
✅ Use environment variables in code
✅ Rotate secrets regularly
✅ Use different keys per environment
✅ Enable 2FA on all accounts
✅ Audit access logs regularly

### DON'Ts
❌ Never hardcode secrets
❌ Never commit secrets to Git
❌ Never share secrets via Slack/email
❌ Never use production keys in dev
❌ Never store secrets in browser storage
❌ Never log secret values

## Emergency Procedures

### If a Secret is Compromised

1. **IMMEDIATELY** revoke the compromised key
2. Generate new secret
3. Update all systems using the secret
4. Audit logs for unauthorized usage
5. Document incident
6. Review how compromise occurred

### Lost Access to Vault

1. Contact team admin immediately
2. Use backup admin account
3. Follow recovery procedure in vault
4. Re-verify all team access

## Vault Backup

Vault backups are automated:
- **Frequency**: Daily
- **Retention**: 30 days
- **Location**: Encrypted cloud storage
- **Recovery**: Contact admin

## Monitoring

### Access Logs
- Review weekly for unusual access
- Alert on production secret access
- Track failed authentication attempts

### Expiration Tracking
- Automated alerts 7 days before expiration
- Dashboard showing expiration dates
- Quarterly review of all secrets

## Common Secret Locations

### Vercel
```
Project Settings → Environment Variables
- Set per branch (dev/stage/prod)
- Encrypted at rest
- Accessible via process.env
```

### GitHub Actions
```
Repository Settings → Secrets → Actions
- Encrypted secrets
- Available in workflows
- Scoped to repository/organization
```

### Stripe Dashboard
```
Developers → API Keys
Developers → Webhooks → Signing Secret
- Separate test/live modes
- Webhook secrets per endpoint
```

### Shopify Admin
```
Apps → Manage private apps
Settings → Notifications → Webhooks
- Admin API access tokens
- Webhook verification keys
```

## Team Onboarding

### New Developer Checklist
- [ ] Grant vault access (dev level)
- [ ] Share public keys document
- [ ] Provide .env.example templates
- [ ] Review security practices
- [ ] Set up 2FA on all services
- [ ] Sign NDA if required

### Offboarding
- [ ] Revoke vault access
- [ ] Rotate any shared secrets
- [ ] Remove from GitHub organization
- [ ] Audit recent access logs
- [ ] Update access documentation

## Questions?

- Check internal wiki for more details
- Ask in #security Slack channel
- Contact security team for sensitive issues

Remember: **When in doubt, don't share it out!**
# Domain Migration Checklist: rthree.io

*Comprehensive checklist for migrating from test domains to production rthree.io*

## Pre-Migration Preparation

### DNS & Infrastructure
- [ ] **DNS Records Setup**
  - [ ] A record pointing to Shopify
  - [ ] CNAME records for subdomains
  - [ ] MX records for email (if applicable)
  - [ ] TXT records for domain verification

- [ ] **SSL Certificates**
  - [ ] Request SSL certificate for rthree.io
  - [ ] Verify SSL certificate installation
  - [ ] Test HTTPS enforcement
  - [ ] Update security headers

### Backend Configuration Updates

- [ ] **Environment Variables**
  - [ ] Update `ALLOWED_ORIGINS` to include rthree.io
  - [ ] Verify Vercel deployment environment variables
  - [ ] Update webhook URLs in Stripe dashboard
  - [ ] Update API URLs in configuration files

- [ ] **CORS Configuration**
  ```javascript
  // Update in r3-backend/server-unified.js
  const allowedOrigins = [
    'https://rthree.io',
    'https://www.rthree.io',
    // Keep staging domains for testing
    'https://sqqpyb-yq.myshopify.com'
  ];
  ```

- [ ] **Rate Limiting**
  - [ ] Verify production rate limits are active
  - [ ] Test rate limiting with new domain
  - [ ] Monitor rate limit effectiveness

### Frontend Configuration Updates

- [ ] **Domain Detection**
  - [ ] Update environment detection in `layout/theme.liquid`
  - [ ] Verify `window.R3_ENVIRONMENT` sets correctly
  - [ ] Test API endpoint resolution

- [ ] **Shopify Configuration**
  - [ ] Update primary domain in Shopify admin
  - [ ] Configure custom domain settings
  - [ ] Update checkout settings
  - [ ] Verify theme assignment

### Third-Party Service Updates

- [ ] **Stripe Configuration**
  - [ ] Update webhook endpoints to new domain
  - [ ] Verify webhook signatures
  - [ ] Test payment flow end-to-end
  - [ ] Update Stripe Connect settings (if applicable)

- [ ] **Analytics & Monitoring**
  - [ ] Update Google Analytics domain
  - [ ] Configure monitoring for new domain
  - [ ] Update any external monitoring services
  - [ ] Set up error tracking for production

## Migration Execution

### Phase 1: Staging Verification (Day 1)
- [ ] **Deploy to Staging with New Domain Config**
  - [ ] Update staging environment to use rthree.io configs
  - [ ] Run full test suite against staging
  - [ ] Verify all payment flows work
  - [ ] Test responsive design on staging

- [ ] **DNS Propagation Check**
  - [ ] Verify DNS propagation globally
  - [ ] Test domain accessibility from multiple locations
  - [ ] Confirm SSL certificate validity

### Phase 2: Production Deployment (Day 2)
- [ ] **Backend Deployment**
  - [ ] Deploy updated r3-backend with new CORS settings
  - [ ] Verify backend health checks pass
  - [ ] Test API endpoints from new domain
  - [ ] Monitor error rates

- [ ] **Frontend Deployment**
  - [ ] Push updated theme to production
  - [ ] Verify theme loads correctly
  - [ ] Test checkout flow end-to-end
  - [ ] Verify mobile responsiveness

### Phase 3: Validation & Monitoring (Day 3)
- [ ] **Functional Testing**
  - [ ] Complete purchase with card payment
  - [ ] Complete purchase with ACH payment
  - [ ] Test error scenarios
  - [ ] Verify email notifications work

- [ ] **Performance Testing**
  - [ ] Measure page load times
  - [ ] Test under load
  - [ ] Verify CDN performance
  - [ ] Check mobile performance

## Post-Migration Validation

### Technical Validation
- [ ] **API Connectivity**
  - [ ] All API endpoints respond correctly
  - [ ] Authentication works with new domain
  - [ ] Rate limiting functions properly
  - [ ] Error handling works as expected

- [ ] **Payment Processing**
  - [ ] Stripe webhook delivery confirmed
  - [ ] Test payments complete successfully
  - [ ] Refunds process correctly
  - [ ] ACH flow works end-to-end

- [ ] **Security Validation**
  - [ ] HTTPS enforcement working
  - [ ] CSRF protection active
  - [ ] Session management functional
  - [ ] No security headers missing

### User Experience Validation
- [ ] **Cross-Browser Testing**
  - [ ] Chrome (desktop/mobile)
  - [ ] Safari (desktop/mobile)
  - [ ] Firefox (desktop/mobile)
  - [ ] Edge (desktop)

- [ ] **Device Testing**
  - [ ] Desktop (1920x1080)
  - [ ] Laptop (1366x768)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667)

- [ ] **Checkout Flow Testing**
  - [ ] Cart management
  - [ ] Shipping calculation
  - [ ] Tax calculation
  - [ ] Payment processing
  - [ ] Order confirmation

## Rollback Plan

### If Issues Detected
- [ ] **Immediate Actions**
  - [ ] Revert DNS to previous domain
  - [ ] Rollback backend deployment
  - [ ] Restore previous theme version
  - [ ] Notify stakeholders

- [ ] **Investigation**
  - [ ] Identify root cause
  - [ ] Document issues encountered
  - [ ] Plan remediation steps
  - [ ] Set new migration timeline

## Monitoring & Alerts

### Post-Migration Monitoring (First 48 Hours)
- [ ] **Error Rate Monitoring**
  - [ ] API error rates < 1%
  - [ ] Payment failure rates < 2%
  - [ ] Page load errors < 0.5%

- [ ] **Performance Monitoring**
  - [ ] Page load times < 3 seconds
  - [ ] API response times < 500ms
  - [ ] Checkout completion rate > 90%

- [ ] **Security Monitoring**
  - [ ] No unusual authentication failures
  - [ ] Rate limiting working correctly
  - [ ] No CORS errors

### Long-term Monitoring Setup
- [ ] **Automated Alerts**
  - [ ] Error rate thresholds
  - [ ] Performance degradation alerts
  - [ ] Security incident alerts
  - [ ] Payment processing failures

## SEO & Marketing Updates

### Search Engine Updates
- [ ] **Google Search Console**
  - [ ] Add new domain property
  - [ ] Submit updated sitemap
  - [ ] Monitor crawl errors
  - [ ] Set up 301 redirects from old domains

- [ ] **Content Updates**
  - [ ] Update all internal links
  - [ ] Verify meta tags and schema markup
  - [ ] Update social media profiles
  - [ ] Notify partners of domain change

## Communication Plan

### Internal Team
- [ ] **Pre-Migration**
  - [ ] Notify all team members of migration timeline
  - [ ] Share access to monitoring dashboards
  - [ ] Distribute emergency contact information

- [ ] **During Migration**
  - [ ] Real-time status updates
  - [ ] Issue escalation procedures
  - [ ] Success confirmations

### External Stakeholders
- [ ] **Customer Communication**
  - [ ] Email notification to customers (if needed)
  - [ ] Website banner during migration
  - [ ] Social media updates

- [ ] **Partner Notification**
  - [ ] Notify payment processors
  - [ ] Update any integration partners
  - [ ] Inform support teams

## Success Criteria

### Technical Success
- ✅ All API endpoints respond correctly from new domain
- ✅ Payment processing working 100%
- ✅ No increase in error rates
- ✅ Performance metrics maintained or improved

### Business Success
- ✅ No disruption to customer purchases
- ✅ Checkout conversion rate maintained
- ✅ No customer complaints about functionality
- ✅ All automated systems functioning

## Emergency Contacts

- **Primary Technical Contact**: [TBD]
- **Backup Technical Contact**: [TBD]
- **Business Stakeholder**: [TBD]
- **Hosting Provider Support**: Vercel/Shopify Support

---

**Migration Timeline:**
- **Preparation**: 2-3 days
- **Execution**: 1 day
- **Validation**: 2 days
- **Monitoring**: Ongoing

**Risk Level**: MEDIUM (with proper preparation and testing)

*Last Updated: August 11, 2024*
*Next Review: Before migration execution*
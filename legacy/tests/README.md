# Legacy Test Files

This directory contains test and debug files that were migrated from the production repositories to maintain a clean production codebase.

## Backend Tests (`/backend/`)

These files were moved from `r3-backend/` root and `r3-backend/scripts/`:

- **test-ach-flow.js** - ACH payment flow testing
- **test-api-direct.sh** - Direct API testing script  
- **test-authenticated-tax.js** - Authenticated tax calculation testing
- **test-session-auth.html** - Session authentication testing UI
- **test-tax-api.js** - Tax API endpoint testing
- **test-tax.js** - Tax calculation logic testing

## Frontend Tests (`/frontend/`)

These files were moved from `r3-frontend/scripts/` and `r3-frontend/assets/`:

- **debug-cart.js** - Cart debugging utilities
- **mobile-debug.js** - Mobile debugging utilities  
- **test-checkout.js** - Checkout flow testing
- **test-checkout.sh** - Checkout testing script

## Usage

These files are preserved for reference and can be integrated into the main test suite in `/tests/` if needed. They represent the evolution of the testing approach and contain valuable test scenarios.

## Migration Date

Migrated on: August 11, 2024
Part of: Full Codebase Audit & Refactor Phase 3
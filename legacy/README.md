# Legacy Files Archive

This directory contains all archived legacy files from the R3 project that were consolidated for organization and historical reference.

## Directory Structure

### Backend Legacy Files (`backend/`)
- **config/**: Legacy configuration files
  - `achConfig.js`: Old ACH payment configuration
  - `constants.js`: Legacy backend constants
  - `domains.js`: Domain configuration
  - `urls.js`: URL configuration
  - `shared-constants.backup.js`: Backup of shared constants
- **Server Files**: Legacy server implementations
  - `server-session-integrated.js`: Old session integration server
  - `server-session-secure.js`: Legacy secure session server

### Frontend Legacy Files (`frontend/`)
- **config/**: Legacy frontend configuration files
  - `constants.js`: Frontend constants
  - `shared-constants.backup.js`: Backup of shared constants
  - `shared-constants.js.backup`: Additional backup file

### Test Files (`tests/`)
- **backend/**: Legacy backend test files
  - `test-ach-flow.js`: ACH payment flow tests
  - `test-api-direct.sh`: Direct API testing scripts
  - `test-authenticated-tax.js`: Tax calculation tests
  - `test-session-auth.html`: Session authentication tests
  - `test-tax-api.js`: Tax API tests
  - `test-tax.js`: General tax tests
- **frontend/**: Legacy frontend test files
  - `debug-cart.js`: Cart debugging utilities
  - `mobile-debug.js`: Mobile debugging tools
  - `test-checkout.js`: Checkout process tests
  - `test-checkout.sh`: Checkout testing scripts

## Purpose
These files are preserved for:
- Historical reference
- Debugging legacy issues
- Understanding previous implementation approaches
- Compliance and audit purposes

## Migration Note
All active functionality from these legacy files has been migrated to the current production codebase. These files are maintained for reference only and should not be used in production.
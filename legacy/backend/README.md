# Legacy Backend Server Files

These server files were archived during the production readiness audit on August 11, 2024.

## Archived Files

### server-session-integrated.js (376 lines)
- **Purpose**: Circuit breaker integrated server implementation
- **Features**: Shopify integration with circuit breaker pattern
- **Status**: Superseded by server-unified.js

### server-session-secure.js (393 lines)
- **Purpose**: Security-focused server implementation
- **Features**: Enhanced security middleware and session management
- **Status**: Superseded by server-unified.js

## Active Production Server

**server-unified.js** (1651 lines) remains as the production server, combining:
- Security features from server-session-secure.js
- Circuit breaker patterns from server-session-integrated.js
- Additional monitoring, caching, and performance optimizations

## Rationale for Archiving

These files were moved to maintain a clean production codebase while preserving the development history. The unified server incorporates the best features from both implementations.

## Usage

These files are preserved for:
- Reference during debugging
- Understanding implementation evolution
- Potential feature extraction if needed

**Do not use these files in production** - they are outdated and lack the latest security and performance improvements.

---
*Archived during: Full Codebase Audit & Refactor*
*Production server: server-unified.js*
# R3 Development Workspace

Central hub for R3 platform development resources, documentation, and testing.

## 🚀 Quick Start

```bash
# Clone this repository
git clone https://github.com/dylanjshaw001/r3-workspace.git
cd r3-workspace

# Install test dependencies
cd tests
npm install

# Run tests
npm test
```

## 📁 Repository Structure

```
r3-workspace/
├── CLAUDE.md                      # AI assistant guide (consolidated)
├── TECHNICAL_OVERVIEW.md          # Complete technical documentation
├── BUSINESS_OVERVIEW.md           # Executive business summary
├── BUSINESS_OVERVIEW_SUPER.md     # ROI analysis & business case
├── config/                        # Master configuration (single source of truth)
│   └── shared-constants.js        # All non-secret configuration
├── docs/                          # Additional documentation
│   └── audits/                    # Site launch audits & security
├── tests/                         # Comprehensive test suite
│   ├── run-tests.js               # Unified test runner
│   ├── unit/                      # Unit tests (<100ms)
│   ├── integration/               # Integration tests (<5s)
│   ├── e2e/                       # End-to-end tests (<30s)
│   └── shared/                    # Test utilities
├── legacy/                        # Archived legacy files
│   ├── backend/                   # Legacy backend code
│   ├── frontend/                  # Legacy frontend code
│   └── tests/                     # Legacy test files
└── .github/
    └── workflows/                 # CI/CD pipelines
```

## 📚 Documentation

### Core Documents

- **[AI Assistant Guide](CLAUDE.md)** - Comprehensive guide for AI-powered development
- **[Technical Overview](TECHNICAL_OVERVIEW.md)** - Complete technical architecture & implementation
- **[Business Overview](BUSINESS_OVERVIEW.md)** - Executive summary & business context
- **[ROI Business Case](BUSINESS_OVERVIEW_SUPER.md)** - Strategic investment analysis & competitive advantages

### Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| [AI Assistant Guide](CLAUDE.md) | Complete project context for AI development | AI Assistants & Developers |
| [Technical Overview](TECHNICAL_OVERVIEW.md) | System architecture & implementation | Engineers & Technical Team |
| [Business Overview](BUSINESS_OVERVIEW.md) | Business context & operational details | All Team Members |
| [ROI Business Case](BUSINESS_OVERVIEW_SUPER.md) | Strategic value & investment justification | Executives & Decision Makers |
| [Testing Guide](tests/README.md) | Test suite documentation | QA & Engineers |

## 🧪 Testing

The `tests/` directory contains all test suites for the R3 platform:

### Running Tests

```bash
cd tests

# Run all tests
npm test

# Run specific suites
npm run test:backend    # Backend tests only
npm run test:frontend   # Frontend tests only
npm run test:integration # Integration tests

# Environment-specific testing
NODE_ENV=staging npm test  # Test against staging
NODE_ENV=production npm test # Limited production tests
```

### Test Coverage

- **Backend**: 85% coverage (payment processing, webhooks, sessions)
- **Frontend**: 78% coverage (checkout UI, cart management)
- **Integration**: Critical path coverage

See [tests/README.md](tests/README.md) for detailed testing documentation.

## 🏗️ Related Repositories

The R3 platform consists of multiple repositories:

| Repository | Purpose | Technology |
|------------|---------|------------|
| [r3-frontend](https://github.com/dylanjshaw001/r3-frontend) | Shopify theme | Liquid, JavaScript |
| [r3-backend](https://github.com/dylanjshaw001/r3-backend) | Payment API | Node.js, Express |
| r3-workspace | Development hub | Documentation, Tests |

## 👥 Team Access

### Getting Started

1. **Vault Access**: Request access to team vault for credentials
2. **Environment Setup**: Follow [tests/README.md](tests/README.md) for local setup
3. **Documentation**: Review [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
4. **Development**: Follow TDD workflow in documentation

### Security

- **Never commit secrets** to this repository
- Use vault for all credentials
- Follow [Secrets Management Guide](docs/SECRETS_MANAGEMENT.md)
- Report security issues immediately

## 🔄 Development Workflow

### Test-Driven Development (TDD)

We follow strict TDD practices:

1. **Write test first** (Red phase)
2. **Make it pass** (Green phase)
3. **Refactor** (Refactor phase)

Example:
```bash
# 1. Write failing test
cd tests
vim frontend/new-feature.test.js

# 2. Run test (should fail)
npm test -- new-feature.test.js

# 3. Implement feature in main repo
cd ../../r3-frontend
vim assets/new-feature.js

# 4. Verify test passes
cd ../r3-workspace/tests
npm test -- new-feature.test.js
```

## 🚦 CI/CD

GitHub Actions automatically run tests on:
- Pull requests
- Pushes to main branch
- Daily scheduled runs

See [.github/workflows/test.yml](.github/workflows/test.yml) for configuration.

## 📈 Project Status

### Current Sprint Focus
- Payment processing optimization
- Checkout UI improvements
- Test coverage expansion

### Test Suite Status
- **Total Tests**: 203
- **Passing**: 185
- **Coverage**: 82%

## 🤝 Contributing

1. Create feature branch
2. Write tests first (TDD)
3. Implement changes
4. Ensure all tests pass
5. Submit pull request

## 📞 Support

- **Technical Issues**: Create GitHub issue
- **Security Concerns**: Contact admin immediately
- **Documentation**: See [docs/](docs/) directory
- **Team Chat**: Use designated Slack channel

## 📄 License

Proprietary - R3 Commerce Inc. All rights reserved.
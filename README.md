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
├── docs/                          # Platform documentation
│   ├── TECHNICAL_ARCHITECTURE.md  # Complete technical documentation
│   ├── BUSINESS_OVERVIEW.md       # Business context and requirements
│   ├── CLAUDE.md                  # AI assistant instructions
│   └── SECRETS_MANAGEMENT.md      # Security and vault guide
├── tests/                          # Comprehensive test suite
│   ├── backend/                    # Backend API tests
│   ├── frontend/                   # Frontend UI tests
│   ├── integration/                # Cross-system tests
│   └── README.md                   # Test documentation
└── .github/
    └── workflows/                  # CI/CD pipelines
```

## 📚 Documentation

### Core Documents

- **[Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)** - System design, technology stack, deployment infrastructure
- **[Business Overview](docs/BUSINESS_OVERVIEW.md)** - Business model, requirements, stakeholders
- **[AI Assistant Guide](docs/CLAUDE.md)** - Instructions for AI-powered development
- **[Secrets Management](docs/SECRETS_MANAGEMENT.md)** - Vault access, security protocols

### Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) | System design & infrastructure | Engineers |
| [Business Overview](docs/BUSINESS_OVERVIEW.md) | Business context & requirements | All team members |
| [Testing Guide](tests/README.md) | Test suite documentation | QA & Engineers |
| [Secrets Guide](docs/SECRETS_MANAGEMENT.md) | Security & credentials | DevOps & Engineers |

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
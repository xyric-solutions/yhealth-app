# Testing Guide - Senior-Level Practices

## Test Pyramid

```
     /\
    /E2E\        10% - End-to-End / Contract Tests
   /-----\
  /Integr\       20% - Integration Tests
 /---------\
/   Unit    \    70% - Unit Tests
/-------------\
```

## Principles

### ✅ DO
- Test business behavior, not implementation
- Test failure paths as first-class citizens
- Use deterministic tests (no randomness, no time dependencies)
- Mock external dependencies (DB, APIs, cache)
- Test contracts and boundaries
- Use property-based thinking

### ❌ DON'T
- Test private methods
- Over-mock (mock only what's necessary)
- Use snapshots as primary assertion
- Aim for 100% coverage (focus on meaningful coverage)
- Test implementation details

## Running Tests

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# All tests with coverage
npm run test:coverage

# CI mode (serial, with coverage)
npm run test:ci
```

## Test Structure

```
tests/
├── unit/              # Fast, isolated, mocked
│   └── services/
├── integration/      # Real dependencies, controlled
│   └── services/
└── helpers/          # Test utilities and mocks
```

## Coverage Thresholds

- Branches: 85%
- Functions: 90%
- Lines: 90%
- Statements: 90%

These are enforced in CI. Focus on meaningful coverage, not vanity metrics.

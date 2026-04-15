# Testing Strategy - Enterprise Standards

## Test Pyramid (Strict Enforcement)

```
     /\
    /  \    10% Contract / E2E
   /____\
  /      \   20% Integration
 /________\
/          \  70% Unit Tests
```

## Principles

### ✅ DO

- **Test business behavior, not implementation**
- **Test guard clauses explicitly**
- **Test failure paths as first-class citizens**
- **Enforce deterministic systems**
- **Use proper mocking (no real DB in unit tests)**
- **Validate contracts and data schemas**

### ❌ DON'T

- **Over-mock (only mock external dependencies)**
- **Test private methods**
- **Rely on snapshot-only testing**
- **Chase 100% coverage vanity metrics**
- **Allow flaky tests**

## Coverage Thresholds

- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%
- **Statements**: 90%

## Test Structure

```
tests/
├── unit/              # 70% - Fast, isolated, mocked
│   └── services/
│       └── whoop.service.unit.test.ts
├── integration/       # 20% - Real dependencies, controlled
│   └── whoop.integration.test.ts
├── helpers/          # Test utilities and mocks
│   └── whoop.testUtils.ts
└── setup.ts          # Global test configuration
```

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch

# CI mode (single process, coverage)
npm run test:ci
```

## Example Test Patterns

### Unit Test (Business Logic)

```typescript
test('throws error for invalid userId (guard clause)', async () => {
  await expect(service.calculateScore(""))
    .rejects
    .toThrow("INVALID_USER");
});
```

### Integration Test (Real Dependencies)

```typescript
test('processes webhook and stores in database', async () => {
  await service.processWebhook(payload);
  
  const stored = await query('SELECT * FROM table');
  expect(stored.rows.length).toBeGreaterThan(0);
});
```

### Contract Test (API Boundaries)

```typescript
test('always returns number or null', async () => {
  const result = await service.calculateScore("user-1");
  expect(typeof result === "number" || result === null).toBe(true);
});
```

### Failure Injection

```typescript
test('gracefully handles repository failure', async () => {
  repoMock.getMetrics.mockRejectedValue(new Error("DB_DOWN"));
  
  await expect(service.calculateScore("user-1"))
    .rejects
    .toThrow("DB_DOWN");
});
```

## Senior-Level Practices

1. **Test Intent**: What should the system do, not how
2. **Expect Failures**: Design for failure scenarios
3. **Deterministic**: No randomness, time, or network without control
4. **Isolated**: No test leaks between cases
5. **Fast**: Unit tests should run in milliseconds

## WHOOP Integration Tests

See:
- `tests/unit/services/whoop.service.unit.test.ts` - Comprehensive unit tests
- `tests/integration/whoop.integration.test.ts` - Integration tests
- `tests/helpers/whoop.testUtils.ts` - Test utilities


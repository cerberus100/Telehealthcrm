# CI/CD Pipeline Guide

This document describes the comprehensive CI/CD pipeline for the Eudaura telehealth platform.

## Overview

The CI/CD pipeline includes:
- **Security & Bundle Checks** - Prevents localhost references and security issues
- **Backend Tests & Linting** - Unit tests with PostgreSQL service
- **Frontend Tests & E2E** - Playwright tests for user flows
- **Load Testing** - k6 performance testing
- **Build & Deploy** - Production builds with security validation
- **Performance Monitoring** - Automated performance analysis
- **Security Scanning** - Dependency vulnerability checks

## Pipeline Stages

### 1. Security & Bundle Check
- **Purpose**: Prevents security vulnerabilities in production builds
- **Tools**: Custom Node.js script
- **Checks**:
  - No localhost references in production bundles
  - No hardcoded secrets or tokens
  - No debug statements
  - No development flags

### 2. Backend Tests & Linting
- **Environment**: Node.js 20 + PostgreSQL 15
- **Tests**: Unit tests, integration tests
- **Linting**: ESLint, Prettier
- **Coverage**: Test coverage reports

### 3. Frontend Tests & E2E
- **Environment**: Node.js 20 + Playwright
- **Tests**:
  - Portal authentication flows
  - Role-based access control
  - Appointment booking
  - Health data viewing
  - Medication management
- **Reports**: JUnit XML, HTML reports, video recordings

### 4. Load Testing
- **Tool**: k6
- **Scenarios**:
  - Login flow (30% weight)
  - Consults API (25% weight)
  - WebSocket health (20% weight)
  - Health checks (15% weight)
  - Portal endpoints (10% weight)
- **Thresholds**:
  - 99th percentile response time < 1500ms
  - Error rate < 10%
  - Custom error rate < 10%

### 5. Build & Deploy
- **Frontend**: Next.js production build with security check
- **Backend**: API build and test execution
- **Artifacts**: Deployment packages for both applications

### 6. Performance Monitoring
- **Analysis**: Load test results analysis
- **Thresholds**: Performance SLA validation
- **Reports**: Performance metrics and recommendations

### 7. Security Scanning
- **Tool**: npm audit
- **Level**: Moderate vulnerabilities and above
- **Reports**: Security audit findings

## Running Tests Locally

### Unit Tests
```bash
# Run all tests
npm run test

# Run specific test files
cd apps/api && npm test -- --testPathPattern="consults.service.spec.ts"
```

### E2E Tests
```bash
# Run Playwright tests
npm run test:e2e

# Run with specific browser
npx playwright test --project=chromium

# Run with debugging
npx playwright test --debug
```

### Load Tests
```bash
# Run load tests locally
npm run test:load

# Run with custom configuration
BASE_URL=http://localhost:3000 API_BASE_URL=http://localhost:3001 k6 run scripts/load-test.js
```

### Bundle Security Check
```bash
# Check production builds
npm run build:check

# Run security check manually
node scripts/check-bundle.js
```

## Environment Variables

### Required for CI/CD
- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - PostgreSQL connection string
- `AWS_REGION` - AWS region for deployment
- `COGNITO_USER_POOL_ID` - Cognito user pool ID
- `COGNITO_CLIENT_ID` - Cognito client ID

### Load Testing Configuration
- `BASE_URL` - Frontend base URL (default: http://localhost:3000)
- `API_BASE_URL` - API base URL (default: http://localhost:3001)
- `SCENARIO` - Test scenario (login, consults, realtime, health, portal, all)

### Playwright Configuration
- `PLAYWRIGHT_BASE_URL` - Base URL for tests (default: http://localhost:3000)
- `CI` - Set to true for headless mode

## Test Results

### Artifacts Generated
- **Backend Test Results**: `apps/api/coverage/`, `apps/api/test-results/`
- **Frontend Test Results**: `apps/web/playwright-report/`
- **Load Test Results**: `load-test-results.json`, `load-test-metrics.csv`
- **Security Reports**: `security-audit.json`
- **Performance Reports**: `performance-report.md`

### Test Thresholds
- **Response Time**: 99th percentile < 1500ms
- **Error Rate**: < 10% for all endpoints
- **Test Coverage**: > 80% for critical paths
- **Security Issues**: 0 critical/high vulnerabilities

## Portal Authentication Tests

The E2E tests include comprehensive portal authentication flows:

### Test Coverage
- ✅ Patient portal login flow
- ✅ Appointment booking workflow
- ✅ Health data viewing
- ✅ Medication management
- ✅ Logout functionality
- ✅ Error handling (invalid credentials, expired sessions)
- ✅ Security validation (unauthorized access prevention)

### Key Test Scenarios
```typescript
// Portal login with valid credentials
test('patient portal login flow', async ({ page }) => {
  await page.goto('/portal/login')
  await page.fill('input[type="email"]', 'patient@example.com')
  await page.fill('input[type="password"]', 'patient_password')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/portal$/)
})

// Appointment booking workflow
test('portal appointment booking', async ({ page }) => {
  // Login → Navigate to appointments → Fill form → Submit
  await expect(page.locator('.success-message')).toContainText('Appointment booked successfully')
})

// Health data viewing with role-based access
test('portal health data viewing', async ({ page }) => {
  // Mock health data endpoint with proper authorization
  await expect(page.locator('.health-data-item')).toHaveCount(1)
})
```

## Security Features

### Bundle Security Check
The security check prevents common production issues:

**Forbidden Patterns:**
- `localhost`, `127.0.0.1`, `0.0.0.0` (except localhost:3000 for dev)
- `console.log`, `console.warn`, `console.error`, `debugger`
- `password`, `secret`, `key`, `token` (hardcoded)
- `NEXT_PUBLIC_USE_MOCKS`, `API_DEMO_MODE`

**Allowed Patterns:**
- Development logging in specific files
- Environment variable usage
- Local development server references

### Authentication Testing
- Valid credential flows
- Invalid credential error handling
- Session timeout handling
- Token expiration management
- Unauthorized access prevention

## Performance Benchmarks

### Load Test Configuration
```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% < 1500ms
    http_req_failed: ['rate<0.1'],     // < 10% errors
  },
}
```

### Expected Performance
- **Login Flow**: < 1000ms avg response time
- **API Calls**: < 500ms avg response time
- **WebSocket Health**: < 200ms response time
- **Overall Error Rate**: < 5%

## Monitoring and Reporting

### Automated Reports
- **Test Results**: JUnit XML for CI integration
- **Load Test Metrics**: CSV and JSON formats
- **Security Audit**: JSON vulnerability reports
- **Performance Analysis**: Markdown reports with recommendations

### CI/CD Integration
- **GitHub Actions**: Automated pipeline execution
- **Artifact Upload**: Test results and reports
- **Status Checks**: Required for PR merges
- **Branch Protection**: Main branch requires passing tests

## Troubleshooting

### Common Issues

#### Bundle Security Check Fails
```bash
# Check what triggered the failure
node scripts/check-bundle.js

# Review the specific file mentioned in the error
# Fix hardcoded secrets or localhost references
```

#### Playwright Tests Fail
```bash
# Check if Playwright browsers are installed
cd apps/web && npx playwright install

# Run tests in debug mode
npx playwright test --debug

# Check test videos for visual debugging
ls apps/web/test-results/
```

#### Load Tests Fail
```bash
# Check if k6 is installed
k6 version

# Run with lower load for debugging
SCENARIO=health k6 run scripts/load-test.js

# Analyze detailed metrics
k6 run --out json=debug-results.json scripts/load-test.js
```

### Performance Tuning
- **Slow Tests**: Increase timeout values in playwright.config.ts
- **Memory Issues**: Reduce parallel test execution
- **Network Issues**: Check BASE_URL configuration
- **Database Issues**: Verify PostgreSQL connection in CI

## Best Practices

### Writing Tests
1. **Use Page Objects**: Create reusable components for common UI elements
2. **Mock External Dependencies**: Avoid external API calls in tests
3. **Test User Flows**: Focus on end-to-end user experiences
4. **Include Error Cases**: Test failure scenarios and error handling
5. **Use Descriptive Names**: Clear test names that explain the scenario

### CI/CD Pipeline
1. **Fail Fast**: Run critical tests early in the pipeline
2. **Parallel Execution**: Run independent tests in parallel
3. **Artifact Management**: Store test results and reports
4. **Environment Isolation**: Use separate environments for different test types
5. **Security First**: Run security checks before deployment

### Performance Testing
1. **Realistic Scenarios**: Test actual user workflows
2. **Proper Load**: Use realistic user counts and durations
3. **Monitor Resources**: Track CPU, memory, and network usage
4. **Baseline Comparison**: Compare against previous test runs
5. **Continuous Improvement**: Set and track performance goals

## Support

For questions about the CI/CD pipeline:
1. Check the GitHub Actions logs for detailed error information
2. Review the test artifacts for debugging information
3. Check the performance reports for optimization opportunities
4. Consult this documentation for configuration details

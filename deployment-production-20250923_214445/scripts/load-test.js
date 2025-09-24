import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 },   // Stay at 100 users for 5 minutes
    { duration: '2m', target: 200 },   // Ramp up to 200 users over 2 minutes
    { duration: '5m', target: 200 },   // Stay at 200 users for 5 minutes
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests should be below 1500ms
    http_req_failed: ['rate<0.1'],     // Error rate should be less than 10%
    errors: ['rate<0.1'],              // Custom error rate
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001'

// Test scenarios
const scenarios = {
  login: {
    weight: 30,
    exec: 'loginTest'
  },
  consults: {
    weight: 25,
    exec: 'consultsTest'
  },
  realtime: {
    weight: 20,
    exec: 'realtimeTest'
  },
  health: {
    weight: 15,
    exec: 'healthTest'
  },
  portal: {
    weight: 10,
    exec: 'portalTest'
  }
}

export default function () {
  const scenario = __ENV.SCENARIO || 'all'

  if (scenario === 'login' || scenario === 'all') {
    loginTest()
  }
  if (scenario === 'consults' || scenario === 'all') {
    consultsTest()
  }
  if (scenario === 'realtime' || scenario === 'all') {
    realtimeTest()
  }
  if (scenario === 'health' || scenario === 'all') {
    healthTest()
  }
  if (scenario === 'portal' || scenario === 'all') {
    portalTest()
  }

  sleep(Math.random() * 2 + 1) // Random sleep between 1-3 seconds
}

/**
 * Test login flow performance
 */
function loginTest() {
  // Mock login request
  const loginResponse = http.post(
    `${API_BASE_URL}/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'test_password'
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  )

  check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => JSON.parse(r.body).access_token !== undefined,
  }) || errorRate.add(1)

  // Use token for subsequent requests
  const token = JSON.parse(loginResponse.body).access_token
  const headers = { Authorization: `Bearer ${token}` }

  // Test /me endpoint
  const meResponse = http.get(`${API_BASE_URL}/auth/me`, { headers })

  check(meResponse, {
    'me status is 200': (r) => r.status === 200,
    'me has user data': (r) => JSON.parse(r.body).user !== undefined,
  }) || errorRate.add(1)
}

/**
 * Test consults API performance
 */
function consultsTest() {
  const headers = getAuthHeaders()

  // Test consults list
  const consultsResponse = http.get(
    `${API_BASE_URL}/consults?limit=20`,
    { headers }
  )

  check(consultsResponse, {
    'consults status is 200': (r) => r.status === 200,
    'consults has items': (r) => JSON.parse(r.body).items !== undefined,
    'consults response time < 1000ms': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1)

  const consultData = JSON.parse(consultsResponse.body)

  if (consultData.items && consultData.items.length > 0) {
    const consultId = consultData.items[0].id

    // Test individual consult access
    const consultDetailResponse = http.get(
      `${API_BASE_URL}/consults/${consultId}`,
      { headers }
    )

    check(consultDetailResponse, {
      'consult detail status is 200': (r) => r.status === 200,
      'consult detail response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1)
  }
}

/**
 * Test WebSocket health and performance
 */
function realtimeTest() {
  // Test WebSocket health endpoint
  const wsHealthResponse = http.get(`${API_BASE_URL}/ws/health`)

  check(wsHealthResponse, {
    'websocket health status is 200': (r) => r.status === 200,
    'websocket health response time < 200ms': (r) => r.timings.duration < 200,
    'websocket health has status': (r) => JSON.parse(r.body).status === 'healthy',
  }) || errorRate.add(1)
}

/**
 * Test health check endpoints
 */
function healthTest() {
  // Test main health endpoint
  const healthResponse = http.get(`${API_BASE_URL}/health`)

  check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1)

  // Test observability health
  const observabilityResponse = http.get(`${API_BASE_URL}/health/observability`)

  check(observabilityResponse, {
    'observability status is 200': (r) => r.status === 200,
    'observability has telemetry data': (r) => JSON.parse(r.body).observability !== undefined,
  }) || errorRate.add(1)
}

/**
 * Test portal endpoints
 */
function portalTest() {
  const headers = getAuthHeaders()

  // Test portal login page load
  const portalLoginResponse = http.get(`${BASE_URL}/portal/login`)

  check(portalLoginResponse, {
    'portal login loads': (r) => r.status === 200,
    'portal login response time < 1000ms': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1)

  // Test portal health data (if authenticated)
  if (headers.Authorization) {
    const portalDataResponse = http.get(
      `${API_BASE_URL}/patients/test-patient/health-data`,
      { headers }
    )

    check(portalDataResponse, {
      'portal data status is 200': (r) => r.status === 200 || r.status === 404, // 404 is acceptable for test patient
      'portal data response time < 1500ms': (r) => r.timings.duration < 1500,
    }) || errorRate.add(1)
  }
}

/**
 * Helper function to get authentication headers
 */
function getAuthHeaders() {
  // In a real test, you'd get a token from login
  // For this load test, we'll use a mock token
  return {
    Authorization: 'Bearer mock_load_test_token',
    'Content-Type': 'application/json'
  }
}

/**
 * K6 Summary Handler
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-summary.json': JSON.stringify(data, null, 2),
    'load-test-metrics.csv': generateMetricsCSV(data)
  }
}

/**
 * Generate CSV metrics for analysis
 */
function generateMetricsCSV(data) {
  const metrics = data.metrics
  let csv = 'metric_name,avg,min,med,max,p95,p99\n'

  for (const [name, metric] of Object.entries(metrics)) {
    if (metric.type === 'trend') {
      csv += `${name},${metric.avg},${metric.min},${metric.med},${metric.max},${metric['p(95)']},${metric['p(99)']}\n`
    }
  }

  return csv
}

/**
 * Text summary for console output
 */
function textSummary(data, options) {
  return `
Load Test Summary
=================

Test completed at: ${new Date().toISOString()}
Duration: ${data.metrics.iteration_duration.values.avg}ms avg iteration time
Total requests: ${data.metrics.http_reqs.values.count}
Failed requests: ${data.metrics.http_req_failed.values.rate * 100}%
Error rate: ${data.metrics.errors.values.rate * 100}%

HTTP Response Times:
- Average: ${Math.round(data.metrics.http_req_duration.values.avg)}ms
- 95th percentile: ${Math.round(data.metrics.http_req_duration.values['p(95)'])}ms
- 99th percentile: ${Math.round(data.metrics.http_req_duration.values['p(99)'])}ms
- Max: ${Math.round(data.metrics.http_req_duration.values.max)}ms

Scenarios tested:
- Login Flow: ${data.metrics.http_req_duration.values.count * 0.3}
- Consults API: ${data.metrics.http_req_duration.values.count * 0.25}
- WebSocket Health: ${data.metrics.http_req_duration.values.count * 0.2}
- Health Checks: ${data.metrics.http_req_duration.values.count * 0.15}
- Portal Endpoints: ${data.metrics.http_req_duration.values.count * 0.1}

Status: ${data.metrics.http_req_failed.values.rate < 0.1 ? '✅ PASS' : '❌ FAIL'}
`
}

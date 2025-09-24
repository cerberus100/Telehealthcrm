import { test, expect } from '@playwright/test'

/**
 * Portal Authentication E2E Tests
 * Tests portal login flows and patient portal functionality
 */

test.describe('Portal Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Mock successful authentication for portal
    await page.route('**/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'portal_user_token',
          refresh_token: 'portal_refresh_token'
        })
      })
    })

    await page.route('**/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'patient_123',
            email: 'patient@example.com',
            role: 'PATIENT',
            org_id: 'portal_org'
          },
          org: {
            id: 'portal_org',
            type: 'PROVIDER',
            name: 'Patient Portal'
          }
        })
      })
    })
  })

  test('patient portal login flow', async ({ page }) => {
    await page.goto('/portal/login')

    // Check that login page loads
    await expect(page).toHaveTitle(/Portal/)
    await expect(page.locator('h1')).toContainText('Patient Portal')

    // Fill login form
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'patient_password')

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to portal dashboard
    await expect(page).toHaveURL(/\/portal$/)
    await expect(page.locator('.portal-dashboard')).toBeVisible()
  })

  test('portal appointment booking', async ({ page }) => {
    // First login
    await page.goto('/portal/login')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'patient_password')
    await page.click('button[type="submit"]')

    // Navigate to appointments
    await page.click('text=Book Appointment')
    await expect(page).toHaveURL(/\/portal\/appointments/)

    // Check appointment booking form
    await expect(page.locator('h1')).toContainText('Book Appointment')
    await expect(page.locator('select[name="reason"]')).toBeVisible()
    await expect(page.locator('input[type="datetime-local"]')).toBeVisible()

    // Fill appointment form
    await page.selectOption('select[name="reason"]', 'consultation')
    await page.fill('input[name="notes"]', 'Regular checkup')

    // Submit appointment
    await page.click('button[type="submit"]')

    // Should show success message
    await expect(page.locator('.success-message')).toContainText('Appointment booked successfully')
  })

  test('portal health data viewing', async ({ page }) => {
    // Login
    await page.goto('/portal/login')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'patient_password')
    await page.click('button[type="submit"]')

    // Navigate to health data
    await page.click('text=Health Data')
    await expect(page).toHaveURL(/\/portal\/health-data/)

    // Mock health data endpoint
    await page.route('**/patients/*/health-data', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'hd_1',
              type: 'lab_result',
              date: '2024-01-15',
              title: 'Blood Test Results',
              status: 'available'
            }
          ],
          next_cursor: undefined
        })
      })
    })

    // Check health data display
    await expect(page.locator('h1')).toContainText('Health Data')
    await expect(page.locator('.health-data-item')).toHaveCount(1)
    await expect(page.locator('.health-data-item')).toContainText('Blood Test Results')
  })

  test('portal medication management', async ({ page }) => {
    // Login
    await page.goto('/portal/login')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'patient_password')
    await page.click('button[type="submit"]')

    // Navigate to medications
    await page.click('text=Medications')
    await expect(page).toHaveURL(/\/portal\/meds/)

    // Mock medications endpoint
    await page.route('**/patients/*/medications', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'med_1',
              name: 'Lisinopril',
              dosage: '10mg',
              frequency: 'Once daily',
              prescriber: 'Dr. Smith',
              status: 'active'
            }
          ],
          next_cursor: undefined
        })
      })
    })

    // Check medication display
    await expect(page.locator('h1')).toContainText('Medications')
    await expect(page.locator('.medication-item')).toHaveCount(1)
    await expect(page.locator('.medication-item')).toContainText('Lisinopril')
    await expect(page.locator('.medication-item')).toContainText('10mg')
  })

  test('portal logout functionality', async ({ page }) => {
    // Login
    await page.goto('/portal/login')
    await page.fill('input[type="email"]', 'patient@example.com')
    await page.fill('input[type="password"]', 'patient_password')
    await page.click('button[type="submit"]')

    // Should be on portal dashboard
    await expect(page).toHaveURL(/\/portal$/)

    // Click logout
    await page.click('text=Sign Out')

    // Should redirect to login page
    await expect(page).toHaveURL(/\/portal\/login/)
    await expect(page.locator('h1')).toContainText('Patient Portal')

    // Verify auth state is cleared (should not be able to access portal)
    await page.goto('/portal')
    await expect(page).toHaveURL(/\/portal\/login/)
  })

  test('portal error handling', async ({ page }) => {
    // Mock failed authentication
    await page.route('**/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
        })
      })
    })

    await page.goto('/portal/login')
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrong_password')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('.error-message')).toContainText('Invalid email or password')
    await expect(page).toHaveURL(/\/portal\/login/)
  })

  test('portal session timeout', async ({ page }) => {
    // Mock expired token
    await page.route('**/auth/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'TOKEN_EXPIRED', message: 'Session expired. Please log in again.' }
        })
      })
    })

    await page.goto('/portal')
    await expect(page).toHaveURL(/\/portal\/login/)
    await expect(page.locator('.error-message')).toContainText('Session expired')
  })
})

test.describe('Portal Security', () => {
  test('prevents unauthorized access to portal routes', async ({ page }) => {
    // Try to access portal without authentication
    await page.goto('/portal')

    // Should redirect to login
    await expect(page).toHaveURL(/\/portal\/login/)
    await expect(page.locator('h1')).toContainText('Patient Portal')
  })

  test('prevents access to protected portal data', async ({ page }) => {
    // Mock authentication but no token
    await page.context().clearCookies()
    await page.goto('/portal/health-data')

    // Should redirect to login
    await expect(page).toHaveURL(/\/portal\/login/)
  })

  test('validates portal access tokens', async ({ page }) => {
    // Mock invalid token response
    await page.route('**/auth/me', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INVALID_TOKEN', message: 'Invalid access token' }
        })
      })
    })

    await page.goto('/portal')
    await expect(page).toHaveURL(/\/portal\/login/)
  })
})

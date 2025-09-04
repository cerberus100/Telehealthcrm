import { test, expect } from '@playwright/test'

test.describe('Role-based access boundaries', () => {
  test.beforeEach(async ({ page }) => {
    // Enable mocks
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('NEXT_PUBLIC_USE_MOCKS', 'true')
    })
  })

  test.describe('Marketer role', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[placeholder="email"]', 'marketer@example.com')
      await page.selectOption('select', 'MARKETER')
      await page.click('text=Sign in')
      await page.waitForURL('/')
    })

    test('cannot access Rx pages', async ({ page }) => {
      await page.goto('/rx')
      await expect(page.locator('text=Access denied')).toBeVisible()
      await expect(page.locator('text=Only Provider and Pharmacy personnel')).toBeVisible()
    })

    test('cannot access Lab Results', async ({ page }) => {
      await page.goto('/lab-results')
      await expect(page.locator('text=Access denied')).toBeVisible()
    })

    test('can see consult status but not clinical actions', async ({ page }) => {
      await page.goto('/consults/c_1')
      await expect(page.locator('text=Status: PASSED')).toBeVisible()
      await expect(page.locator('text=actions require clinician role')).toBeVisible()
      await expect(page.locator('button:has-text("Pass")')).not.toBeVisible()
      await expect(page.locator('button:has-text("Compose Rx")')).not.toBeVisible()
    })

    test('can view shipments', async ({ page }) => {
      await page.goto('/shipments')
      await expect(page.locator('h1:has-text("Shipments")')).toBeVisible()
      await expect(page.locator('text=1Z...')).toBeVisible()
    })
  })

  test.describe('Doctor role', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[placeholder="email"]', 'dr@example.com')
      await page.selectOption('select', 'DOCTOR')
      await page.click('text=Sign in')
      await page.waitForURL('/')
    })

    test('can access all clinical pages', async ({ page }) => {
      // Rx access
      await page.goto('/rx')
      await expect(page.locator('h1:has-text("Prescriptions")')).toBeVisible()
      
      // Lab Orders access
      await page.goto('/lab-orders')
      await expect(page.locator('h1:has-text("Lab Orders")')).toBeVisible()
      
      // Lab Results access
      await page.goto('/lab-results')
      await expect(page.locator('h1:has-text("Lab Results")')).toBeVisible()
    })

    test('can perform all consult actions', async ({ page }) => {
      await page.goto('/consults/c_1')
      await expect(page.locator('button:has-text("Pass")')).toBeVisible()
      await expect(page.locator('button:has-text("Fail")')).toBeVisible()
      await expect(page.locator('button:has-text("Approve")')).toBeVisible()
      await expect(page.locator('button:has-text("Decline")')).toBeVisible()
    })
  })

  test.describe('Lab Tech role', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[placeholder="email"]', 'lab@example.com')
      await page.selectOption('select', 'LAB_TECH')
      await page.click('text=Sign in')
      await page.waitForURL('/')
    })

    test('can access lab pages only', async ({ page }) => {
      // Can access Lab Orders
      await page.goto('/lab-orders')
      await expect(page.locator('h1:has-text("Lab Orders")')).toBeVisible()
      
      // Can access Lab Results
      await page.goto('/lab-results')
      await expect(page.locator('h1:has-text("Lab Results")')).toBeVisible()
      
      // Cannot access Rx
      await page.goto('/rx')
      await expect(page.locator('text=Access denied')).toBeVisible()
    })
  })

  test.describe('Pharmacist role', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[placeholder="email"]', 'pharm@example.com')
      await page.selectOption('select', 'PHARMACIST')
      await page.click('text=Sign in')
      await page.waitForURL('/')
    })

    test('can access Rx but not lab pages', async ({ page }) => {
      // Can access Rx
      await page.goto('/rx')
      await expect(page.locator('h1:has-text("Prescriptions")')).toBeVisible()
      
      // Cannot access Lab Orders
      await page.goto('/lab-orders')
      await expect(page.locator('text=Access denied')).toBeVisible()
      
      // Cannot access Lab Results
      await page.goto('/lab-results')
      await expect(page.locator('text=Access denied')).toBeVisible()
    })
  })

  test.describe('Purpose of use tracking', () => {
    test('should prompt for purpose when accessing PHI', async ({ page }) => {
      // Login as doctor
      await page.goto('/login')
      await page.fill('input[placeholder="email"]', 'dr@example.com')
      await page.selectOption('select', 'DOCTOR')
      await page.click('text=Sign in')
      
      // Try to access patient details
      await page.goto('/consults/c_1')
      
      // Purpose modal should appear (when implemented)
      // await expect(page.locator('text=Purpose of Use Required')).toBeVisible()
      // await page.fill('textarea', 'Clinical review for patient care')
      // await page.click('text=Confirm Access')
    })
  })
})

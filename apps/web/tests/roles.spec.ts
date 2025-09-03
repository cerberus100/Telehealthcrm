import { test, expect } from '@playwright/test'

// Assumes NEXT_PUBLIC_USE_MOCKS=true

test('marketer cannot see consult actions', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[placeholder="email"]', 'marketer@example.com')
  await page.selectOption('select', 'MARKETER')
  await page.click('text=Sign in')
  await page.goto('/consults/c_1')
  await expect(page.locator('text=actions require clinician role')).toBeVisible()
})

test('doctor can see consult actions', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[placeholder="email"]', 'dr@example.com')
  await page.selectOption('select', 'DOCTOR')
  await page.click('text=Sign in')
  await page.goto('/consults/c_1')
  await expect(page.locator('text=Pass')).toBeVisible()
  await expect(page.locator('text=Approve')).toBeVisible()
})

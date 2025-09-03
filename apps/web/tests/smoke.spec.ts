import { test, expect } from '@playwright/test'

// Requires NEXT_PUBLIC_USE_MOCKS=true

test('login and purpose-of-use flow', async ({ page }) => {
  await page.goto('/')
  // should redirect to purpose page by link text
  await page.click('text=Set purpose')
  await page.fill('input', 'Treatment')
  await page.click('text=Continue')
  await expect(page.locator('text=Welcome')).toBeVisible()
})

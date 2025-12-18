import { test, expect } from '@playwright/test';

const baseUrl = 'https://www.saucedemo.com';

test('saucedemo 05 logout', async ({ page }) => {
  // Step 1: Navigate to /
  await page.goto(new URL('/', baseUrl).toString());
  // Step 2: Fill the "Username" field with standard_user
  await page.getByPlaceholder('Username').fill('standard_user');
  // Step 3: Fill the "Password" field with secret_sauce
  await page.getByPlaceholder('Password').fill('secret_sauce');
  // Step 4: Click the "Login" button
  await page.locator('#login-button').click();
  // Step 5: Verify the user is logged in and sees the inventory/products page (e.g. header shows "Products")
  const locator5_1 = page.getByText('Products');
  await expect(locator5_1.nth(0)).toBeVisible();
  // Step 6: Open the left menu (hamburger/menu button)
  await page.locator('#react-burger-menu-btn').click();
  // Step 7: Verify the menu shows a "Logout" option
  const locator7_1 = page.locator('#logout_sidebar_link');
  await expect(locator7_1).toHaveCount(1);
  await expect(locator7_1).toBeVisible();
  // Step 8: Click "Logout"
  await page.locator('#logout_sidebar_link').click();
  // Step 9: Verify the user is returned to the login page and is no longer authenticated
  const locator9_1 = page.getByText('Swag Labs');
  await expect(locator9_1.nth(0)).toBeVisible();
  // Step 10: Verify the login form is visible again ("Username" and "Password" fields)
  const locator10_1 = page.getByPlaceholder('Username');
  await expect(locator10_1).toHaveCount(1);
  await expect(locator10_1).toBeVisible();
  const locator10_2 = page.getByPlaceholder('Password');
  await expect(locator10_2).toHaveCount(1);
  await expect(locator10_2).toBeVisible();
});

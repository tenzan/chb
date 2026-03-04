import { test, expect } from "@playwright/test";
import { getSessionCookie, bootstrapAdmin } from "./helpers/api";

test.describe("Authentication", () => {
  test("login flow", async ({ page }) => {
    const { email, password } = await bootstrapAdmin();

    await page.goto("/login");
    await page.fill('input[id="email"]', email);
    await page.fill('input[id="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/admin");
    await expect(page.locator("text=Welcome")).toBeVisible();
  });

  test("redirect when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/login");
    await expect(page.locator('input[id="email"]')).toBeVisible();
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="email"]', "admin@test.com");
    await page.fill('input[id="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Invalid email or password")).toBeVisible();
  });

  test("logout clears session", async ({ page, context }) => {
    const cookie = await getSessionCookie();
    await context.addCookies([cookie]);

    await page.goto("/admin");
    await expect(page.locator("text=Welcome")).toBeVisible();

    await page.click("#logout-btn");
    await page.waitForURL("**/login");
  });
});

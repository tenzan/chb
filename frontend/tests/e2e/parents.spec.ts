import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./helpers/api";

test.describe("Parents", () => {
  test.beforeEach(async ({ page, context }) => {
    const cookie = await getSessionCookie();
    await context.addCookies([cookie]);
  });

  test("view parents page", async ({ page }) => {
    await page.goto("/admin/parents");
    await expect(page.locator("text=Parents")).toBeVisible();
    await expect(page.locator("text=Add Parent")).toBeVisible();
  });

  test("create parent flow", async ({ page }) => {
    await page.goto("/admin/parents");
    await page.click("text=Add Parent");

    await page.fill('input[id="parent-email"]', `parent-${Date.now()}@test.com`);
    await page.fill('input[id="parent-name"]', "Test Parent");
    await page.click("button:has-text('Create')");

    await expect(page.locator("text=Test Parent")).toBeVisible();
  });
});

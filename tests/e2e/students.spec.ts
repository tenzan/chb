import { test, expect } from "@playwright/test";
import { getSessionCookie, createParentViaApi, loginAsAdmin } from "./helpers/api";

test.describe("Students", () => {
  test.beforeEach(async ({ page, context }) => {
    const cookie = await getSessionCookie();
    await context.addCookies([cookie]);
  });

  test("view students page", async ({ page }) => {
    await page.goto("/admin/students");
    await expect(page.locator("text=Students")).toBeVisible();
    await expect(page.locator("text=Add Student")).toBeVisible();
  });

  test("create student flow", async ({ page }) => {
    const token = await loginAsAdmin();
    const uniqueEmail = `parent-${Date.now()}@test.com`;
    await createParentViaApi(token, {
      email: uniqueEmail,
      name: "Parent for Student",
    });

    await page.goto("/admin/students");
    await page.click("text=Add Student");

    await page.fill('input[id="student-name"]', "Test Student");
    await page.click("button:has-text('Create')");

    await expect(page.locator("text=Test Student")).toBeVisible();
  });
});

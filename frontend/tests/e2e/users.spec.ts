import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./helpers/api";

test.describe("Users", () => {
  test.beforeEach(async ({ page, context }) => {
    const cookie = await getSessionCookie();
    await context.addCookies([cookie]);
  });

  test("view users page", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.locator("text=Users")).toBeVisible();
    await expect(page.locator("text=Invite User")).toBeVisible();
  });

  test("invite user flow", async ({ page }) => {
    await page.goto("/admin/users");
    await page.click("text=Invite User");

    await expect(page.locator("text=Invite User").nth(1)).toBeVisible();
    await page.fill('input[id="invite-email"]', "newuser@test.com");
    await page.selectOption('select[id="invite-role"]', "Tutor");
    await page.click("text=Create Invite");

    await expect(page.locator("text=Invite created")).toBeVisible();
  });
});

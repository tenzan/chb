import { test, expect } from "@playwright/test";
import { getSessionCookie, loginAsAdmin } from "./helpers/api";

const BASE_URL = "http://localhost:4322";

async function createSubjectViaApi(
  sessionToken: string,
  data: { name: string; description?: string }
): Promise<{ id: string; name: string; description: string | null }> {
  const res = await fetch(`${BASE_URL}/api/admin/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session=${sessionToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create subject failed: ${res.status}`);
  const body = await res.json();
  return body.data;
}

test.describe("Subjects", () => {
  test.beforeEach(async ({ page, context }) => {
    const cookie = await getSessionCookie();
    await context.addCookies([cookie]);
  });

  test("sidebar has Subjects link", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Subjects" })).toBeVisible();
  });

  test("view subjects page with empty state", async ({ page }) => {
    await page.goto("/admin/subjects");
    await expect(page.getByRole("heading", { name: "Subjects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Subject" })).toBeVisible();
    await expect(page.locator("#subject-count")).toContainText("subject");
  });

  test("add subject via modal", async ({ page }) => {
    const ts = Date.now();
    const name = `Physics ${ts}`;

    await page.goto("/admin/subjects");
    await page.getByRole("button", { name: "Add Subject" }).click();

    await expect(page.getByRole("heading", { name: "Add Subject" })).toBeVisible();
    await page.fill("#subject-name", name);
    await page.fill("#subject-description", "Study of matter and energy");
    await page.locator("#subject-form button[type='submit']").click();

    // Modal closes and subject appears in table
    await expect(page.locator("#subject-modal")).toBeHidden();
    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("edit subject via modal", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const original = `EditSubj ${ts}`;
    const edited = `EditedSubj ${ts}`;
    await createSubjectViaApi(token, { name: original });

    await page.goto("/admin/subjects");
    await expect(page.getByRole("cell", { name: original })).toBeVisible();

    // Click edit button in the row
    const row = page.locator("tr", { has: page.getByRole("cell", { name: original }) });
    await row.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: "Edit Subject" })).toBeVisible();
    await page.fill("#subject-name", edited);
    await page.locator("#subject-form button[type='submit']").click();

    await expect(page.locator("#subject-modal")).toBeHidden();
    await expect(page.getByRole("cell", { name: edited })).toBeVisible();
    await expect(page.getByRole("cell", { name: original })).not.toBeVisible();
  });

  test("delete subject via confirmation modal", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const name = `DeleteSubj ${ts}`;
    await createSubjectViaApi(token, { name });

    await page.goto("/admin/subjects");
    await expect(page.getByRole("cell", { name })).toBeVisible();

    // Click delete button in the row
    const row = page.locator("tr", { has: page.getByRole("cell", { name }) });
    await row.getByRole("button", { name: "Delete" }).click();

    // Delete confirmation modal should be visible with the delete button
    await expect(page.locator("#delete-modal")).toBeVisible();
    await expect(page.locator("#delete-message")).toContainText(name);
    const deleteBtn = page.locator("#confirm-delete");
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Subject removed from table
    await expect(page.locator("#delete-modal")).toBeHidden();
    await expect(page.getByRole("cell", { name })).not.toBeVisible();
  });

  test("cancel add subject closes modal without saving", async ({ page }) => {
    await page.goto("/admin/subjects");
    await page.getByRole("button", { name: "Add Subject" }).click();
    await expect(page.locator("#subject-modal")).toBeVisible();

    await page.fill("#subject-name", "Should Not Save");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.locator("#subject-modal")).toBeHidden();
    await expect(page.getByRole("cell", { name: "Should Not Save" })).not.toBeVisible();
  });

  test("cancel delete closes modal without deleting", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const name = `KeepSubj ${ts}`;
    await createSubjectViaApi(token, { name });

    await page.goto("/admin/subjects");
    const row = page.locator("tr", { has: page.getByRole("cell", { name }) });
    await row.getByRole("button", { name: "Delete" }).click();

    await expect(page.locator("#delete-modal")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.locator("#delete-modal")).toBeHidden();
    await expect(page.getByRole("cell", { name })).toBeVisible();
  });

  test("duplicate subject name shows error", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const name = `DupSubj ${ts}`;
    await createSubjectViaApi(token, { name });

    await page.goto("/admin/subjects");
    await page.getByRole("button", { name: "Add Subject" }).click();
    await page.fill("#subject-name", name);
    await page.locator("#subject-form button[type='submit']").click();

    await expect(page.locator("#subject-error")).toBeVisible();
    await expect(page.locator("#subject-error")).toContainText("already exists");
  });

  test("edit and delete buttons align under Actions header", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    await createSubjectViaApi(token, { name: `AlignTest ${ts}` });

    await page.goto("/admin/subjects");
    await expect(page.getByRole("cell", { name: `AlignTest ${ts}` })).toBeVisible();

    // Get the Actions header bounding box
    const header = page.locator("th", { hasText: "Actions" });
    const headerBox = await header.boundingBox();

    // Get the Delete button (rightmost) bounding box
    const row = page.locator("tr", { has: page.getByRole("cell", { name: `AlignTest ${ts}` }) });
    const deleteBtn = row.getByRole("button", { name: "Delete" });
    const deleteBox = await deleteBtn.boundingBox();

    expect(headerBox).toBeTruthy();
    expect(deleteBox).toBeTruthy();

    // The Delete button's right edge should be near the Actions header's right edge
    // (within padding tolerance of 20px)
    const headerRight = headerBox!.x + headerBox!.width;
    const deleteRight = deleteBox!.x + deleteBox!.width;
    expect(Math.abs(headerRight - deleteRight)).toBeLessThan(20);
  });
});

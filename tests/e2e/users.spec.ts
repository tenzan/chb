import { test, expect } from "@playwright/test";
import { getSessionCookie, createParentViaApi, loginAsAdmin } from "./helpers/api";

const BASE_URL = "http://localhost:4322";

async function createStudentViaApi(
  sessionToken: string,
  parentId: string,
  name: string
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/admin/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session=${sessionToken}`,
    },
    body: JSON.stringify({ name, parentUserId: parentId }),
  });
  if (!res.ok) throw new Error(`Create student failed: ${res.status}`);
  const body = await res.json();
  return body.data;
}

test.describe("Users", () => {
  test.beforeEach(async ({ page, context }) => {
    const cookie = await getSessionCookie();
    await context.addCookies([cookie]);
  });

  test("view users page with role chips and search", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create User" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite User" })).toBeVisible();

    // Role filter chips should be visible
    await expect(page.locator('[data-role="All"]')).toBeVisible();
    await expect(page.locator('[data-role="Admin"]')).toBeVisible();
    await expect(page.locator('[data-role="Parent"]')).toBeVisible();
    await expect(page.locator('[data-role="Student"]')).toBeVisible();

    // Search input should be visible
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test("filter users by role chip", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    await createParentViaApi(token, {
      email: `chip-parent-${ts}@test.com`,
      name: `ChipParent ${ts}`,
    });

    await page.goto("/admin/users");
    // Wait for data to load
    await expect(page.locator('#user-count')).not.toContainText('Loading');

    // Click Parent chip
    await page.locator('[data-role="Parent"]').click();
    await expect(page.locator('#user-count')).toContainText('of');

    // Click All chip to reset
    await page.locator('[data-role="All"]').click();
    await expect(page.locator('#user-count')).not.toContainText('of');
  });

  test("search users by name", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const parentName = `SearchUser ${ts}`;
    await createParentViaApi(token, {
      email: `search-${ts}@test.com`,
      name: parentName,
    });

    await page.goto("/admin/users");
    await expect(page.locator('#user-count')).not.toContainText('Loading');

    await page.fill('#search-input', parentName);
    await expect(page.getByRole("cell", { name: parentName })).toBeVisible();
    await expect(page.locator('#user-count')).toContainText('of');

    // Clear search
    await page.click('#clear-search');
    await expect(page.locator('#user-count')).not.toContainText('of');
  });

  test("expand user row to see details", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const parentName = `ExpandParent ${ts}`;
    await createParentViaApi(token, {
      email: `expand-${ts}@test.com`,
      name: parentName,
      phone: "555-0100",
    });

    await page.goto("/admin/users");
    await expect(page.getByRole("cell", { name: parentName })).toBeVisible();

    // Click the row to expand
    await page.getByRole("cell", { name: parentName }).click();

    // Should see phone in expanded details
    await expect(page.locator('text=555-0100')).toBeVisible();

    // Should see Edit Roles button in expanded row
    await expect(page.locator(`[data-edit-roles]`).first()).toBeVisible();

    // Click again to collapse
    await page.getByRole("cell", { name: parentName }).click();
    await expect(page.locator('text=555-0100')).not.toBeVisible();
  });

  test("create parent via unified form", async ({ page }) => {
    const ts = Date.now();
    const parentName = `NewParent ${ts}`;

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Create User" }).click();

    // Select Parent role
    await page.locator('#create-modal input[name="create-role"][value="Parent"]').check();

    // Parent-specific phone field should be visible
    await expect(page.locator('#create-phone')).toBeVisible();

    await page.fill('#create-name', parentName);
    await page.fill('#create-email', `parent-${ts}@test.com`);
    await page.fill('#create-password', 'password123');
    await page.fill('#create-phone', '555-1234');
    await page.locator('#create-modal button[type="submit"]').click();

    // User appears in list
    await expect(page.getByRole("cell", { name: parentName })).toBeVisible();
  });

  test("create student via unified form", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const parent = await createParentViaApi(token, {
      email: `stud-parent-${ts}@test.com`,
      name: `StudParent ${ts}`,
    });
    const studentName = `NewStudent ${ts}`;

    await page.goto("/admin/users");
    await expect(page.locator('#user-count')).not.toContainText('Loading');
    await page.getByRole("button", { name: "Create User" }).click();

    // Select Student role
    await page.locator('#create-modal input[name="create-role"][value="Student"]').check();

    // Student-specific fields should be visible, email/password should be hidden
    await expect(page.locator('#create-parent-select')).toBeVisible();
    await expect(page.locator('#create-staff-fields')).toBeHidden();

    await page.fill('#create-name', studentName);
    await page.locator('#create-modal button[type="submit"]').click();

    // User appears in list
    await expect(page.getByRole("cell", { name: studentName })).toBeVisible();
  });

  test("invite user flow", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Invite User" }).click();

    await expect(page.getByRole("heading", { name: "Invite User" })).toBeVisible();
    await page.fill('input[id="invite-email"]', `invite-${Date.now()}@test.com`);
    await page.locator('#invite-modal input[name="invite-role"][value="Tutor"]').check();
    await page.getByRole("button", { name: "Create Invite" }).click();

    await expect(page.locator("text=Invite created")).toBeVisible();
  });

  test("create staff user flow", async ({ page }) => {
    const ts = Date.now();
    const userName = `StaffUser ${ts}`;

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Create User" }).click();

    await expect(page.getByRole("heading", { name: "Create User" })).toBeVisible();
    await page.locator('#create-modal input[name="create-role"][value="Tutor"]').check();
    await page.fill('#create-name', userName);
    await page.fill('#create-email', `staff-${ts}@test.com`);
    await page.fill('#create-password', "password123");
    await page.locator('#create-modal button[type="submit"]').click();

    // User appears in list
    await expect(page.getByRole("cell", { name: userName })).toBeVisible();
  });

  test("edit user roles flow", async ({ page }) => {
    await page.goto("/admin/users");

    // Wait for users to load, then click first user row to expand
    await expect(page.locator('[data-user-row]').first()).toBeVisible();
    await page.locator('[data-user-row]').first().click();

    // Click Edit Roles in expanded row
    await expect(page.locator('[data-edit-roles]').first()).toBeVisible();
    await page.locator('[data-edit-roles]').first().click();

    await expect(page.locator("#roles-title")).toContainText("Edit Roles");

    // Toggle a role and save
    const personnelCheckbox = page.locator('#roles-checkboxes input[value="Personnel"]');
    const wasChecked = await personnelCheckbox.isChecked();
    await personnelCheckbox.setChecked(!wasChecked);
    await page.getByRole("button", { name: "Save" }).click();

    // Modal closes
    await expect(page.locator("#roles-modal")).toBeHidden();

    // Revert the change
    await page.locator('[data-edit-roles]').first().click();
    await personnelCheckbox.setChecked(wasChecked);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("#roles-modal")).toBeHidden();
  });

  test("edit student flow", async ({ page }) => {
    const token = await loginAsAdmin();
    const ts = Date.now();
    const originalName = `ToEditStud ${ts}`;
    const editedName = `EditedStud ${ts}`;
    const parent = await createParentViaApi(token, {
      email: `edit-sparent-${ts}@test.com`,
      name: `EditSParent ${ts}`,
    });
    await createStudentViaApi(token, parent.id, originalName);

    await page.goto("/admin/users");

    // Filter to students for easier finding
    await page.locator('[data-role="Student"]').click();
    await expect(page.getByRole("cell", { name: originalName })).toBeVisible();

    // Click to expand
    await page.getByRole("cell", { name: originalName }).click();

    // Click Edit Student
    await page.locator('[data-edit-student]').first().click();
    await expect(page.getByRole("heading", { name: "Edit Student" })).toBeVisible();
    await page.fill('#edit-student-name', editedName);
    await page.locator('#edit-student-modal button[type="submit"]').click();

    await expect(page.getByRole("cell", { name: editedName })).toBeVisible();
  });

  test("pending chip filters users by pending status", async ({ page }) => {
    // Create an invite — this creates a pending user
    const ts = Date.now();
    const pendingEmail = `pending-status-${ts}@test.com`;

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Invite User" }).click();
    await page.fill('#invite-email', pendingEmail);
    await page.locator('#invite-modal input[name="invite-role"][value="Tutor"]').check();
    await page.getByRole("button", { name: "Create Invite" }).click();
    await expect(page.locator("text=Invite created")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // Pending chip should appear with a count
    const pendingChip = page.locator('[data-role="Pending"]');
    await expect(pendingChip).toBeVisible();
    await expect(pendingChip).toContainText("Pending");
    await expect(pendingChip).toContainText("(");

    // Click the pending chip — filters the same user table (no separate section)
    await pendingChip.click();
    await expect(page.locator('#user-table')).toBeVisible();
    await expect(page.locator('#user-count')).toContainText('of');

    // The pending user should appear with email visible
    await expect(page.getByRole("cell", { name: pendingEmail })).toBeVisible();

    // Click All chip — back to showing all users
    await page.locator('[data-role="All"]').click();
    await expect(page.locator('#user-count')).not.toContainText('of');
  });

  test("pending user shows Pending badge in table", async ({ page }) => {
    // Create an invite to generate a pending user
    const ts = Date.now();
    const pendingEmail = `badge-pending-${ts}@test.com`;

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Invite User" }).click();
    await page.fill('#invite-email', pendingEmail);
    await page.locator('#invite-modal input[name="invite-role"][value="Tutor"]').check();
    await page.getByRole("button", { name: "Create Invite" }).click();
    await expect(page.locator("text=Invite created")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // Filter to pending users
    await page.locator('[data-role="Pending"]').click();

    // Find the row with this email and check for Pending badge
    const row = page.locator(`[data-user-row]`, { has: page.getByRole("cell", { name: pendingEmail }) });
    await expect(row).toBeVisible();
    await expect(row.locator('text=Pending')).toBeVisible();
  });

  test("revoke invite removes pending user", async ({ page }) => {
    const ts = Date.now();
    const pendingEmail = `revoke-${ts}@test.com`;

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Invite User" }).click();
    await page.fill('#invite-email', pendingEmail);
    await page.locator('#invite-modal input[name="invite-role"][value="Tutor"]').check();
    await page.getByRole("button", { name: "Create Invite" }).click();
    await expect(page.locator("text=Invite created")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // Filter to pending, expand the user row
    await page.locator('[data-role="Pending"]').click();
    const row = page.locator(`[data-user-row]`, { has: page.getByRole("cell", { name: pendingEmail }) });
    await expect(row).toBeVisible();
    await row.click();

    // Click Revoke Invite in expanded row
    const revokeBtn = page.locator('[data-revoke-invite]').first();
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    // The pending user should be removed from the list
    await expect(page.getByRole("cell", { name: pendingEmail })).not.toBeVisible();
  });
});

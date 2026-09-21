import { test, expect, type Page } from "@playwright/test";
import { getSessionCookie } from "./helpers/api";

// Unique per run so the spec can run against a non-empty database
const studentName = `Тест Ученик ${Date.now()}`;

async function openJournal(page: Page) {
  await page.goto("/admin/journal");
  await expect(page.locator(".jr-title")).toHaveText("Журнал занятий");
}

test.describe("Student journal", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("sidebar has Journal link and seeded groups", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Journal" }).click();
    await expect(page.locator(".jr-title")).toBeVisible();
    await expect(page.locator(".jr-group-pill", { hasText: "1-я группа" })).toBeVisible();
  });

  test("adds a student and persists it", async ({ page }) => {
    await openJournal(page);
    await page.getByRole("button", { name: "Добавить ученика" }).click();
    await page.getByPlaceholder("Например: Аружан Касымова").fill(studentName);
    await page.getByPlaceholder("Например: 9 класс").fill("9 класс");
    await page.locator(".jr-program-opt", { hasText: "Интенсив" }).click();
    await page.locator(".jr-group-opt", { hasText: "2-я группа" }).click();
    await page.getByRole("button", { name: "Добавить", exact: true }).click();

    await expect(page.locator(".jr-student-name")).toHaveText(studentName);

    await page.reload();
    await page.locator(".jr-student-btn", { hasText: studentName }).click();
    await expect(page.locator(".jr-chip.program-intensive")).toBeVisible();
    await expect(page.locator(".jr-chip.group-chip")).toContainText("2-я группа");
  });

  test("records a lesson with status, topic and essay", async ({ page }) => {
    await openJournal(page);
    await page.locator(".jr-student-btn", { hasText: studentName }).click();
    await page.getByRole("button", { name: "Добавить занятие" }).click();

    const entry = page.locator(".jr-entry").first();
    await entry.getByRole("button", { name: "Пришёл" }).click();

    await entry.getByRole("button", { name: "Выбрать тему из списка…" }).click();
    await page.getByPlaceholder("Поиск темы…").fill("десятичных");
    await page.locator(".jr-topic-row", { hasText: "Деление десятичных дробей" }).click();

    await entry.getByPlaceholder("Что ученик написал о пройденном материале…").fill("Понял деление");
    await entry.getByPlaceholder("Что ученик написал о пройденном материале…").blur();

    // Wait for the debounced essay save to land, then check it survived a reload
    await expect
      .poll(async () => {
        await page.reload();
        await page.locator(".jr-student-btn", { hasText: studentName }).click();
        return page.locator(".jr-essay-input").first().inputValue();
      })
      .toBe("Понял деление");

    const saved = page.locator(".jr-entry").first();
    await expect(saved.locator(".jr-stamp.present")).toBeVisible();
    await expect(saved.locator(".jr-topic-picker-btn")).toContainText("Деление десятичных дробей");
    await expect(page.locator(".jr-att-pie-hole")).toHaveText("100%");
  });

  test("marks attendance from the overview grid", async ({ page }) => {
    await openJournal(page);
    await page.getByRole("button", { name: "Общая таблица посещаемости" }).click();
    await page.locator(".jr-overview-add-date input[type=date]").fill("2026-01-15");
    await page.getByRole("button", { name: "Добавить дату" }).click();

    const cell = page.getByLabel(`${studentName}, 2026-01-15`);
    await cell.fill("0");
    await expect(cell.locator("xpath=..")).toHaveClass(/absent/);

    await page.reload();
    await page.locator(".jr-student-btn", { hasText: studentName }).click();
    await expect(page.locator(".jr-att-legend-row", { hasText: "Не был" })).toContainText("1");
  });

  test("deletes the student after confirmation", async ({ page }) => {
    await openJournal(page);
    const row = page.locator(".jr-student-btn", { hasText: studentName });
    await row.hover();
    await row.getByRole("button", { name: "Удалить ученика" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Удалить" }).click();
    await expect(row).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".jr-student-btn", { hasText: studentName })).toHaveCount(0);
  });
});

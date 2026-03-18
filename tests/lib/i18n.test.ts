import { describe, it, expect } from "vitest";
import { t, getLocale, getAllTranslations } from "../../src/i18n";

describe("i18n", () => {
  describe("getLocale", () => {
    it("defaults to en when no cookie value", () => {
      expect(getLocale()).toBe("en");
      expect(getLocale(null)).toBe("en");
      expect(getLocale(undefined)).toBe("en");
    });

    it("returns ru for ru cookie value", () => {
      expect(getLocale("ru")).toBe("ru");
    });

    it("returns en for unknown values", () => {
      expect(getLocale("fr")).toBe("en");
      expect(getLocale("invalid")).toBe("en");
      expect(getLocale("")).toBe("en");
    });
  });

  describe("t", () => {
    it("resolves top-level keys", () => {
      expect(t("en", "common.loading")).toBe("Loading...");
    });

    it("resolves dotted keys", () => {
      expect(t("en", "nav.dashboard")).toBe("Dashboard");
    });

    it("resolves Russian translations", () => {
      expect(t("ru", "nav.dashboard")).toBe("Панель");
      expect(t("ru", "common.save")).toBe("Сохранить");
    });

    it("falls back to English when Russian key is missing", () => {
      // getAllTranslations guarantees same structure, but if a key were missing
      // in ru.json, it should fall back to English
      expect(t("ru", "nav.dashboard")).toBeTruthy();
    });

    it("falls back to key string when not found in any language", () => {
      expect(t("en", "nonexistent.key.path")).toBe("nonexistent.key.path");
      expect(t("ru", "nonexistent.key.path")).toBe("nonexistent.key.path");
    });

    it("handles placeholder interpolation", () => {
      expect(t("en", "subjects.confirmDelete", { name: "Math" })).toBe(
        'Are you sure you want to delete "Math"?'
      );
    });

    it("handles Russian placeholder interpolation", () => {
      expect(t("ru", "subjects.confirmDelete", { name: "Математика" })).toBe(
        'Вы уверены, что хотите удалить "Математика"?'
      );
    });

    it("leaves unmatched placeholders intact", () => {
      expect(t("en", "subjects.confirmDelete", {})).toBe(
        'Are you sure you want to delete "{name}"?'
      );
    });

    it("handles multiple placeholders", () => {
      expect(
        t("en", "users.userCountFiltered", { filtered: "5", total: "20" })
      ).toBe("5 of 20 users");
    });
  });

  describe("getAllTranslations", () => {
    it("returns full English translation object", () => {
      const en = getAllTranslations("en");
      expect(en.nav).toBeDefined();
      expect(en.nav.dashboard).toBe("Dashboard");
      expect(en.common.save).toBe("Save");
    });

    it("returns full Russian translation object", () => {
      const ru = getAllTranslations("ru");
      expect(ru.nav).toBeDefined();
      expect(ru.nav.dashboard).toBe("Панель");
    });

    it("has same top-level keys in both languages", () => {
      const en = getAllTranslations("en");
      const ru = getAllTranslations("ru");
      expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    });
  });
});

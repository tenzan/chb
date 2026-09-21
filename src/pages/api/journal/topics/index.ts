import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { generateId } from "../../../../lib/id";
import { createTopicSchema } from "../../../../lib/validation";
import { JOURNAL_ROLES, json, validationError, listTopicCategories } from "../../../../lib/journal";

export const GET: APIRoute = async ({ locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  return json({ data: await listTopicCategories(getDB(locals)) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const parsed = createTopicSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { categoryId, text } = parsed.data;

  const category = await db
    .prepare("SELECT id FROM topic_categories WHERE id = ?")
    .bind(categoryId)
    .first();
  if (!category) return json({ error: "Topic category not found" }, 404);

  const duplicate = await db
    .prepare("SELECT id FROM topics WHERE category_id = ? AND text = ?")
    .bind(categoryId, text)
    .first();
  if (duplicate) return json({ error: "Topic already exists in this category" }, 409);

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO topics (id, category_id, text, position)
       VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(position), 0) + 1 FROM topics WHERE category_id = ?2))`
    )
    .bind(id, categoryId, text)
    .run();

  return json({ data: { id, categoryId, text } }, 201);
};

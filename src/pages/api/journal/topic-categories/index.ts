import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { hasRole } from "../../../../lib/rbac";
import { generateId } from "../../../../lib/id";
import { createTopicCategorySchema } from "../../../../lib/validation";
import { JOURNAL_ROLES, json, validationError } from "../../../../lib/journal";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasRole(locals.user!, ...JOURNAL_ROLES)) {
    return json({ error: "Forbidden" }, 403);
  }

  const db = getDB(locals);
  const parsed = createTopicCategorySchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error.flatten());

  const { name } = parsed.data;
  const duplicate = await db
    .prepare("SELECT id FROM topic_categories WHERE name = ?")
    .bind(name)
    .first();
  if (duplicate) return json({ error: "Topic category already exists" }, 409);

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO topic_categories (id, name, position)
       VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM topic_categories))`
    )
    .bind(id, name)
    .run();

  return json({ data: { id, name, topics: [] } }, 201);
};

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Live dinner-party workspace persisted on ChatGPT Sites D1 (`DB`). */
export const parties = sqliteTable(
  "parties",
  {
    id: text("id").primaryKey(),
    workspace: text("workspace").notNull(),
    updatedAt: integer("updated_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("parties_updated_at").on(table.updatedAt)],
);

export const schema = { parties };

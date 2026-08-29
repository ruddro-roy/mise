import { emptyWorkspace } from "../domain/sample";
import type { Workspace } from "../domain/types";

export function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.brief === "object" &&
    record.brief !== null &&
    Array.isArray(record.guests) &&
    Array.isArray(record.dishes)
  );
}

export function sanitizeWorkspace(value: unknown): Workspace {
  if (!isWorkspace(value)) return emptyWorkspace();
  return {
    ...emptyWorkspace(),
    ...value,
  };
}

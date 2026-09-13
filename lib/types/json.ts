/** JSON-compatible value used for persisted Supabase JSON/JSONB fields. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Convert a known serializable record into the JSON object type used at persistence boundaries. */
export function toJsonObject(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

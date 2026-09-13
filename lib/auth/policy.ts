/**
 * Deny-by-default API authentication policy.
 *
 * Production (`NODE_ENV === "production"`) always requires a verified identity.
 * Forgetting AUTOSEO_AUTH_REQUIRED must not leave APIs anonymously writable.
 *
 * Local development may keep the documented demo fallback unless
 * AUTOSEO_AUTH_REQUIRED=true.
 */
export function isApiAuthRequired(env: { NODE_ENV?: string; AUTOSEO_AUTH_REQUIRED?: string } = process.env): boolean {
  if (env.NODE_ENV === "production") return true;
  return env.AUTOSEO_AUTH_REQUIRED === "true";
}

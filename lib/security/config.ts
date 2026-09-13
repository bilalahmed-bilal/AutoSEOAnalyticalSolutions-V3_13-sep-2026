/** Production security configuration checks. Keep secrets server-side only. */
export function validateProductionSecurityConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AUTOSEO_ENCRYPTION_KEY",
    "AUTOSEO_APP_SECRET",
    "AUTOSEO_WORKER_SECRET",
    "CRON_SECRET",
  ];

  const missing = required.filter((name) => !process.env[name]?.trim());
  if (process.env.AUTOSEO_AUTH_REQUIRED !== "true") {
    missing.push("AUTOSEO_AUTH_REQUIRED=true");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    missing.push("NEXT_PUBLIC_APP_URL");
  } else {
    try {
      const url = new URL(appUrl);
      if (url.protocol !== "https:") missing.push("NEXT_PUBLIC_APP_URL=https://...");
    } catch {
      missing.push("NEXT_PUBLIC_APP_URL(valid URL)");
    }
  }

  const encryptionKey = process.env.AUTOSEO_ENCRYPTION_KEY?.trim();
  if (encryptionKey && !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    missing.push("AUTOSEO_ENCRYPTION_KEY(64 hex chars)");
  }

  if (missing.length) {
    throw new Error(`Production security configuration invalid: ${missing.join(", ")}`);
  }
}

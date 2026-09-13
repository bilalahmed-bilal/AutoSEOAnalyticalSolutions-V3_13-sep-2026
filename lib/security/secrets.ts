import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const configured = process.env.AUTOSEO_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("AUTOSEO_ENCRYPTION_KEY is required to store connected-account credentials securely.");
  }

  const key = /^[0-9a-fA-F]{64}$/.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("AUTOSEO_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // one-time compatibility with legacy local dbs
  const parts = value.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret format.");
  const [ivRaw, tagRaw, ciphertextRaw] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptObjectSecrets<T extends Record<string, unknown>>(obj: T, fields: readonly (keyof T)[]): T {
  const copy = { ...obj };
  for (const field of fields) {
    const value = copy[field];
    if (typeof value === "string" && value) copy[field] = encryptSecret(value) as T[keyof T];
  }
  return copy;
}

export function decryptObjectSecrets<T extends Record<string, unknown>>(obj: T, fields: readonly (keyof T)[]): T {
  const copy = { ...obj };
  for (const field of fields) {
    const value = copy[field];
    if (typeof value === "string" && value) copy[field] = decryptSecret(value) as T[keyof T];
  }
  return copy;
}

/** Compare shared secrets without leaking length via early string inequality. */
export function secretsMatch(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const left = crypto.createHash("sha256").update(provided).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

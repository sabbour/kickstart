import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export type PrincipalRequest = {
  headers: {
    get(name: string): string | undefined | null;
  };
};

export function getSwaPrincipalId(request: PrincipalRequest): string | null {
  const principalId = request.headers.get("x-ms-client-principal-id")?.trim();
  return principalId || null;
}

function deriveKey(secret: string, purpose: string): Buffer {
  return createHash("sha256")
    .update(secret)
    .update(":")
    .update(purpose)
    .digest();
}

export function seal<T>(payload: T, secret: string, purpose: string): string {
  const iv = randomBytes(12);
  const key = deriveKey(secret, purpose);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(purpose));

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function unseal<T>(value: string, secret: string, purpose: string): T | null {
  const [ivPart, tagPart, dataPart] = value.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    return null;
  }

  try {
    const key = deriveKey(secret, purpose);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

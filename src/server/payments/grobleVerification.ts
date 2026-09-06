import { createHmac, timingSafeEqual } from "node:crypto";

export type JsonRecord = Record<string, unknown>;

export type WebhookEnvelope = {
  id: string;
  type: string;
  version: string | null;
  occurredAt: string | null;
  object: JsonRecord;
  payload: JsonRecord;
};

export function jsonRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

export function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseEnvelope(rawBody: string): WebhookEnvelope | null {
  const parsed = jsonRecord(JSON.parse(rawBody) as unknown);
  const data = jsonRecord(parsed?.data);
  const object = jsonRecord(data?.object);
  const id = text(parsed?.id);
  const type = text(parsed?.type);

  if (!parsed || !object || !id || !type) return null;

  return {
    id,
    type,
    version: text(parsed.version),
    occurredAt: text(parsed.occurredAt),
    object,
    payload: parsed,
  };
}

export function matchesSignature(signature: string, expected: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const actualBuffer = Buffer.from(signature.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected.toLowerCase(), "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function verifySignature({
  rawBody,
  timestamp,
  signatures,
}: {
  rawBody: string;
  timestamp: string;
  signatures: string[];
}) {
  const secrets = [
    process.env.GROBLE_WEBHOOK_SECRET,
    process.env.GROBLE_WEBHOOK_SECRET_PREVIOUS,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (secrets.length === 0) {
    throw new Error("GROBLE_WEBHOOK_SECRET is not configured.");
  }

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");
    return signatures.some((signature) =>
      matchesSignature(signature, expected),
    );
  });
}

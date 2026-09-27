import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export class AdminApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonSuccess(data, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonError(error) {
  const requestId = randomUUID();
  const known = error instanceof AdminApiError;
  const missingFirebaseConfiguration = error instanceof Error
    && (/Could not load the default credentials/i.test(error.message)
      || error.message.startsWith("Firebase Admin is not configured:")
      || error.message.startsWith("Firebase Admin credentials are incomplete:"));
  const status = known ? error.status : missingFirebaseConfiguration ? 503 : 500;
  const code = known ? error.code : missingFirebaseConfiguration ? "FIREBASE_ADMIN_NOT_CONFIGURED" : "INTERNAL";
  const message = known
    ? error.message
    : missingFirebaseConfiguration
      ? "Firebase Admin credentials are not configured on the server. Set a service account or configure Application Default Credentials."
      : "The request could not be completed.";
  if (!known && !missingFirebaseConfiguration) console.error("Admin API request failed", { requestId, error });
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "");
  if (!origin || !host || origin !== `${protocol}://${host}`) {
    throw new AdminApiError(403, "INVALID_ORIGIN", "The request origin could not be verified.");
  }
}

export async function readJson(request, maxBytes = 16_384) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new AdminApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new AdminApiError(400, "INVALID_JSON", "A JSON request body is required.");
  try {
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new AdminApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
}

export function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

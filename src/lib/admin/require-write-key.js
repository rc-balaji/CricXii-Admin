import "server-only";
import { timingSafeEqual } from "node:crypto";
import { AdminApiError } from "./http";

const MIN_KEY_BYTES = 32;

export function requireWriteConfirmation(suppliedKey) {
  const expectedKey = process.env.ADMIN_WRITE_CONFIRMATION_KEY;
  if (!expectedKey || Buffer.byteLength(expectedKey, "utf8") < MIN_KEY_BYTES) {
    throw new AdminApiError(503, "WRITE_KEY_NOT_CONFIGURED", "Set a strong ADMIN_WRITE_CONFIRMATION_KEY on the server before enabling updates.");
  }
  if (typeof suppliedKey !== "string" || Buffer.byteLength(suppliedKey, "utf8") !== Buffer.byteLength(expectedKey, "utf8")) {
    throw new AdminApiError(403, "INVALID_CONFIRMATION_KEY", "The update confirmation key is incorrect.");
  }
  if (!timingSafeEqual(Buffer.from(suppliedKey, "utf8"), Buffer.from(expectedKey, "utf8"))) {
    throw new AdminApiError(403, "INVALID_CONFIRMATION_KEY", "The update confirmation key is incorrect.");
  }
}

export function sharedKeyActor() {
  return { uid: "shared-confirmation-key", email: null, role: "key-confirmed" };
}

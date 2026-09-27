import { getAdminAuth } from "../../../../lib/firebase/admin";
import { AdminApiError, jsonError, jsonSuccess, readJson, requireSameOrigin } from "../../../../lib/admin/http";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || typeof body.idToken !== "string" || body.idToken.length > 12_000) {
      throw new AdminApiError(422, "INVALID_TOKEN", "A valid Firebase sign-in token is required.");
    }

    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(body.idToken, true);
    } catch (error) {
      if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
        throw new AdminApiError(401, "INVALID_TOKEN", "Firebase could not verify this sign-in. Sign in again.");
      }
      throw error;
    }
    if (decoded.admin !== true || !["support", "operator", "owner"].includes(decoded.adminRole)) {
      throw new AdminApiError(403, "FORBIDDEN", "This Firebase account is not authorized for the admin console.");
    }
    const email = decoded.email?.toLowerCase() || null;
    const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || "")
      .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length && (!email || !allowedEmails.includes(email))) {
      throw new AdminApiError(403, "FORBIDDEN", "This account is not on the administrator allowlist.");
    }
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      throw new AdminApiError(403, "RECENT_AUTH_REQUIRED", "Sign in again before continuing.");
    }
    return jsonSuccess({
      eligible: true,
      mfaAuthenticated: Boolean(decoded.firebase?.sign_in_second_factor),
      email,
      role: decoded.adminRole,
    });
  } catch (error) {
    return jsonError(error);
  }
}

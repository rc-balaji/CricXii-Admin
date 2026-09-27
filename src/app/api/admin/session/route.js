import { NextResponse } from "next/server";
import { adminAuth } from "../../../../lib/firebase/admin";
import { requireAdmin } from "../../../../lib/admin/require-admin";
import { AdminApiError, jsonError, jsonSuccess, readJson, requireSameOrigin } from "../../../../lib/admin/http";

export const runtime = "nodejs";
const cookieName = process.env.ADMIN_SESSION_COOKIE_NAME || "cricxii_admin_session";
const maxAge = Math.min(Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || 14_400), 14_400);

function setSessionCookie(response, value, age) {
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: age,
  });
}

export async function GET() {
  try {
    const actor = await requireAdmin();
    return jsonSuccess({ authenticated: true, email: actor.email, role: actor.role });
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return jsonSuccess({ authenticated: false }, 200);
    }
    return jsonError(error);
  }
}

export async function POST(request) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || typeof body.idToken !== "string" || body.idToken.length > 12_000) {
      throw new AdminApiError(422, "INVALID_TOKEN", "A valid Firebase sign-in token is required.");
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(body.idToken, true);
    } catch (error) {
      if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
        throw new AdminApiError(401, "INVALID_TOKEN", "Firebase could not verify this sign-in. Sign in again.");
      }
      throw error;
    }
    const role = decoded.adminRole;
    if (decoded.admin !== true || !["support", "operator", "owner"].includes(role)) {
      throw new AdminApiError(403, "FORBIDDEN", "This Firebase account is not authorized for the admin console.");
    }
    if (process.env.ADMIN_REQUIRE_MFA !== "false" && !decoded.firebase?.sign_in_second_factor) {
      throw new AdminApiError(403, "MFA_REQUIRED", "Use an administrator account with multi-factor authentication enabled.");
    }
    const email = decoded.email?.toLowerCase() || null;
    const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || "")
      .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length && (!email || !allowedEmails.includes(email))) {
      throw new AdminApiError(403, "FORBIDDEN", "This account is not on the administrator allowlist.");
    }
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      throw new AdminApiError(403, "RECENT_AUTH_REQUIRED", "Sign in again before starting an administrator session.");
    }

    const sessionCookie = await adminAuth.createSessionCookie(body.idToken, { expiresIn: maxAge * 1000 });
    const response = jsonSuccess({ authenticated: true, email, role });
    setSessionCookie(response, sessionCookie, maxAge);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request) {
  try {
    requireSameOrigin(request);
    const response = jsonSuccess({ signedOut: true });
    setSessionCookie(response, "", 0);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

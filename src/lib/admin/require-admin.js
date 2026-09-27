import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth } from "../firebase/admin";
import { AdminApiError } from "./http";

export const ADMIN_ROLES = ["support", "operator", "owner"];
const roleRank = { support: 1, operator: 2, owner: 3 };

export async function requireAdmin(minimumRole = "support") {
  const cookieName = process.env.ADMIN_SESSION_COOKIE_NAME || "cricxii_admin_session";
  const cookie = (await cookies()).get(cookieName)?.value;
  if (!cookie) throw new AdminApiError(401, "UNAUTHENTICATED", "Sign in with an authorized administrator account.");

  let decoded;
  try {
    decoded = await getAdminAuth().verifySessionCookie(cookie, true);
  } catch {
    throw new AdminApiError(401, "UNAUTHENTICATED", "Your administrator session has expired. Sign in again.");
  }

  const role = decoded.adminRole;
  if (decoded.admin !== true || !ADMIN_ROLES.includes(role)) {
    throw new AdminApiError(403, "FORBIDDEN", "This Firebase account is not authorized for the admin console.");
  }
  if (roleRank[role] < roleRank[minimumRole]) {
    throw new AdminApiError(403, "FORBIDDEN", "Your administrator role does not allow this action.");
  }
  if (process.env.ADMIN_REQUIRE_MFA !== "false" && !decoded.firebase?.sign_in_second_factor) {
    throw new AdminApiError(403, "MFA_REQUIRED", "Complete administrator multi-factor authentication before continuing.");
  }
  const email = decoded.email?.toLowerCase() || null;
  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (allowedEmails.length && (!email || !allowedEmails.includes(email))) {
    throw new AdminApiError(403, "FORBIDDEN", "This account is not on the administrator allowlist.");
  }

  return { uid: decoded.uid, email, role };
}

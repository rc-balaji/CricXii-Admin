import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebase/admin";
import { createAuditRecord } from "../../../../lib/admin/audit";
import { AdminApiError, jsonError, jsonSuccess, serializeTimestamp } from "../../../../lib/admin/http";
import { requireAdmin } from "../../../../lib/admin/require-admin";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const actor = await requireAdmin("owner");
    const adminDb = getAdminDb();
    const params = new URL(request.url).searchParams;
    const limitValue = Number(params.get("limit") || 25);
    if (!Number.isInteger(limitValue) || limitValue < 1) throw new AdminApiError(422, "INVALID_LIMIT", "The page size must be a positive whole number.");
    const limit = Math.min(50, limitValue);
    const cursor = params.get("cursor");
    let query = adminDb.collection("adminAuditLogs").orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
    const filters = [
      ["actorEmail", (params.get("operator") || "").trim().toLowerCase()],
      ["targetId", (params.get("targetPlayer") || "").trim()],
      ["action", (params.get("action") || "").trim()],
    ];
    for (const [field, value] of filters) {
      if (value.length > 160) throw new AdminApiError(422, "INVALID_FILTER", "An audit filter is too long.");
      if (value) query = query.where(field, "==", value);
    }
    const from = params.get("from");
    const to = params.get("to");
    if (from) {
      const date = new Date(from);
      if (Number.isNaN(date.getTime())) throw new AdminApiError(422, "INVALID_DATE", "The audit start date is invalid.");
      query = query.where("createdAt", ">=", Timestamp.fromDate(date));
    }
    if (to) {
      const date = new Date(to);
      if (Number.isNaN(date.getTime())) throw new AdminApiError(422, "INVALID_DATE", "The audit end date is invalid.");
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) date.setUTCHours(23, 59, 59, 999);
      query = query.where("createdAt", "<=", Timestamp.fromDate(date));
    }
    const auditRead = createAuditRecord({ actor, action: "admin.audit.read", targetType: "adminAudit", targetId: "adminAuditLogs" });
    await auditRead.ref.set(auditRead.data);
    if (cursor) {
      let id;
      try { id = Buffer.from(cursor, "base64url").toString("utf8"); } catch { id = ""; }
      if (!id || Buffer.from(id, "utf8").toString("base64url") !== cursor) {
        throw new AdminApiError(422, "INVALID_CURSOR", "The audit cursor is invalid.");
      }
      const snapshot = await adminDb.collection("adminAuditLogs").doc(id).get();
      if (!snapshot.exists) throw new AdminApiError(422, "INVALID_CURSOR", "The audit cursor has expired.");
      query = query.startAfter(snapshot);
    }
    const result = await query.limit(limit + 1).get();
    const hasMore = result.docs.length > limit;
    const docs = hasMore ? result.docs.slice(0, limit) : result.docs;
    const last = docs.at(-1);
    return jsonSuccess({
      items: docs.map((doc) => {
        const value = doc.data();
        return {
          id: doc.id,
          action: typeof value.action === "string" ? value.action : "Admin action",
          targetId: typeof value.targetId === "string" ? value.targetId : "",
          actorEmail: typeof value.actorEmail === "string" ? value.actorEmail : "",
          actorRole: typeof value.actorRole === "string" ? value.actorRole : "",
          reason: typeof value.reason === "string" ? value.reason : "",
          createdAt: serializeTimestamp(value.createdAt),
          outcome: typeof value.outcome === "string" ? value.outcome : "success",
        };
      }),
      nextCursor: hasMore && last ? Buffer.from(last.id, "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

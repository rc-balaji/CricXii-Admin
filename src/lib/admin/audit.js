import { getAdminDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export function createAuditRecord({ actor, action, targetType = "player", targetId, reason = null, changedFields = [], outcome = "success", before, after }) {
  const record = {
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    reason,
    changedFields,
    requestId: crypto.randomUUID(),
    createdAt: FieldValue.serverTimestamp(),
    outcome,
  };
  if (before) record.before = before;
  if (after) record.after = after;
  return {
    ref: getAdminDb().collection("adminAuditLogs").doc(),
    data: record,
  };
}

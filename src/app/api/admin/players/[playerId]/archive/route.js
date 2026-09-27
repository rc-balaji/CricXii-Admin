import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../../lib/firebase/admin";
import { createAuditRecord } from "../../../../../../lib/admin/audit";
import { AdminApiError, jsonError, jsonSuccess, readJson, requireSameOrigin, serializeTimestamp } from "../../../../../../lib/admin/http";
import { requireAdmin } from "../../../../../../lib/admin/require-admin";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    requireSameOrigin(request);
    const actor = await requireAdmin("operator");
    const { playerId } = await params;
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(playerId || "")) throw new AdminApiError(422, "INVALID_PLAYER_ID", "The player ID is invalid.");
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminApiError(422, "INVALID_BODY", "The request body is invalid.");
    if (typeof body.archived !== "boolean") throw new AdminApiError(422, "INVALID_STATUS", "Archived must be true or false.");
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 300) throw new AdminApiError(422, "INVALID_REASON", "Give a reason between 5 and 300 characters.");
    const playerRef = adminDb.collection("players").doc(playerId);
    const audit = createAuditRecord({
      actor,
      action: body.archived ? "player.archive" : "player.restore",
      targetId: playerId,
      reason,
      changedFields: ["archived"],
    });

    const version = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(playerRef);
      if (!current.exists) throw new AdminApiError(404, "PLAYER_NOT_FOUND", "Player not found.");
      const updatedAt = serializeTimestamp(current.get("updatedAt")) || "missing";
      if (typeof body.expectedUpdatedAt !== "string" || body.expectedUpdatedAt !== updatedAt) {
        throw new AdminApiError(409, "STALE_PROFILE", "This profile changed since it was opened. Refresh it before saving.");
      }
      transaction.update(playerRef, { archived: body.archived, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(audit.ref, {
        ...audit.data,
        before: { archived: current.get("archived") === true },
        after: { archived: body.archived },
      });
      return true;
    });

    if (!version) throw new Error("Archive transaction returned an invalid result.");
    const updated = await playerRef.get();
    return jsonSuccess({
      playerId: updated.id,
      archived: updated.get("archived") === true,
      updatedAt: serializeTimestamp(updated.get("updatedAt")),
    });
  } catch (error) {
    return jsonError(error);
  }
}

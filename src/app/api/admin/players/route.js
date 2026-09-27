import { createHash } from "node:crypto";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase/admin";
import { createAuditRecord } from "../../../../lib/admin/audit";
import { AdminApiError, jsonError, jsonSuccess, serializeTimestamp } from "../../../../lib/admin/http";
import { requireAdmin } from "../../../../lib/admin/require-admin";

export const runtime = "nodejs";
const MAX_PAGE_SIZE = 50;

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function statsProjection(value) {
  const stats = value && typeof value === "object" ? value : {};
  return {
    matches: safeNumber(stats.matches),
    runs: safeNumber(stats.runs),
    points: safeNumber(stats.points),
    wickets: safeNumber(stats.wickets),
    wins: safeNumber(stats.wins),
  };
}

function playerProjection(snapshot) {
  const player = snapshot.data();
  return {
    playerId: snapshot.id,
    name: typeof player.name === "string" ? player.name : "",
    joinedAt: serializeTimestamp(player.joinedAt),
    archived: player.archived === true,
    gangId: typeof player.gangId === "string" ? player.gangId : null,
    battingStyle: typeof player.battingStyle === "string" ? player.battingStyle : "",
    bowlingStyle: typeof player.bowlingStyle === "string" ? player.bowlingStyle : "",
    customBowlingStyle: typeof player.customBowlingStyle === "string" ? player.customBowlingStyle : "",
    bio: typeof player.bio === "string" ? player.bio : "",
    socialLinks: player.socialLinks && typeof player.socialLinks === "object" ? player.socialLinks : {},
    stats: statsProjection(player.stats),
    teamStats: statsProjection(player.teamStats),
    updatedAt: serializeTimestamp(player.updatedAt),
  };
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const id = Buffer.from(value, "base64url").toString("utf8");
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(id) || Buffer.from(id, "utf8").toString("base64url") !== value) return null;
    return id;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const actor = await requireAdmin();
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim();
    const qType = params.get("qType") || (q.includes("@") ? "email" : (/^CX-[A-Za-z0-9_-]+$/i.test(q) || /^\d{6,}$/.test(q) ? "playerId" : "namePrefix"));
    const status = params.get("status") || "active";
    const limitValue = Number(params.get("limit") || 25);
    if (!Number.isInteger(limitValue) || limitValue < 1) throw new AdminApiError(422, "INVALID_LIMIT", "The page size must be a positive whole number.");
    const limit = Math.min(MAX_PAGE_SIZE, limitValue);
    const cursor = params.get("cursor");
    if (!["active", "archived", "all"].includes(status)) {
      throw new AdminApiError(422, "INVALID_STATUS", "The player status filter is invalid.");
    }
    if (!["playerId", "email", "namePrefix"].includes(qType)) {
      throw new AdminApiError(422, "INVALID_SEARCH_TYPE", "The player search type is invalid.");
    }
    if (q.length > 120) throw new AdminApiError(422, "QUERY_TOO_LONG", "The search query is too long.");
    const archived = status === "all" ? null : status === "archived";
    const collection = adminDb.collection("players");

    if (qType === "email") {
      if (actor.role === "support") {
        throw new AdminApiError(403, "FORBIDDEN", "Email search requires an operator role.");
      }
      if (!q || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) {
        throw new AdminApiError(422, "INVALID_EMAIL", "Enter a valid email address.");
      }
      const emailKey = createHash("sha256").update(q.toLowerCase()).digest("hex");
      const credential = await adminDb.collection("loginCredentials").doc(emailKey).get();
      const credentialPlayerId = credential.get("playerId");
      if (!credential.exists || typeof credentialPlayerId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(credentialPlayerId)) {
        return jsonSuccess({ items: [], nextCursor: null });
      }
      const player = await collection.doc(credentialPlayerId).get();
      if (!player.exists || (archived !== null && (player.get("archived") === true) !== archived)) {
        return jsonSuccess({ items: [], nextCursor: null });
      }
      const audit = createAuditRecord({ actor, action: "player.email_search", targetId: player.id, reason: "Exact account email search", changedFields: [] });
      await audit.ref.set(audit.data);
      return jsonSuccess({ items: [{ ...playerProjection(player), accountEmail: q.toLowerCase() }], nextCursor: null });
    }

    if (qType === "playerId" && q) {
      if (!/^[A-Za-z0-9_-]{1,150}$/.test(q)) throw new AdminApiError(422, "INVALID_PLAYER_ID", "The player ID is invalid.");
      const player = await collection.doc(q).get();
      if (!player.exists || (archived !== null && (player.get("archived") === true) !== archived)) {
        return jsonSuccess({ items: [], nextCursor: null });
      }
      return jsonSuccess({ items: [playerProjection(player)], nextCursor: null });
    }

    const cursorId = decodeCursor(cursor);
    if (cursor && !cursorId) {
      throw new AdminApiError(422, "INVALID_CURSOR", "The page cursor is invalid. Refresh the list and try again.");
    }
    let query = collection;
    if (archived !== null) query = query.where("archived", "==", archived);
    if (q && qType === "namePrefix") {
      query = query.where("name", ">=", q).where("name", "<=", `${q}\uf8ff`).orderBy("name").orderBy(FieldPath.documentId());
    } else {
      query = query.orderBy(FieldPath.documentId());
    }
    if (cursorId) {
      const cursorSnapshot = await collection.doc(cursorId).get();
      if (!cursorSnapshot.exists) {
        throw new AdminApiError(422, "INVALID_CURSOR", "The page cursor has expired. Refresh the list.");
      }
      query = query.startAfter(cursorSnapshot);
    }
    const result = await query.limit(limit + 1).get();
    const hasMore = result.docs.length > limit;
    const documents = hasMore ? result.docs.slice(0, limit) : result.docs;
    const last = documents.at(-1);
    return jsonSuccess({
      items: documents.map(playerProjection),
      nextCursor: hasMore && last ? Buffer.from(last.id, "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

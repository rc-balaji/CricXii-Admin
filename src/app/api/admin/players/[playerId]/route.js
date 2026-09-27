import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/firebase/admin";
import { createAuditRecord } from "../../../../../lib/admin/audit";
import { AdminApiError, jsonError, jsonSuccess, readJson, requireSameOrigin, serializeTimestamp } from "../../../../../lib/admin/http";
import { requireAdmin } from "../../../../../lib/admin/require-admin";

export const runtime = "nodejs";

const editableFields = new Set([
  "name",
  "bio",
  "battingStyle",
  "bowlingStyles",
  "customBowlingStyle",
  "socialLinks",
]);
const battingStyles = new Set(["Right hand", "Left hand"]);
const bowlingStyles = new Set(["Right arm fast", "Right arm medium", "Right arm off break", "Right arm leg break", "Left arm orthodox", "Left arm fast", "Left arm medium"]);
const socialFields = new Set(["instagram", "facebook", "twitter", "youtube"]);

function statsProjection(value) {
  const stats = value && typeof value === "object" ? value : {};
  return Object.fromEntries(["matches", "runs", "balls", "outs", "wickets", "catches", "directRunOuts", "assistedRunOuts", "stumpings", "points", "wins"]
    .map((field) => [field, Number.isFinite(stats[field]) ? stats[field] : 0]));
}

function project(snapshot) {
  const value = snapshot.data();
  return {
    playerId: snapshot.id,
    name: typeof value.name === "string" ? value.name : "",
    bio: typeof value.bio === "string" ? value.bio : "",
    age: Number.isFinite(value.age) ? value.age : null,
    battingStyle: typeof value.battingStyle === "string" ? value.battingStyle : "",
    bowlingStyles: Array.isArray(value.bowlingStyles) ? value.bowlingStyles.filter((item) => typeof item === "string") : [],
    customBowlingStyle: typeof value.customBowlingStyle === "string" ? value.customBowlingStyle : "",
    socialLinks: value.socialLinks && typeof value.socialLinks === "object" ? value.socialLinks : {},
    archived: value.archived === true,
    gangId: typeof value.gangId === "string" ? value.gangId : null,
    joinedAt: serializeTimestamp(value.joinedAt),
    updatedAt: serializeTimestamp(value.updatedAt),
    stats: statsProjection(value.stats),
    teamStats: statsProjection(value.teamStats),
  };
}

function validateChanges(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new AdminApiError(422, "INVALID_CHANGES", "Provide profile fields to update.");
  }
  const entries = Object.entries(changes);
  if (!entries.length || entries.some(([field]) => !editableFields.has(field))) {
    throw new AdminApiError(422, "INVALID_FIELDS", "One or more profile fields cannot be changed.");
  }

  const result = {};
  for (const [field, value] of entries) {
    if (field === "name") {
      if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 60) {
        throw new AdminApiError(422, "INVALID_NAME", "Name must be between 1 and 60 characters.");
      }
      result.name = value.trim();
    } else if (field === "bio") {
      if (typeof value !== "string" || value.length > 500) {
        throw new AdminApiError(422, "INVALID_BIO", "Bio must be 500 characters or fewer.");
      }
      result.bio = value.trim();
    } else if (field === "battingStyle") {
      if (typeof value !== "string" || !battingStyles.has(value)) {
        throw new AdminApiError(422, "INVALID_BATTING_STYLE", "Choose a supported batting style.");
      }
      result.battingStyle = value;
    } else if (field === "bowlingStyles") {
      if (!Array.isArray(value) || value.length > 5 || value.some((style) => typeof style !== "string" || !bowlingStyles.has(style))) {
        throw new AdminApiError(422, "INVALID_BOWLING_STYLES", "Choose supported bowling styles.");
      }
      result.bowlingStyles = value;
    } else if (field === "customBowlingStyle") {
      if (typeof value !== "string" || value.length > 60) {
        throw new AdminApiError(422, "INVALID_BOWLING_STYLE", "Custom bowling style must be 60 characters or fewer.");
      }
      result.customBowlingStyle = value.trim();
    } else if (field === "socialLinks") {
      if (!value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).some((key) => !socialFields.has(key))) {
        throw new AdminApiError(422, "INVALID_SOCIAL_LINKS", "One or more social links are not supported.");
      }
      for (const [key, url] of Object.entries(value)) {
        if (typeof url !== "string" || url.length > 300) {
          throw new AdminApiError(422, "INVALID_SOCIAL_LINK", `The ${key} link is invalid.`);
        }
        if (url) {
          let parsed;
          try { parsed = new URL(url); } catch { throw new AdminApiError(422, "INVALID_SOCIAL_LINK", `The ${key} link must be a valid URL.`); }
          if (parsed.protocol !== "https:") throw new AdminApiError(422, "INVALID_SOCIAL_LINK", `The ${key} link must use HTTPS.`);
        }
      }
      result.socialLinks = value;
    }
  }
  return result;
}

function checkExpectedVersion(currentVersion, expected) {
  if (typeof expected !== "string" || expected !== (currentVersion || "missing")) {
    throw new AdminApiError(409, "STALE_PROFILE", "This profile changed since it was opened. Refresh it before saving.");
  }
}

export async function GET(request, { params }) {
  try {
    const actor = await requireAdmin();
    const { playerId } = await params;
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(playerId || "")) throw new AdminApiError(422, "INVALID_PLAYER_ID", "The player ID is invalid.");
    const snapshot = await adminDb.collection("players").doc(playerId).get();
    if (!snapshot.exists) throw new AdminApiError(404, "PLAYER_NOT_FOUND", "Player not found.");
    const player = project(snapshot);
    const audit = createAuditRecord({ actor, action: "player.profile.view", targetId: playerId, changedFields: [] });
    await audit.ref.set(audit.data);
    return jsonSuccess(player);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    requireSameOrigin(request);
    const actor = await requireAdmin("operator");
    const { playerId } = await params;
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(playerId || "")) throw new AdminApiError(422, "INVALID_PLAYER_ID", "The player ID is invalid.");
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminApiError(422, "INVALID_BODY", "The request body is invalid.");
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 300) throw new AdminApiError(422, "INVALID_REASON", "Give a reason between 5 and 300 characters.");
    const changes = validateChanges(body.changes);
    const playerRef = adminDb.collection("players").doc(playerId);
    const audit = createAuditRecord({ actor, action: "player.profile.update", targetId: playerId, reason, changedFields: Object.keys(changes) });

    const updated = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(playerRef);
      if (!current.exists) throw new AdminApiError(404, "PLAYER_NOT_FOUND", "Player not found.");
      const before = project(current);
      checkExpectedVersion(before.updatedAt, body.expectedUpdatedAt);
      const after = { ...before, ...changes };
      transaction.update(playerRef, { ...changes, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(audit.ref, { ...audit.data, before: Object.fromEntries(Object.keys(changes).map((key) => [key, before[key]])), after: Object.fromEntries(Object.keys(changes).map((key) => [key, after[key]])) });
      return after;
    });

    const refreshed = await playerRef.get();
    return jsonSuccess(project(refreshed));
  } catch (error) {
    return jsonError(error);
  }
}

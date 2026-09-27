import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [emailInput, role] = process.argv.slice(2);
const validRoles = new Set(["support", "operator", "owner"]);

if (!emailInput || !validRoles.has(role)) {
  console.error("Usage: npm run admin:grant -- <existing-firebase-auth-email> <support|operator|owner>");
  process.exitCode = 1;
} else {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId) throw new Error("Set FIREBASE_PROJECT_ID before granting admin claims.");
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
  const app = getApps()[0] ?? initializeApp({ credential, projectId });
  const auth = getAuth(app);
  const user = await auth.getUserByEmail(emailInput.trim().toLowerCase());
  await auth.setCustomUserClaims(user.uid, {
    ...user.customClaims,
    admin: true,
    adminRole: role,
  });
  console.info(`Granted ${role} admin claim to ${user.email} in Firebase project ${projectId}.`);
}

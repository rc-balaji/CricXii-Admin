import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let initializedApp;

function getAdminApp() {
  if (initializedApp) return initializedApp;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Firebase Admin is not configured: set FIREBASE_PROJECT_ID.");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if ((clientEmail && !privateKey) || (!clientEmail && privateKey)) {
    throw new Error("Firebase Admin credentials are incomplete: set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or configure Application Default Credentials.");
  }
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();

  initializedApp = getApps()[0] ?? initializeApp({ credential, projectId });
  return initializedApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

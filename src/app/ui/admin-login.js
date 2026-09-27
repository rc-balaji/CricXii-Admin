"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMultiFactorResolver,
  multiFactor,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase/client";

function signInMessage(error) {
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(error.code)) {
    return "Email or password did not match a Firebase Authentication admin account. A CricXii player-app password cannot sign in here.";
  }
  if (error.code === "auth/too-many-requests") return "Too many attempts. Wait a while and try again.";
  if (error.code === "auth/network-request-failed") return "Could not reach Firebase. Check your connection and try again.";
  if (error.code === "auth/operation-not-allowed") return "Enable Email/Password sign-in in Firebase Authentication before using this page.";
  return error.message || "Administrator sign-in failed.";
}

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [factorResolver, setFactorResolver] = useState(null);
  const [factorCode, setFactorCode] = useState("");
  const [totpSecret, setTotpSecret] = useState(null);
  const [enrollmentCode, setEnrollmentCode] = useState("");

  async function postJson(url, data) {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message || "Administrator sign-in was not authorized.");
    return body.data;
  }

  async function finishAdminSignIn(user) {
    const idToken = await user.getIdToken(true);
    const eligibility = await postJson("/api/admin/enrollment", { idToken });
    if (!eligibility.eligible) throw new Error("This account is not eligible for admin access.");
    if (eligibility.mfaAuthenticated) {
      await postJson("/api/admin/session", { idToken });
      await signOut(firebaseAuth);
      router.replace("/");
      return;
    }

    const session = await multiFactor(user).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    setTotpSecret({ secret, account: user.email || eligibility.email });
  }

  async function submitCredentials(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await setPersistence(firebaseAuth, inMemoryPersistence);
      const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await finishAdminSignIn(result.user);
    } catch (signInError) {
      if (signInError.code === "auth/multi-factor-auth-required") {
        try {
          setFactorResolver(getMultiFactorResolver(firebaseAuth, signInError));
          setFactorCode("");
        } catch {
          setError("Could not start the authenticator challenge. Try signing in again.");
        }
      } else {
        await signOut(firebaseAuth).catch(() => {});
        setPassword("");
        setError(signInMessage(signInError));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifySecondFactor(event) {
    event.preventDefault();
    if (!factorResolver) return;
    const totpHint = factorResolver.hints.find((hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (!totpHint) {
      setError("This account uses an unsupported second factor. Configure an authenticator app for this admin account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, factorCode.trim());
      const result = await factorResolver.resolveSignIn(assertion);
      setFactorResolver(null);
      await finishAdminSignIn(result.user);
    } catch (factorError) {
      setError(factorError.message || "The authenticator code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function enrollSecondFactor(event) {
    event.preventDefault();
    if (!totpSecret || !firebaseAuth.currentUser) return;
    setBusy(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret.secret, enrollmentCode.trim());
      await multiFactor(firebaseAuth.currentUser).enroll(assertion, "CricXii Admin");
      await signOut(firebaseAuth);
      setTotpSecret(null);
      setEnrollmentCode("");
      setPassword("");
      setNotice("Authenticator enabled. Sign in again with your password and its 6-digit code.");
    } catch (enrollmentError) {
      setError(signInMessage(enrollmentError));
    } finally {
      setBusy(false);
    }
  }

  async function cancelMfaSetup() {
    await signOut(firebaseAuth).catch(() => {});
    setTotpSecret(null);
    setEnrollmentCode("");
    setPassword("");
    setError("");
  }

  return <main className="login-page">
    <section className="login-card">
      <Link className="brand login-brand" href="/"><span className="brand-mark">C<span>.</span></span><span className="brand-copy"><strong>cricxii</strong><small>ADMIN CONSOLE</small></span></Link>
      <div className="login-heading"><span className="login-shield"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></svg></span><h1>{totpSecret ? "Set up authenticator" : factorResolver ? "Verify it’s you" : "Admin sign in"}</h1><p>{totpSecret ? "Add this account to your authenticator app, then enter the current 6-digit code." : factorResolver ? "Enter the current 6-digit code from your admin authenticator app." : "Use the email and password for your separately provisioned Firebase admin account."}</p></div>
      {error && <div className="login-error" role="alert">{error}</div>}
      {notice && <div className="login-notice" role="status">{notice}</div>}
      {totpSecret ? <form className="mfa-form" onSubmit={enrollSecondFactor}><strong>Authenticator setup key</strong><code>{totpSecret.secret.secretKey}</code><p>Enter this key manually in an authenticator app for {totpSecret.account}. The console does not save this secret.</p><label>6-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={enrollmentCode} onChange={(event) => setEnrollmentCode(event.target.value)} required /></label><button className="auth-submit login-submit" disabled={busy || enrollmentCode.length !== 6}>{busy ? "Enabling authenticator…" : "Enable authenticator"}</button><button className="login-cancel" type="button" onClick={cancelMfaSetup} disabled={busy}>Cancel setup</button></form>
        : factorResolver ? <form className="mfa-form" onSubmit={verifySecondFactor}><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={factorCode} onChange={(event) => setFactorCode(event.target.value)} required autoFocus /></label><button className="auth-submit login-submit" disabled={busy || factorCode.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button><button className="login-cancel" type="button" onClick={() => { setFactorResolver(null); setFactorCode(""); }} disabled={busy}>Back to sign in</button></form>
          : <form className="credentials-form" onSubmit={submitCredentials}><label>Email address<input type="email" name="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="auth-submit login-submit" type="submit" disabled={busy}>{busy ? <><span className="loading-spinner" /> Verifying account…</> : "Sign in securely"}</button></form>}
      <div className="login-security"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span>Only the allowlisted Firebase admin account with a role and authenticator can continue.</span></div>
      <p className="login-help">CricXii player account passwords are not admin credentials.</p>
    </section>
  </main>;
}

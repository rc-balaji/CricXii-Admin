"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMultiFactorResolver,
  GoogleAuthProvider,
  multiFactor,
  signInWithPopup,
  signOut,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase/client";

export default function AdminLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      router.replace("/");
      return;
    }

    const session = await multiFactor(user).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    setTotpSecret({ secret, account: user.email || eligibility.email });
  }

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      await finishAdminSignIn(result.user);
    } catch (signInError) {
      if (signInError.code === "auth/multi-factor-auth-required") {
        try {
          setFactorResolver(getMultiFactorResolver(firebaseAuth, signInError));
        } catch {
          setError("Could not start the MFA challenge. Try signing in again.");
        }
      } else {
        await signOut(firebaseAuth).catch(() => {});
        setError(signInError.message || "Administrator sign-in failed.");
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
      setError("This account uses an unsupported second factor. Configure a TOTP authenticator for this admin account.");
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
    if (!totpSecret) return;
    setBusy(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret.secret, enrollmentCode.trim());
      await multiFactor(firebaseAuth.currentUser).enroll(assertion, "CricXii Admin");
      const idToken = await firebaseAuth.currentUser.getIdToken(true);
      await postJson("/api/admin/session", { idToken });
      router.replace("/");
    } catch (enrollmentError) {
      setError(enrollmentError.message || "Could not enroll the authenticator. Verify the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <section className="login-card">
      <Link className="brand login-brand" href="/"><span className="brand-mark">C<span>.</span></span><span className="brand-copy"><strong>cricxii</strong><small>ADMIN CONSOLE</small></span></Link>
      <div className="login-heading"><span className="login-shield"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></svg></span><h1>Admin sign in</h1><p>Sign in with your separately provisioned Firebase administrator account.</p></div>
      {error && <div className="login-error" role="alert">{error}</div>}
      {totpSecret ? <form className="mfa-form" onSubmit={enrollSecondFactor}><strong>Set up your authenticator</strong><p>Add this key to an authenticator app, then enter the current 6-digit code. This secret is shown once and is not saved by the console.</p><code>{totpSecret.secret.secretKey}</code><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={enrollmentCode} onChange={(event) => setEnrollmentCode(event.target.value)} required /></label><button className="google-signin" disabled={busy || enrollmentCode.length !== 6}>{busy ? "Verifying…" : "Enable MFA and continue"}</button></form>
        : factorResolver ? <form className="mfa-form" onSubmit={verifySecondFactor}><strong>Verify your identity</strong><p>Enter the current 6-digit code from your admin authenticator app.</p><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={factorCode} onChange={(event) => setFactorCode(event.target.value)} required /></label><button className="google-signin" disabled={busy || factorCode.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button></form>
          : <button className="google-signin" onClick={signIn} disabled={busy}>{busy ? <span className="loading-spinner" /> : <GoogleIcon />}<span>{busy ? "Verifying administrator access…" : "Continue with Google"}</span></button>}
      <div className="login-security"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span>Only allowlisted Firebase admin accounts with a role and MFA can continue.</span></div>
      <p className="login-help">Player app email and password are not admin credentials.</p>
    </section>
  </main>;
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6c4.51-4.17 7.06-10.31 7.06-17.65Z" /><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.93 7.56 2.56 10.78l7.97-6.19Z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>;
}

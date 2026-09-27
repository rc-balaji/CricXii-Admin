"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase/client";

const PAGE_SIZE = 10;

const icons = {
  users: <><path d="M16 20v-1.7a4.3 4.3 0 0 0-4.3-4.3H6.3A4.3 4.3 0 0 0 2 18.3V20" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-1.7a4.3 4.3 0 0 0-3-4.1M16 3.2a4 4 0 0 1 0 7.6" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  down: <path d="m7 10 5 5 5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12h14V8m-9 4h4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
};

function Icon({ name, size = 17, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function playerView(item) {
  const matches = (item.stats?.matches || 0) + (item.teamStats?.matches || 0);
  return {
    ...item,
    email: item.accountEmail || "Email hidden",
    gang: item.gangId || "—",
    matches,
    runs: (item.stats?.runs || 0) + (item.teamStats?.runs || 0),
    wickets: (item.stats?.wickets || 0) + (item.teamStats?.wickets || 0),
    points: (item.stats?.points || 0) + (item.teamStats?.points || 0),
    joinedAt: item.joinedAt || null,
    color: "mint",
    avatar: (item.name || item.playerId).slice(0, 2).toUpperCase(),
    battingStyle: item.battingStyle || "—",
    bowlingStyle: item.bowlingStyles?.join(", ") || item.customBowlingStyle || "—",
  };
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || "The request could not be completed.");
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body?.data;
}

function inferSearchType(value) {
  if (value.includes("@")) return "email";
  if (/^CX-[A-Za-z0-9_-]+$/i.test(value)) return "playerId";
  return "namePrefix";
}

export default function AdminConsole() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [pages, setPages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [section, setSection] = useState("Players");
  const [audit, setAudit] = useState([]);
  const [auditFilters, setAuditFilters] = useState({ operator: "", targetPlayer: "", action: "", from: "", to: "" });
  const [auditNextCursor, setAuditNextCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const loadPlayers = useCallback(async (nextQuery = query, nextStatus = status) => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), status: nextStatus });
      if (nextQuery) {
        params.set("q", nextQuery);
        params.set("qType", inferSearchType(nextQuery));
      }
      const result = await requestJson(`/api/admin/players?${params}`);
      const items = (result.items || []).map(playerView);
      setPlayers(items);
      setPages([{ items, cursor: result.nextCursor }]);
      setPage(0);
      setCursor(result.nextCursor);
    } catch (loadError) {
      if (loadError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  }, [query, status, router]);

  useEffect(() => {
    let active = true;
    requestJson("/api/admin/session").then((result) => {
      if (!active) return;
      if (!result.authenticated) {
        router.replace("/login");
        return;
      }
      setSession(result);
      loadPlayers("", "all");
    }).catch((sessionError) => {
      if (!active) return;
      if (sessionError.status === 401 || sessionError.status === 403) {
        router.replace("/login");
        return;
      }
      setError(sessionError.message);
      setBusy(false);
    });
    return () => { active = false; };
  }, [router, loadPlayers]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function openPlayer(item) {
    setBusy(true);
    setError("");
    try {
      const data = await requestJson(`/api/admin/players/${encodeURIComponent(item.playerId)}`);
      setSelected(playerView(data));
      setEditing(false);
      setArchiveOpen(false);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadAudit(filters = auditFilters, nextCursor = null, append = false) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
      if (nextCursor) params.set("cursor", nextCursor);
      const result = await requestJson(`/api/admin/audit?${params}`);
      setAudit((previous) => append ? [...previous, ...(result.items || [])] : result.items || []);
      setAuditNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  }

  function changeSection(next) {
    setSection(next);
    setMobileNav(false);
    if (next === "Audit log") loadAudit();
    else if (next === "Players") loadPlayers();
  }

  async function nextPage() {
    if (page + 1 < pages.length) {
      setPage(page + 1);
      return;
    }
    if (!cursor) return;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), status, cursor });
      if (query) {
        params.set("q", query);
        params.set("qType", inferSearchType(query));
      }
      const result = await requestJson(`/api/admin/players?${params}`);
      const items = (result.items || []).map(playerView);
      setPages((previous) => [...previous, { items, cursor: result.nextCursor }]);
      setPage((previous) => previous + 1);
      setCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSearch(event) {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    setQuery(nextQuery);
    await loadPlayers(nextQuery, status);
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (!selected || !form) return;
    setSaving(true);
    setError("");
    try {
      const originalStyles = selected.bowlingStyles || [];
      const styles = form.bowlingStyles.split(",").map((value) => value.trim()).filter(Boolean);
      const changes = {};
      for (const field of ["name", "bio", "battingStyle", "customBowlingStyle"]) {
        if (form[field] !== (selected[field] || "")) changes[field] = form[field];
      }
      if (styles.join("|") !== originalStyles.join("|")) changes.bowlingStyles = styles;
      if (!Object.keys(changes).length) {
        setToast("No profile fields changed.");
        setEditing(false);
        return;
      }
      await requestJson(`/api/admin/players/${encodeURIComponent(selected.playerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes, reason, expectedUpdatedAt: selected.updatedAt || "missing" }),
      });
      setToast("Profile updated.");
      setSelected(null);
      setEditing(false);
      await loadPlayers();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitArchive() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const result = await requestJson(`/api/admin/players/${encodeURIComponent(selected.playerId)}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archived: !selected.archived,
          reason: archiveReason,
          expectedUpdatedAt: selected.updatedAt || "missing",
        }),
      });
      setToast(result.archived ? "Player archived." : "Player restored.");
      setSelected(null);
      setArchiveOpen(false);
      await loadPlayers();
    } catch (archiveError) {
      setError(archiveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
      await signOut(firebaseAuth);
    } finally {
      router.replace("/login");
    }
  }

  const visiblePlayers = pages[page]?.items || [];
  if (!session && !error) return <div className="auth-loading"><span className="loading-spinner" /><span>Checking administrator session…</span></div>;

  return <div className="app-shell">
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); changeSection("Players"); }}><span className="brand-mark">C<span>.</span></span><span className="brand-copy"><strong>cricxii</strong><small>ADMIN CONSOLE</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace-switch workspace-static"><span className="workspace-avatar">C</span><span><strong>CricXii Club</strong><small>Firebase · crixx-59eca</small></span></div>
      <div className="nav-label">MENU</div>
      <nav className="main-nav" aria-label="Main navigation">
        {[["Players", "users"], ["Audit log", "file"]].map(([name, icon]) => <button key={name} className={`nav-link ${section === name ? "nav-link-active" : ""}`} onClick={() => changeSection(name)}><Icon name={icon} /><span>{name}</span>{name === "Players" && <span className="nav-count">{players.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="security-card"><span className="security-icon"><Icon name="shield" /></span><strong>Secure admin session</strong><p>Player access is checked on the server for every request.</p><span className="security-link"><Icon name="lock" size={13} /> Role: {session?.role || "checking"}</span></div><button className="profile-mini" onClick={logout}><span className="profile-avatar">{(session?.email || "AD").slice(0, 2).toUpperCase()}</span><span className="profile-copy"><strong>{session?.email || "Administrator"}</strong><small>Sign out</small></span><Icon name="logout" size={17} /></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Icon name="menu" size={20} /></button><div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{section}</strong></div><div className="topbar-actions"><span className="local-pill"><span /> FIREBASE LIVE</span><span className="topbar-divider" /><button className="topbar-user" onClick={logout}><span className="top-avatar">{(session?.email || "AD").slice(0, 2).toUpperCase()}</span><span className="user-name">{session?.email}</span><Icon name="logout" size={15} /></button></div></header>
      <div className="page-content">
        <div className="preview-banner"><span className="preview-dot" /><div><strong>Authenticated Firebase admin</strong><span>Live Firestore player records · reads and changes are handled by protected server APIs.</span></div></div>
        {error && <div className="api-error" role="alert"><Icon name="shield" size={17} /><span>{error}</span><button onClick={() => { setError(""); if (section === "Audit log") loadAudit(); else loadPlayers(); }}>Retry</button></div>}

        {section === "Audit log" ? <section>
          <div className="page-heading"><div><div className="eyebrow">SECURITY &amp; COMPLIANCE <span className="eyebrow-line" /></div><h1>Audit log</h1><p>Read-only record of administrator actions.</p></div><span className="audit-readonly"><Icon name="lock" size={14} /> Owner access</span></div>
          <section className="panel audit-page-panel"><form className="audit-filter-row live-audit-filters" onSubmit={(event) => { event.preventDefault(); loadAudit(auditFilters); }}><input aria-label="Filter by operator email" placeholder="Operator email" value={auditFilters.operator} onChange={(event) => setAuditFilters({ ...auditFilters, operator: event.target.value })} /><input aria-label="Filter by player ID" placeholder="Player ID" value={auditFilters.targetPlayer} onChange={(event) => setAuditFilters({ ...auditFilters, targetPlayer: event.target.value })} /><input aria-label="Filter by action" placeholder="Action" value={auditFilters.action} onChange={(event) => setAuditFilters({ ...auditFilters, action: event.target.value })} /><input aria-label="From date" type="date" value={auditFilters.from} onChange={(event) => setAuditFilters({ ...auditFilters, from: event.target.value })} /><input aria-label="To date" type="date" value={auditFilters.to} onChange={(event) => setAuditFilters({ ...auditFilters, to: event.target.value })} /><button className="button button-secondary" type="submit">Filter</button></form><div className="audit-page-list">{audit.map((event) => <div className="audit-row" key={event.id}><span className="audit-event-icon audit-view"><Icon name="file" size={16} /></span><span className="audit-event-copy"><strong>{event.action}</strong><small>{event.targetId} · {event.actorEmail} · {event.reason || event.actorRole}</small></span><span className="audit-event-time"><Icon name="clock" size={13} />{dateLabel(event.createdAt)}</span></div>)}{!busy && !audit.length && <div className="empty-state"><strong>No audit events found</strong><p>Server-recorded admin activity will appear here.</p></div>}</div>{auditNextCursor && <div className="audit-load-more"><button className="button button-secondary" disabled={busy} onClick={() => loadAudit(auditFilters, auditNextCursor, true)}>Load more audit events</button></div>}</section>
        </section> : <>
          <div className="page-heading players-heading"><div><div className="eyebrow">FIRESTORE DIRECTORY <span className="eyebrow-line" /></div><h1>Players <span className="heading-count">{players.length}</span></h1><p>Live profiles from your Firebase project. Search by name, player ID or account email.</p></div><button className="button button-secondary" onClick={() => loadPlayers()}><Icon name="users" size={16} /> Refresh</button></div>
          <div className="player-summary-strip"><div><span className="summary-dot active-dot" /><strong>{players.filter((item) => !item.archived).length}</strong><span>Active in this page</span></div><i /><div><span className="summary-dot archived-dot" /><strong>{players.filter((item) => item.archived).length}</strong><span>Archived in this page</span></div></div>
          <section className="panel players-panel">
            <div className="players-toolbar"><form className="search-box live-search" onSubmit={submitSearch}><Icon name="search" size={18} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, player ID, or email…" aria-label="Search Firestore players" /><button type="submit" className="search-submit">Search</button></form><div className="toolbar-filters"><label className="filter-select"><span className="sr-only">Filter player status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setQuery(searchInput.trim()); loadPlayers(searchInput.trim(), event.target.value); }}><option value="all">All players</option><option value="active">Active</option><option value="archived">Archived</option></select><Icon name="down" size={15} /></label></div></div>
            <div className="table-wrap"><table className="players-table"><thead><tr><th className="player-th">PLAYER</th><th>PLAYER ID</th><th>GANG ID</th><th>MATCHES</th><th>JOINED</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {visiblePlayers.map((player) => <tr key={player.playerId} onClick={() => openPlayer(player)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") openPlayer(player); }}><td><div className="player-cell"><span className="avatar avatar-mint">{player.avatar}</span><span><strong>{player.name || "Unnamed player"}</strong><small>{player.email}</small></span></div></td><td><span className="id-code">{player.playerId}</span></td><td><span className={`gang-label ${player.gang === "—" ? "gang-none" : ""}`}><i />{player.gang}</span></td><td className="match-count">{player.matches}<span> matches</span></td><td className="date-cell">{dateLabel(player.joinedAt)}</td><td><span className={`status-badge ${player.archived ? "status-archived" : "status-active"}`}><i />{player.archived ? "Archived" : "Active"}</span></td><td><button className="row-more" aria-label={`Open ${player.name} profile`} onClick={(event) => { event.stopPropagation(); openPlayer(player); }}><Icon name="chevron" size={17} /></button></td></tr>)}
              {!busy && !visiblePlayers.length && <tr><td colSpan="7"><div className="empty-state"><span className="empty-icon"><Icon name="search" size={21} /></span><strong>{error ? "Player data could not be loaded" : "No players found"}</strong><p>{error || "Try a different search or status filter."}</p></div></td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>Page <strong>{page + 1}</strong>{cursor ? " · More records available" : " · End of results"}</span><div className="pagination"><button aria-label="Previous page" disabled={page === 0 || busy} onClick={() => setPage((previous) => previous - 1)}><Icon name="chevron" size={15} className="chevron-left" /></button><button aria-label="Next page" disabled={busy || (!cursor && page + 1 >= pages.length)} onClick={nextPage}><Icon name="chevron" size={15} /></button></div></div>
          </section>
          <p className="privacy-footnote"><Icon name="lock" size={13} /> Firebase Admin SDK access stays on the server. Profile reads and mutations are audited.</p>
        </>}
      </div>
    </main>

    {selected && <div className="drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="player-drawer" role="dialog" aria-modal="true" aria-label={`${selected.name} profile`}>
      <div className="drawer-topline"><span><Icon name="users" size={15} /> FIRESTORE PLAYER PROFILE</span><button className="icon-button" aria-label="Close profile" onClick={() => setSelected(null)}><Icon name="close" size={19} /></button></div>
      <div className="drawer-profile"><span className="avatar avatar-mint avatar-large">{selected.avatar}</span><div><h2>{selected.name || "Unnamed player"}</h2><span className="drawer-player-id">{selected.playerId}</span></div><span className={`status-badge ${selected.archived ? "status-archived" : "status-active"}`}><i />{selected.archived ? "Archived" : "Active"}</span></div>
      <div className="drawer-tabs"><button className="drawer-tab-active">Overview</button><button onClick={() => setToast("Related match details are not exposed by this first-release API.")}>Activity</button></div>
      <div className="drawer-content">{editing ? <form className="edit-form" onSubmit={submitEdit}><div className="form-heading"><h3>Edit profile</h3><p>Only approved public profile fields can be changed.</p></div><label>Display name<input maxLength="60" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Bio<textarea maxLength="500" rows="3" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label><label>Batting style<select value={form.battingStyle} onChange={(event) => setForm({ ...form, battingStyle: event.target.value })}><option>Right hand</option><option>Left hand</option></select></label><label>Bowling styles, comma separated<input maxLength="120" value={form.bowlingStyles} onChange={(event) => setForm({ ...form, bowlingStyles: event.target.value })} placeholder="Right arm fast" /></label><label>Custom bowling style<input maxLength="60" value={form.customBowlingStyle} onChange={(event) => setForm({ ...form, customBowlingStyle: event.target.value })} /></label><label>Reason for change <span className="required-mark">*</span><textarea rows="2" maxLength="300" placeholder="Why is this profile being updated?" value={reason} onChange={(event) => setReason(event.target.value)} required minLength="5" /></label><div className="drawer-actions"><button type="button" className="button button-secondary" onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving || !reason.trim()}>{saving ? "Saving…" : "Save changes"}</button></div></form> : <>
        <div className="drawer-section-title"><h3>Player details</h3>{session?.role !== "support" && <button className="edit-text-button" onClick={() => { setForm({ name: selected.name || "", bio: selected.bio || "", battingStyle: selected.battingStyle === "—" ? "Right hand" : selected.battingStyle, bowlingStyles: (selected.bowlingStyles || []).join(", "), customBowlingStyle: selected.customBowlingStyle || "" }); setReason(""); setEditing(true); }}><Icon name="edit" size={14} /> Edit</button>}</div>
        <div className="detail-list"><DetailRow label="Member since" value={dateLabel(selected.joinedAt)} /><DetailRow label="Gang ID" value={selected.gang || "—"} /><DetailRow label="Batting style" value={selected.battingStyle} /><DetailRow label="Bowling style" value={selected.bowlingStyle} /><DetailRow label="Updated" value={dateLabel(selected.updatedAt)} /></div>
        <div className="bio-card"><span>ABOUT</span><p>{selected.bio || "No bio added."}</p></div>
        <div className="drawer-section-title stats-title"><h3>Career stats</h3><span>READ ONLY</span></div>
        <div className="career-stats"><div><span>Matches</span><strong>{selected.matches}</strong></div><div><span>Runs</span><strong>{selected.runs}</strong></div><div><span>Wickets</span><strong>{selected.wickets}</strong></div><div><span>Points</span><strong>{selected.points.toLocaleString()}</strong></div></div>
        {session?.role !== "support" && <div className="archive-zone"><div><strong>{selected.archived ? "Restore this player" : "Archive this player"}</strong><p>Reason required; match history is retained.</p></div><button className="archive-action" onClick={() => { setArchiveReason(""); setArchiveOpen(true); }}>{selected.archived ? "Restore" : "Archive"}</button></div>}
        {archiveOpen && <div className="archive-confirm"><strong>{selected.archived ? "Restore" : "Archive"} {selected.name}?</strong><label>Reason <span className="required-mark">*</span><textarea rows="2" maxLength="300" minLength="5" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></label><div><button className="button button-secondary" onClick={() => setArchiveOpen(false)}>Cancel</button><button className="button button-primary" disabled={saving || archiveReason.trim().length < 5} onClick={submitArchive}>Confirm</button></div></div>}
        <div className="delete-disabled"><Icon name="lock" size={15} /><span><strong>Permanent deletion disabled</strong><small>Requires owner-only dependency review and a separate deletion job.</small></span></div>
      </>}</div>
      {!editing && <div className="drawer-footer"><span><Icon name="shield" size={14} /> Server-audited profile read</span><button className="button button-secondary" onClick={() => setSelected(null)}>Done</button></div>}
    </aside></div>}
    {busy && <div className="busy-indicator"><span className="loading-spinner" /> Loading Firebase data…</div>}
    {toast && <div role="status" className="toast"><span className="toast-check">✓</span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><Icon name="close" size={15} /></button></div>}
  </div>;
}

function DetailRow({ label, value }) {
  return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>;
}

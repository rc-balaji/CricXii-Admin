"use client";

import { useEffect, useMemo, useState } from "react";
import { firebaseApp } from "../../lib/firebase/client";

const STORAGE_KEY = "cricxii-admin-demo-v1";
const PAGE_SIZE = 5;
const firebaseProjectId = firebaseApp.options.projectId;

const initialPlayers = [
  { playerId: "CX-10482", name: "Arjun Mehta", email: "arjun.m@example.com", joinedAt: "2025-09-14", battingStyle: "Right hand", bowlingStyle: "Right arm medium", gang: "Chennai Kings", matches: 42, runs: 684, wickets: 18, points: 1280, archived: false, avatar: "AM", color: "mint", bio: "Top-order batter who loves a close finish." },
  { playerId: "CX-10479", name: "Priya Nair", email: "priya.n@example.com", joinedAt: "2025-09-12", battingStyle: "Left hand", bowlingStyle: "Right arm off break", gang: "Madurai Mavericks", matches: 36, runs: 512, wickets: 9, points: 1045, archived: false, avatar: "PN", color: "lavender", bio: "All-rounder and proud Madurai Maverick." },
  { playerId: "CX-10473", name: "Karthik Raj", email: "karthik.r@example.com", joinedAt: "2025-09-10", battingStyle: "Right hand", bowlingStyle: "Right arm fast", gang: "Chennai Kings", matches: 28, runs: 396, wickets: 24, points: 972, archived: false, avatar: "KR", color: "peach", bio: "Fast bowler. Here for the big moments." },
  { playerId: "CX-10468", name: "Ananya Iyer", email: "ananya.i@example.com", joinedAt: "2025-09-08", battingStyle: "Right hand", bowlingStyle: "Left arm orthodox", gang: "Coimbatore Strikers", matches: 31, runs: 748, wickets: 12, points: 1548, archived: false, avatar: "AI", color: "sky", bio: "Opening batter with a soft spot for cover drives." },
  { playerId: "CX-10461", name: "Vikram Kumar", email: "vikram.k@example.com", joinedAt: "2025-09-04", battingStyle: "Left hand", bowlingStyle: "Right arm leg break", gang: "Salem Superstars", matches: 19, runs: 221, wickets: 16, points: 685, archived: false, avatar: "VK", color: "yellow", bio: "Leg-spinner, teammate and weekend cricketer." },
  { playerId: "CX-10452", name: "Meera Suresh", email: "meera.s@example.com", joinedAt: "2025-08-29", battingStyle: "Right hand", bowlingStyle: "Right arm medium", gang: "Madurai Mavericks", matches: 23, runs: 318, wickets: 14, points: 801, archived: false, avatar: "MS", color: "rose", bio: "Enjoys good cricket and even better company." },
  { playerId: "CX-10441", name: "Rahul Dev", email: "rahul.d@example.com", joinedAt: "2025-08-22", battingStyle: "Right hand", bowlingStyle: "Right arm fast", gang: "—", matches: 12, runs: 146, wickets: 7, points: 390, archived: true, avatar: "RD", color: "sky", bio: "A familiar face from the early CricXii days." },
  { playerId: "CX-10430", name: "Divya Ramesh", email: "divya.r@example.com", joinedAt: "2025-08-17", battingStyle: "Left hand", bowlingStyle: "Right arm off break", gang: "Coimbatore Strikers", matches: 16, runs: 203, wickets: 11, points: 592, archived: false, avatar: "DR", color: "lavender", bio: "All about the team spirit." },
];

const initialAudit = [
  { id: "a1", action: "Player profile viewed", detail: "Arjun Mehta · CX-10482", when: "Just now", kind: "view" },
  { id: "a2", action: "Profile updated", detail: "Priya Nair · Bio changed", when: "18 min ago", kind: "edit" },
  { id: "a3", action: "Player restored", detail: "Vikram Kumar · CX-10461", when: "Yesterday", kind: "restore" },
  { id: "a4", action: "Player archived", detail: "Rahul Dev · CX-10441", when: "Yesterday", kind: "archive" },
];

const iconPaths = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>,
  users: <><path d="M16 20v-1.7a4.3 4.3 0 0 0-4.3-4.3H6.3A4.3 4.3 0 0 0 2 18.3V20" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-1.7a4.3 4.3 0 0 0-3-4.1M16 3.2a4 4 0 0 1 0 7.6" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  down: <path d="m7 10 5 5 5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12h14V8m-9 4h4" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
};

function Icon({ name, size = 18, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function Avatar({ player, size = "normal" }) {
  return <span className={`avatar avatar-${player.color} avatar-${size}`}>{player.avatar}</span>;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function recordAudit(audit, action, detail, kind) {
  return [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, detail, when: "Just now", kind }, ...audit].slice(0, 40);
}

function isSavedPreview(value) {
  const colors = ["mint", "lavender", "peach", "sky", "yellow", "rose"];
  const kinds = ["view", "edit", "restore", "archive"];
  return value && typeof value === "object"
    && Array.isArray(value.players)
    && value.players.every((player) => player && typeof player.playerId === "string"
      && typeof player.name === "string" && typeof player.email === "string"
      && typeof player.joinedAt === "string" && typeof player.battingStyle === "string"
      && typeof player.bowlingStyle === "string" && typeof player.gang === "string"
      && typeof player.bio === "string" && typeof player.avatar === "string"
      && colors.includes(player.color) && typeof player.archived === "boolean"
      && ["matches", "runs", "wickets", "points"].every((field) => Number.isFinite(player[field])))
    && Array.isArray(value.audit)
    && value.audit.every((event) => event && typeof event.id === "string"
      && typeof event.action === "string" && typeof event.detail === "string"
      && typeof event.when === "string" && kinds.includes(event.kind))
    && (value.persist === undefined || typeof value.persist === "boolean");
}

export default function AdminDashboard() {
  const [players, setPlayers] = useState(initialPlayers);
  const [audit, setAudit] = useState(initialAudit);
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState("Overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All players");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [persist, setPersist] = useState(true);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ name: "", bio: "", battingStyle: "", bowlingStyle: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (!isSavedPreview(parsed)) throw new Error("Invalid saved preview.");
          setPlayers(parsed.players);
          setAudit(parsed.audit);
          if (typeof parsed.persist === "boolean") setPersist(parsed.persist);
        }
      } catch {
        setToast("Could not read saved demo data from this browser.");
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (persist) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, audit, persist }));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      window.setTimeout(() => setToast("Local save failed. Check browser storage space or permissions."), 0);
    }
  }, [players, audit, persist, loaded]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredPlayers = useMemo(() => players.filter((player) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [player.name, player.email, player.playerId, player.gang].some((value) => value.toLowerCase().includes(query));
    const matchesFilter = filter === "All players" || (filter === "Active" && !player.archived) || (filter === "Archived" && player.archived);
    return matchesSearch && matchesFilter;
  }), [players, search, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const visiblePlayers = filteredPlayers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeCount = players.filter((player) => !player.archived).length;
  const totalMatches = players.reduce((sum, player) => sum + player.matches, 0);
  const selectedPlayer = selected ? players.find((player) => player.playerId === selected.playerId) ?? selected : null;

  function openPlayer(player) {
    setSelected(player);
    setEditing(false);
    setReason("");
    setAudit((items) => recordAudit(items, "Player profile viewed", `${player.name} · ${player.playerId}`, "view"));
  }

  function beginEdit() {
    setForm({ name: selectedPlayer.name, bio: selectedPlayer.bio, battingStyle: selectedPlayer.battingStyle, bowlingStyle: selectedPlayer.bowlingStyle });
    setReason("");
    setEditing(true);
  }

  function savePlayer(event) {
    event.preventDefault();
    if (!reason.trim()) {
      setToast("Add an audit reason before saving profile changes.");
      return;
    }
    if (!form.name.trim()) {
      setToast("Player name is required.");
      return;
    }
    setPlayers((items) => items.map((player) => player.playerId === selectedPlayer.playerId ? { ...player, ...form, name: form.name.trim(), bio: form.bio.trim() } : player));
    setAudit((items) => recordAudit(items, "Profile updated", `${selectedPlayer.name} · ${reason.trim()}`, "edit"));
    setSelected((player) => ({ ...player, ...form, name: form.name.trim(), bio: form.bio.trim() }));
    setEditing(false);
    setToast("Demo profile updated.");
  }

  function toggleArchive(player, archiveReason) {
    const nextArchived = !player.archived;
    const action = nextArchived ? "Player archived" : "Player restored";
    setPlayers((items) => items.map((item) => item.playerId === player.playerId ? { ...item, archived: nextArchived } : item));
    setAudit((items) => recordAudit(items, action, `${player.name} · ${player.playerId} · ${archiveReason}`, nextArchived ? "archive" : "restore"));
    setSelected((current) => current?.playerId === player.playerId ? { ...current, archived: nextArchived } : current);
    setToast(nextArchived ? "Player archived in this local demo." : "Player restored in this local demo.");
  }

  function resetDemo() {
    setPlayers(initialPlayers);
    setAudit(initialAudit);
    setSearch("");
    setFilter("All players");
    setPage(1);
    setSelected(null);
    setToast("Demo data has been reset.");
  }

  const navItems = [
    { name: "Overview", icon: "grid" },
    { name: "Players", icon: "users", count: players.length },
    { name: "Audit log", icon: "file" },
  ];

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection("Overview"); }}>
          <span className="brand-mark">C<span>.</span></span>
          <span className="brand-copy"><strong>cricxii</strong><small>ADMIN CONSOLE</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch"><span className="workspace-avatar">C</span><span><strong>CricXii Club</strong><small>Local preview</small></span><Icon name="down" size={15} /></button>
        <div className="nav-label">MENU</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.name} className={`nav-link ${section === item.name ? "nav-link-active" : ""}`} onClick={() => { setSection(item.name); setMobileNav(false); setPage(1); }}>
              <Icon name={item.icon} size={18} /><span>{item.name}</span>{item.count && <span className="nav-count">{item.count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <span className="security-icon"><Icon name="shield" size={17} /></span>
            <strong>Secure by design</strong>
            <p>Admin access is not connected in this preview.</p>
            <span className="security-link"><Icon name="lock" size={13} /> Server auth required</span>
          </div>
          <button className="profile-mini" onClick={() => setToast("Production administrator sign-in is not configured yet.")}>
            <span className="profile-avatar">AD</span><span className="profile-copy"><strong>Admin preview</strong><small>Local workspace</small></span><Icon name="dots" size={18} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Icon name="menu" size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{section}</strong></div>
          <div className="topbar-actions">
            <span className="local-pill"><span /> FIREBASE SDK READY</span>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast("No new notifications.")}><Icon name="bell" size={19} /><i /></button>
            <span className="topbar-divider" />
            <button className="topbar-user" onClick={() => setToast("Admin sign-in will be enabled after Firebase is configured.")}><span className="top-avatar">AD</span><span className="user-name">Admin</span><Icon name="down" size={14} /></button>
          </div>
        </header>

        <div className="page-content">
          <div className="preview-banner"><span className="preview-dot" /><div><strong>Firebase project configured</strong><span>Client SDK initialized for {firebaseProjectId}. Sample data only — secure admin sign-in and server APIs are not connected.</span></div><button onClick={() => setToast("Set up Firebase Admin, custom admin claims, secure session cookies and server-side role-checked APIs before using production data.")}>Setup guide <Icon name="arrow" size={13} /></button></div>

          {section === "Audit log" ? (
            <AuditPage audit={audit} />
          ) : section === "Players" ? (
            <PlayersPage
              players={players}
              visiblePlayers={visiblePlayers}
              filteredPlayers={filteredPlayers}
              search={search}
              setSearch={(value) => { setSearch(value); setPage(1); }}
              filter={filter}
              setFilter={(value) => { setFilter(value); setPage(1); }}
              page={page}
              pageCount={pageCount}
              setPage={setPage}
              onOpen={openPlayer}
              onAdd={() => setToast("Adding real players is unavailable until the secure admin API is connected.")}
              onExport={() => {
                const csv = ["playerId,name,email,gang,matches,status", ...filteredPlayers.map((player) => [player.playerId, player.name, player.email, player.gang, player.matches, player.archived ? "Archived" : "Active"].map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))].join("\n");
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                link.download = "cricxii-demo-players.csv";
                link.click();
                URL.revokeObjectURL(link.href);
                setToast("Exported the current sample data.");
              }}
            />
          ) : (
            <OverviewPage
              activeCount={activeCount}
              totalCount={players.length}
              totalMatches={totalMatches}
              audit={audit}
              players={players}
              onPlayers={() => setSection("Players")}
              onAudit={() => setSection("Audit log")}
              onOpen={openPlayer}
              persist={persist}
              setPersist={setPersist}
              onReset={resetDemo}
              loaded={loaded}
            />
          )}
        </div>
      </main>

      {selectedPlayer && <PlayerDrawer player={selectedPlayer} editing={editing} form={form} setForm={setForm} reason={reason} setReason={setReason} onClose={() => { setSelected(null); setEditing(false); }} onEdit={beginEdit} onCancelEdit={() => setEditing(false)} onSave={savePlayer} onArchive={(archiveReason) => toggleArchive(selectedPlayer, archiveReason)} />}
      {toast && <div role="status" className="toast"><span className="toast-check">✓</span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><Icon name="close" size={15} /></button></div>}
    </div>
  );
}

function OverviewPage({ activeCount, totalCount, totalMatches, audit, players, onPlayers, onAudit, onOpen, persist, setPersist, onReset, loaded }) {
  const latestPlayers = [...players].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)).slice(0, 4);
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">SUNDAY, SEPTEMBER 27, 2026 <span className="eyebrow-line" /></div><h1>Good evening, Admin <span className="wave">✦</span></h1><p>Here&apos;s what&apos;s happening across your cricket community.</p></div>
      <button className="button button-primary" onClick={onPlayers}><Icon name="plus" size={17} /> Manage players</button>
    </div>
    <section className="stats-grid" aria-label="Player statistics">
      <StatCard title="Total players" value={totalCount.toLocaleString()} change="+12.8%" caption="vs. last month" icon="users" tone="green" />
      <StatCard title="Active players" value={activeCount.toLocaleString()} change="+8.2%" caption="vs. last month" icon="trend" tone="blue" />
      <StatCard title="Matches played" value={totalMatches.toLocaleString()} change="+18.4%" caption="vs. last month" icon="grid" tone="orange" />
      <StatCard title="Archived profiles" value={(totalCount - activeCount).toString()} change="Review" caption="restore anytime" icon="archive" tone="purple" quiet />
    </section>

    <section className="overview-grid">
      <div className="panel activity-panel">
        <div className="panel-heading"><div><h2>Community activity</h2><p>Player matches over the last 7 days</p></div><button className="select-button">This week <Icon name="down" size={14} /></button></div>
        <div className="chart-summary"><strong>{Math.round(totalMatches * 0.18)}</strong><span className="chart-change"><Icon name="trend" size={13} /> 18.4%</span><span className="chart-summary-label">matches this week</span></div>
        <div className="chart-area" aria-label="Bar chart showing community activity through the week">
          <div className="chart-y-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
          <div className="chart-bars">
            {[["Mon", 48], ["Tue", 67], ["Wed", 55], ["Thu", 82], ["Fri", 62], ["Sat", 100], ["Sun", 74]].map(([day, height], index) => <div className="chart-column" key={day}><div className="bar-rail"><span className={`chart-bar ${index === 5 ? "chart-bar-highlight" : ""}`} style={{ height: `${height}%` }} /></div><span className={`chart-day ${index === 5 ? "chart-day-active" : ""}`}>{day}</span></div>)}
          </div>
        </div>
      </div>
      <div className="panel audit-preview">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest admin actions</p></div><button className="text-link" onClick={onAudit}>View all <Icon name="chevron" size={14} /></button></div>
        <div className="audit-list">{audit.slice(0, 4).map((event) => <AuditRow key={event.id} event={event} compact />)}</div>
      </div>
    </section>

    <section className="panel new-players-panel">
      <div className="panel-heading"><div><h2>Recently joined</h2><p>Meet the latest members of your community</p></div><button className="text-link" onClick={onPlayers}>All players <Icon name="chevron" size={14} /></button></div>
      <div className="recent-players">
        {latestPlayers.map((player) => <button className="recent-player" key={player.playerId} onClick={() => onOpen(player)}><Avatar player={player} /><span className="recent-player-info"><strong>{player.name}</strong><small>{player.gang === "—" ? "Independent player" : player.gang}</small></span><span className="recent-player-date"><Icon name="calendar" size={14} />{formatDate(player.joinedAt)}</span><Icon name="chevron" size={15} className="recent-chevron" /></button>)}
      </div>
    </section>

    <section className="local-save-panel">
      <div className="local-save-icon"><Icon name="shield" size={19} /></div>
      <div className="local-save-copy"><strong>Save this preview on this device</strong><span>{persist ? "Your sample player edits and audit activity are saved in this browser only." : "Local saving is turned off. Changes will be cleared when you leave."}</span></div>
      <label className="switch-control"><input type="checkbox" checked={persist} onChange={(event) => setPersist(event.target.checked)} disabled={!loaded} /><span className="switch-track" /><span className="sr-only">Save demo data locally</span></label>
      <button className="reset-button" onClick={onReset}>Reset sample data</button>
    </section>
    <p className="privacy-footnote"><Icon name="lock" size={13} /> Local save stores sample data only — never passwords, tokens or production player data.</p>
  </>;
}

function StatCard({ title, value, change, caption, icon, tone, quiet = false }) {
  return <article className="stat-card"><div className="stat-card-top"><span>{title}</span><span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={17} /></span></div><div className="stat-value">{value}</div><div className="stat-foot"><span className={`stat-change ${quiet ? "stat-change-quiet" : ""}`}>{!quiet && <Icon name="trend" size={12} />}{change}</span><span>{caption}</span></div></article>;
}

function PlayersPage({ visiblePlayers, filteredPlayers, search, setSearch, filter, setFilter, page, pageCount, setPage, onOpen, onAdd, onExport }) {
  const firstResult = filteredPlayers.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(page * PAGE_SIZE, filteredPlayers.length);
  return <>
    <div className="page-heading players-heading"><div><div className="eyebrow">DIRECTORY <span className="eyebrow-line" /></div><h1>Players <span className="heading-count">{filteredPlayers.length}</span></h1><p>Search and manage player profiles across CricXii.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={onExport}><Icon name="download" size={16} /> Export</button><button className="button button-primary" onClick={onAdd}><Icon name="plus" size={17} /> Add player</button></div></div>
    <div className="player-summary-strip"><div><span className="summary-dot active-dot" /><strong>{filteredPlayers.filter((player) => !player.archived).length}</strong><span>Active</span></div><i /><div><span className="summary-dot archived-dot" /><strong>{filteredPlayers.filter((player) => player.archived).length}</strong><span>Archived</span></div><i /><div className="summary-all">{filteredPlayers.length} profiles shown</div></div>
    <section className="panel players-panel">
      <div className="players-toolbar"><div className="search-box"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email or player ID..." aria-label="Search players" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><Icon name="close" size={15} /></button>}<kbd>⌘ K</kbd></div><div className="toolbar-filters"><label className="filter-select"><span className="sr-only">Filter player status</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All players</option><option>Active</option><option>Archived</option></select><Icon name="down" size={15} /></label><button className="filter-button" onClick={onExport}><Icon name="download" size={16} /><span>Export</span></button></div></div>
      <div className="table-wrap"><table className="players-table"><thead><tr><th className="player-th">PLAYER</th><th>PLAYER ID</th><th>GANG</th><th>MATCHES</th><th>JOINED</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {visiblePlayers.map((player) => <tr key={player.playerId} onClick={() => onOpen(player)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(player); }}>
          <td><div className="player-cell"><Avatar player={player} /><span><strong>{player.name}</strong><small>{player.email}</small></span></div></td><td><span className="id-code">{player.playerId}</span></td><td><span className={`gang-label ${player.gang === "—" ? "gang-none" : ""}`}><i />{player.gang}</span></td><td className="match-count">{player.matches}<span> matches</span></td><td className="date-cell">{formatDate(player.joinedAt)}</td><td><span className={`status-badge ${player.archived ? "status-archived" : "status-active"}`}><i />{player.archived ? "Archived" : "Active"}</span></td><td><button className="row-more" aria-label={`View ${player.name}`} onClick={(event) => { event.stopPropagation(); onOpen(player); }}><Icon name="more" size={19} /></button></td>
        </tr>)}
        {!visiblePlayers.length && <tr><td colSpan="7"><div className="empty-state"><span className="empty-icon"><Icon name="search" size={21} /></span><strong>No players found</strong><p>Try another name, email, ID or status filter.</p><button onClick={() => { setSearch(""); setFilter("All players"); }}>Clear filters</button></div></td></tr>}
      </tbody></table></div>
      <div className="table-footer"><span>Showing <strong>{firstResult}–{lastResult}</strong> of <strong>{filteredPlayers.length}</strong> players</span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="chevron" size={15} className="chevron-left" /></button><span>Page <strong>{page}</strong> of <strong>{pageCount}</strong></span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(page + 1)}><Icon name="chevron" size={15} /></button></div></div>
    </section>
    <p className="privacy-footnote"><Icon name="lock" size={13} /> Read-only sample directory. Production search must use authenticated, paginated server APIs.</p>
  </>;
}

function AuditPage({ audit }) {
  const [query, setQuery] = useState("");
  const visibleAudit = audit.filter((event) => `${event.action} ${event.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="page-heading"><div><div className="eyebrow">SECURITY &amp; COMPLIANCE <span className="eyebrow-line" /></div><h1>Audit log</h1><p>A record of administrative activity in this local preview.</p></div><span className="audit-readonly"><Icon name="lock" size={14} /> Append-only preview</span></div>
    <div className="audit-info-banner"><Icon name="shield" size={19} /><div><strong>Audit records are read-only</strong><span>Production audit entries must be written and protected by the server. These sample events are stored locally on this device.</span></div></div>
    <section className="panel audit-page-panel"><div className="audit-filter-row"><div className="audit-search"><Icon name="search" size={17} /><input value={query} placeholder="Search activity..." aria-label="Search audit activity" onChange={(event) => setQuery(event.target.value)} /></div><button className="filter-button" onClick={() => window.print()}><Icon name="download" size={16} /> Export</button></div><div className="audit-page-list">{visibleAudit.map((event) => <div key={event.id}><AuditRow event={event} /></div>)}{visibleAudit.length === 0 && <div className="empty-state"><strong>No matching activity</strong><p>Try another search.</p></div>}</div></section>
  </>;
}

function AuditRow({ event, compact = false }) {
  const icon = event.kind === "edit" ? "edit" : event.kind === "archive" ? "archive" : event.kind === "restore" ? "users" : "eye";
  return <div className={`audit-row ${compact ? "audit-row-compact" : ""}`}><span className={`audit-event-icon audit-${event.kind}`}><Icon name={icon} size={16} /></span><span className="audit-event-copy"><strong>{event.action}</strong><small>{event.detail}</small></span><span className="audit-event-time"><Icon name="clock" size={13} />{event.when}</span></div>;
}

function PlayerDrawer({ player, editing, form, setForm, reason, setReason, onClose, onEdit, onCancelEdit, onSave, onArchive }) {
  const [tab, setTab] = useState("Overview");
  const [archivePrompt, setArchivePrompt] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");

  function confirmArchive() {
    if (!archiveReason.trim()) return;
    onArchive(archiveReason.trim());
    setArchivePrompt(false);
    setArchiveReason("");
  }

  return <div className="drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="player-drawer" role="dialog" aria-modal="true" aria-label={`${player.name} profile`}>
      <div className="drawer-topline"><span><Icon name="users" size={15} /> PLAYER PROFILE</span><button className="icon-button" aria-label="Close profile" onClick={onClose}><Icon name="close" size={19} /></button></div>
      <div className="drawer-profile"><Avatar player={player} size="large" /><div><h2>{player.name}</h2><span className="drawer-player-id">{player.playerId}</span></div><span className={`status-badge ${player.archived ? "status-archived" : "status-active"}`}><i />{player.archived ? "Archived" : "Active"}</span></div>
      <div className="drawer-tabs"><button className={tab === "Overview" ? "drawer-tab-active" : ""} onClick={() => setTab("Overview")}>Overview</button><button className={tab === "Activity" ? "drawer-tab-active" : ""} onClick={() => setTab("Activity")}>Activity</button></div>
      <div className="drawer-content">
        {editing ? <form className="edit-form" onSubmit={onSave}><div className="form-heading"><h3>Edit profile</h3><p>Only approved public profile fields can be changed.</p></div><label>Display name<input maxLength="60" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Bio<textarea maxLength="240" rows="3" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label><label>Batting style<select value={form.battingStyle} onChange={(event) => setForm({ ...form, battingStyle: event.target.value })}><option>Right hand</option><option>Left hand</option></select></label><label>Bowling style<select value={form.bowlingStyle} onChange={(event) => setForm({ ...form, bowlingStyle: event.target.value })}><option>Right arm medium</option><option>Right arm fast</option><option>Right arm off break</option><option>Right arm leg break</option><option>Left arm orthodox</option></select></label><label>Reason for change <span className="required-mark">*</span><textarea rows="2" maxLength="300" placeholder="Why is this profile being updated?" value={reason} onChange={(event) => setReason(event.target.value)} required /></label><p className="form-note"><Icon name="shield" size={14} /> Changes are recorded in the local demo audit log.</p><div className="drawer-actions"><button type="button" className="button button-secondary" onClick={onCancelEdit}>Cancel</button><button type="submit" className="button button-primary"><Icon name="shield" size={15} /> Save changes</button></div></form> : tab === "Overview" ? <>
          <div className="drawer-section-title"><h3>Player details</h3><button className="edit-text-button" onClick={onEdit}><Icon name="edit" size={14} /> Edit</button></div>
          <div className="detail-list"><DetailRow label="Email address" value={player.email} /><DetailRow label="Member since" value={formatDate(player.joinedAt)} /><DetailRow label="Gang" value={player.gang} /><DetailRow label="Batting style" value={player.battingStyle} /><DetailRow label="Bowling style" value={player.bowlingStyle} /></div>
          <div className="bio-card"><span>ABOUT</span><p>{player.bio || "No bio added yet."}</p></div>
          <div className="drawer-section-title stats-title"><h3>Career stats</h3><span>READ ONLY</span></div>
          <div className="career-stats"><div><span>Matches</span><strong>{player.matches}</strong></div><div><span>Runs</span><strong>{player.runs}</strong></div><div><span>Wickets</span><strong>{player.wickets}</strong></div><div><span>Points</span><strong>{player.points.toLocaleString()}</strong></div></div>
          <div className="related-card"><div className="related-icon"><Icon name="grid" size={16} /></div><span><strong>Related matches</strong><small>Read-only · Singles &amp; team matches</small></span><b>{player.matches}</b><Icon name="chevron" size={15} /></div>
          <div className="private-data-card"><div className="private-data-title"><Icon name="lock" size={15} /><strong>Private contact details</strong></div><p>Hidden by default. Requires operator access, a reason and an audited server request.</p><button disabled title="Available after secure server authentication is connected"><Icon name="eye" size={14} /> Reveal contact details</button></div>
          <div className="archive-zone"><div><strong>{player.archived ? "Restore this player" : "Archive this player"}</strong><p>{player.archived ? "Make this profile active again." : "Hide this profile without deleting match history."}</p></div><button className="archive-action" onClick={() => { setArchiveReason(""); setArchivePrompt(true); }}>{player.archived ? "Restore" : "Archive"}</button></div>
          {archivePrompt && <div className="archive-confirm"><strong>{player.archived ? "Restore" : "Archive"} {player.name}?</strong><p>This action is saved only in the local demo and recorded in its audit history.</p><label>Reason <span className="required-mark">*</span><textarea rows="2" maxLength="300" placeholder="Enter a reason..." value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} /></label><div><button className="button button-secondary" onClick={() => setArchivePrompt(false)}>Cancel</button><button className="button button-primary" disabled={!archiveReason.trim()} onClick={confirmArchive}>Confirm {player.archived ? "restore" : "archive"}</button></div></div>}
          <div className="delete-disabled"><Icon name="lock" size={15} /><span><strong>Permanent deletion unavailable</strong><small>Owner role, dependency review and secure server workflow required.</small></span></div>
        </> : <>
          <div className="drawer-section-title"><h3>Recent activity</h3><span className="readonly-label">SAMPLE</span></div>
          <div className="activity-empty"><Icon name="clock" size={22} /><strong>Player activity</strong><p>Match and gang context is read-only. Connect the secure admin API to view production activity.</p></div>
          <div className="related-card"><div className="related-icon"><Icon name="users" size={16} /></div><span><strong>{player.gang}</strong><small>Gang membership · read-only</small></span><Icon name="chevron" size={15} /></div>
        </>}
      </div>
      {!editing && <div className="drawer-footer"><span><Icon name="shield" size={14} /> Activity is logged</span><button className="button button-secondary" onClick={onClose}>Done</button></div>}
    </aside>
  </div>;
}

function DetailRow({ label, value }) {
  return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>;
}

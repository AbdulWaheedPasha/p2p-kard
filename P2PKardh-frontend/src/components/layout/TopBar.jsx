import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Button from "../ui/Button.jsx";
import { useAuthStore } from "../../state/authStore.js";
import { logoutApi } from "../../api/endpoints.js";

function IconBell({ className = "" }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 17H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 21a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMenu({ className = "" }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown({ className = "" }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavPill({ items, activeKey, onSelect }) {
  return (
    <div className="relative inline-flex rounded-2xl bg-slate-100 p-1">
      {items.map((it) => {
        const isActive = it.key === activeKey;
        return (
          <button
            key={it.key}
            onClick={() => onSelect(it)}
            className={`relative z-10 rounded-xl px-4 py-2 text-base font-semibold transition ${
              isActive ? "text-white" : "text-slate-700 hover:text-slate-900"
            }`}
            type="button"
          >
            {isActive && (
              <motion.div
                layoutId="navActivePill"
                className="absolute inset-0 z-0 rounded-xl bg-slate-900"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Dropdown({ open, anchorRef, onClose, children, widthClass = "w-80" }) {
  const panelRef = React.useRef(null);

  const handleOutside = React.useCallback(
    (e) => {
      if (!open) return;

      const panel = panelRef.current;
      const anchor = anchorRef?.current;

      const clickedInsidePanel = panel && panel.contains(e.target);
      const clickedInsideAnchor = anchor && anchor.contains(e.target);

      if (clickedInsidePanel || clickedInsideAnchor) return;
      onClose?.();
    },
    [open, anchorRef, onClose]
  );

  React.useEffect(() => {
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [handleOutside]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          className={`absolute right-0 top-full mt-2 ${widthClass} max-w-[92vw]
            rounded-2xl border bg-white p-3
            shadow-[0_18px_45px_rgba(2,6,23,0.18)] z-50`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isAuthed, logout } = useAuthStore();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const notifAnchorRef = React.useRef(null);
  const profileAnchorRef = React.useRef(null);

  const path = location.pathname || "";

  // ✅ Active key logic includes borrower + admin
  const activeKey = path.startsWith("/app/admin")
    ? "admin"
    : path.startsWith("/app/lender")
    ? "dashboard"
    : path.startsWith("/app/borrower")
    ? "borrower"
    : "home";

  // ✅ Public-first nav. Dashboard + Request support only show if logged in.
  const navItems = [
    { key: "home", label: "Home", to: "/app/home" },
    ...(isAuthed ? [{ key: "dashboard", label: "My Dashboard", to: "/app/lender" }] : []),
    ...(isAuthed && (user?.is_staff || user?.is_superuser)
      ? [{ key: "admin", label: "Admin", to: "/app/admin/requests" }]
      : []),
  ];

  const notifications = [
    { id: "n1", title: "A campaign you supported has an update.", time: "Today" },
    { id: "n2", title: "Thank you — a request reached its goal.", time: "Yesterday" },
    { id: "n3", title: "Reminder: your expected return date is approaching.", time: "This week" },
  ];

  const unreadCount = isAuthed ? 2 : 0;

  function go(to) {
    setMobileOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
    navigate(to);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await logoutApi(); // if backend supports it
    } catch {
      // ignore
    } finally {
      logout();
      setLoggingOut(false);
      go("/login");
    }
  }

  const displayName = user?.name || user?.email || "Friend";
  const displayEmail = user?.email || "";
  const avatarLetter = (displayName?.[0] || "F").toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <div
          className="cursor-pointer select-none text-lg font-semibold"
          onClick={() => go("/app/home")}
          title="Go to Home"
        >
          P2P Kardh
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <NavPill items={navItems} activeKey={activeKey} onSelect={(it) => go(it.to)} />

          {isAuthed ? (
            <Button
              variant={activeKey === "borrower" ? "primary" : "outline"}
              onClick={() => go("/app/borrower/apply")}
            >
              Request support
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => go("/login")}>
                Login
              </Button>
              <Button onClick={() => go("/register")}>Register</Button>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notifications only when authed */}
          {isAuthed && (
            <div className="relative" ref={notifAnchorRef}>
              <button
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white text-slate-700 hover:bg-slate-50 transition"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                type="button"
              >
                <IconBell />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <Dropdown open={notifOpen} anchorRef={notifAnchorRef} onClose={() => setNotifOpen(false)} widthClass="w-[92vw] sm:w-96">
                <div className="px-2 pb-2">
                  <div className="text-sm font-semibold">Notifications</div>
                  <div className="mt-1 text-xs text-slate-500">Meaningful updates only.</div>
                </div>

                <div className="mt-2 space-y-2">
                  {notifications.map((n) => (
                    <div key={n.id} className="rounded-xl border p-3 hover:bg-slate-50 transition">
                      <div className="text-sm font-medium text-slate-900">{n.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{n.time}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-t pt-3 px-2">
                  <button
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900 underline"
                    onClick={() => setNotifOpen(false)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </Dropdown>
            </div>
          )}

          {/* Profile only when authed */}
          {isAuthed && (
            <div className="relative" ref={profileAnchorRef}>
              <button
                className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 hover:bg-slate-50 transition"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                aria-label="Profile menu"
                type="button"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-semibold">
                  {avatarLetter}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold leading-none">{displayName}</div>
                  {displayEmail ? <div className="mt-1 text-xs text-slate-500 leading-none">{displayEmail}</div> : null}
                </div>
                <IconChevronDown className="text-slate-600" />
              </button>

              <Dropdown open={profileOpen} anchorRef={profileAnchorRef} onClose={() => setProfileOpen(false)} widthClass="w-[92vw] sm:w-80">
                <div className="px-2 pb-2">
                  <div className="text-sm font-semibold">Account</div>
                  <div className="mt-1 text-xs text-slate-500">You are signed in.</div>
                </div>

                <div className="mt-2 space-y-2">
                  <button
                    className="w-full rounded-xl border p-3 text-left hover:bg-slate-50 transition"
                    onClick={() => go("/app/lender")}
                    type="button"
                  >
                    <div className="text-sm font-semibold">My dashboard</div>
                    <div className="mt-1 text-xs text-slate-500">Support, returns, statuses.</div>
                  </button>

                  {(user?.is_staff || user?.is_superuser) && (
                    <button
                      className="w-full rounded-xl border p-3 text-left hover:bg-slate-50 transition"
                      onClick={() => go("/app/admin/requests")}
                      type="button"
                    >
                      <div className="text-sm font-semibold">Admin</div>
                      <div className="mt-1 text-xs text-slate-500">Review borrow requests.</div>
                    </button>
                  )}
                </div>

                <div className="mt-3 border-t pt-3 px-2 flex items-center justify-between">
                  <button
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900 underline"
                    onClick={() => setProfileOpen(false)}
                    type="button"
                  >
                    Close
                  </button>

                  <Button variant="ghost" onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? "Signing out..." : "Sign out"}
                  </Button>
                </div>
              </Dropdown>
            </div>
          )}

          {/* Mobile menu */}
          <div className="md:hidden">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white hover:bg-slate-50 transition"
              onClick={() => {
                setMobileOpen((v) => !v);
                setNotifOpen(false);
                setProfileOpen(false);
              }}
              aria-label="Menu"
              type="button"
            >
              <IconMenu />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="md:hidden border-t bg-white"
          >
            <div className="mx-auto max-w-7xl px-4 py-3 space-y-2">
              <button
                className={`w-full rounded-xl px-4 py-3 text-left text-base font-semibold ${
                  activeKey === "home" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800"
                }`}
                onClick={() => go("/app/home")}
                type="button"
              >
                Home
              </button>

              {isAuthed ? (
                <>
                  <button
                    className={`w-full rounded-xl px-4 py-3 text-left text-base font-semibold ${
                      activeKey === "dashboard" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800"
                    }`}
                    onClick={() => go("/app/lender")}
                    type="button"
                  >
                    My Dashboard
                  </button>

                  <button
                    className={`w-full rounded-xl px-4 py-3 text-left text-base font-semibold ${
                      activeKey === "borrower" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800"
                    }`}
                    onClick={() => go("/app/borrower/apply")}
                    type="button"
                  >
                    Request support
                  </button>

                  {(user?.is_staff || user?.is_superuser) && (
                    <button
                      className={`w-full rounded-xl px-4 py-3 text-left text-base font-semibold ${
                        activeKey === "admin" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800"
                      }`}
                      onClick={() => go("/app/admin/requests")}
                      type="button"
                    >
                      Admin
                    </button>
                  )}

                  <div className="pt-2 border-t">
                    <Button variant="ghost" className="w-full justify-start" onClick={handleLogout} disabled={loggingOut}>
                      {loggingOut ? "Signing out..." : "Sign out"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full" onClick={() => go("/login")}>
                    Login
                  </Button>
                  <Button className="w-full" onClick={() => go("/register")}>
                    Register
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

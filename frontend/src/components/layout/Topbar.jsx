import { Bell, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listNotifications } from "../../services/notificationService";
import { getUser } from "../../services/session";
import { connectRealtime } from "../../services/realtime";
import { applyTheme, getTheme, toggleTheme } from "../../utils/theme";
import { cn } from "../../utils/cn";

export default function Topbar() {
  const user = getUser();
  const [theme, setTheme] = useState(() => getTheme());
  const [notifications, setNotifications] = useState([]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    listNotifications()
      .then((rows) => mounted && setNotifications(rows))
      .catch(() => {});

    const s = connectRealtime();
    s.on("notification:new", (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50));
    });

    return () => {
      mounted = false;
      s.off("notification:new");
    };
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/60">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {user?.role ? (
              <span className="capitalize">{user.role} dashboard</span>
            ) : (
              "Dashboard"
            )}
          </div>
          <div className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
            Manage appointments, availability, and insights.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(toggleTheme())}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50",
              "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
            )}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative">
            <button
              className={cn(
                "grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50",
                "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
              )}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            {unreadCount ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-tealish-500 px-1 text-[11px] font-bold text-white shadow-soft">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="grid h-8 w-8 place-items-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {(user?.fullName || user?.full_name || user?.email || "U")[0]?.toUpperCase()}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-semibold">
                {user?.fullName || user?.full_name || "User"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}


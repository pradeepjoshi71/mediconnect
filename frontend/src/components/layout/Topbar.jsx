import { Bell, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { markAllNotificationsRead, markNotificationRead, listNotifications } from "../../services/notificationService";
import { connectRealtime } from "../../services/realtime";
import { getUser } from "../../services/session";
import { applyTheme, getTheme, toggleTheme } from "../../utils/theme";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export default function Topbar() {
  const user = getUser();
  const [theme, setTheme] = useState(() => getTheme());
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    listNotifications()
      .then((items) => {
        if (mounted) setNotifications(items);
      })
      .catch(() => {});

    const socket = connectRealtime();
    const onNotification = (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 100));
    };
    socket.on("notification:new", onNotification);

    return () => {
      mounted = false;
      socket.off("notification:new", onNotification);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/70 bg-white/80 px-5 py-4 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Connected care platform
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Real-time operations for {user?.role} workflows.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(toggleTheme())}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setOpen((value) => !value)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}

              {open ? (
                <div className="absolute right-0 mt-3 w-[360px] rounded-[28px] border border-white/70 bg-white/95 p-4 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Notifications
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await markAllNotificationsRead();
                        setNotifications((items) =>
                          items.map((item) => ({ ...item, readAt: new Date().toISOString() }))
                        );
                      }}
                    >
                      Mark all read
                    </Button>
                  </div>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto">
                    {notifications.length ? (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          onClick={async () => {
                            if (!item.readAt) {
                              await markNotificationRead(item.id);
                              setNotifications((items) =>
                                items.map((current) =>
                                  current.id === item.id
                                    ? { ...current, readAt: new Date().toISOString() }
                                    : current
                                )
                              );
                            }
                          }}
                          className="w-full rounded-3xl border border-slate-200 p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/70"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </div>
                            <Badge tone={item.readAt ? "slate" : "brand"}>
                              {item.readAt ? "Read" : "New"}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            {item.body}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-tealish-600 text-sm font-black text-white">
                {(user?.fullName || "U").charAt(0)}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {user?.fullName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

import { Bell, Building2, Moon, Sun, Search, Menu, LogOut, ChevronDown, User } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { markAllNotificationsRead, markNotificationRead, listNotifications } from "../../services/notificationService";
import { connectRealtime } from "../../services/realtime";
import { getUser } from "../../services/session";
import { logout } from "../../services/authService";
import { applyTheme, getTheme, toggleTheme } from "../../utils/theme";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";
import { useBranding } from "../../contexts/BrandingContext";

export default function Topbar({ onOpenMobileMenu }) {
  const user = getUser();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [theme, setTheme] = useState(() => getTheme());
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Handle outside clicks to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.fullName || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-3 shadow-premium backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Mobile hamburger menu & Search box */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Open sidebar"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            {/* Mobile Hospital Brand Info */}
            <div className="flex items-center gap-2 lg:hidden">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-7 w-auto object-contain shrink-0"
                />
              ) : (
                <span className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[120px]">
                  {branding?.displayName || user?.hospitalName || "MediConnect"}
                </span>
              )}
            </div>

            {/* Premium CMD+K Dummy Search Input */}
            <div className="relative w-full max-w-[280px] hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search anything... ⌘K"
                className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500/70 focus:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
              />
            </div>
          </div>

          {/* Right actions: Theme, Notification, and User profile card */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(toggleTheme())}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-300 transition-all duration-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>

            {/* Notification Dropdown Container */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setOpen((value) => !value)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-300 transition-all duration-200"
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
              </button>
              {unreadCount ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-950">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}

              {open && (
                <div className="absolute right-0 mt-3.5 w-[360px] rounded-2xl border border-slate-200/80 bg-white shadow-premium p-4 animate-slide-up dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Notifications
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] px-2"
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
                  <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
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
                          className={cn(
                            "w-full rounded-xl border border-slate-100 p-3 text-left transition-all hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-900/50",
                            !item.readAt && "bg-brand-50/20 border-brand-100/50 dark:bg-brand-500/5 dark:border-brand-500/10"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                              {item.title}
                            </div>
                            <Badge tone={item.readAt ? "slate" : "brand"} className="text-[9px] px-1.5 py-0.5">
                              {item.readAt ? "Read" : "New"}
                            </Badge>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {item.body}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Separator line */}
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800/80 mx-1" />

            {/* User Profile Card Dropdown Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 p-1.5 pr-2.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-200"
              >
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white text-[11px] font-black">
                  {initials}
                </div>
                <div className="hidden md:block text-left max-w-[100px]">
                  <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                    {user?.fullName?.split(" ")[0]}
                  </div>
                </div>
                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-3.5 w-56 rounded-2xl border border-slate-200/80 bg-white shadow-premium p-2 animate-slide-up dark:border-slate-800 dark:bg-slate-950">
                  <div className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user?.fullName}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {user?.email}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {branding?.displayName || user?.hospitalName}
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl dark:text-red-400 dark:hover:bg-red-500/10 transition-all"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}

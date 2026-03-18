import {
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Stethoscope,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import { getUser } from "../../services/session";
import { cn } from "../../utils/cn";

const navBase =
  "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all";

function buildNavItems(role) {
  const shared = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/records", label: "Medical records", icon: FileText },
  ];

  if (role === "patient") {
    return [
      ...shared,
      { to: "/doctors", label: "Find doctors", icon: Stethoscope },
      { to: "/billing", label: "Billing", icon: CreditCard },
    ];
  }

  if (role === "doctor") {
    return shared;
  }

  return [
    ...shared,
    { to: "/doctors", label: "Doctors", icon: Stethoscope },
    { to: "/billing", label: "Billing", icon: CreditCard },
  ];
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getUser();
  const items = buildNavItems(user?.role);

  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-0 flex h-screen flex-col px-5 py-6">
        <div className="rounded-[30px] border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-tealish-600 text-white shadow-soft">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-slate-950 dark:text-white">
                MediConnect HMS
              </div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Hospital operations
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-slate-50 px-4 py-3 dark:bg-slate-900/70">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Signed in as
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {user?.fullName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</div>
          </div>

          <nav className="mt-6 space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      navBase,
                      isActive
                        ? "bg-gradient-to-r from-brand-600 to-tealish-600 text-white shadow-soft"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900/60"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className={cn(
              navBase,
              "mt-8 w-full justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
            )}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

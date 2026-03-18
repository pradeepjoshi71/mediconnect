import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, LayoutDashboard, LogOut, Shield, Stethoscope, Users } from "lucide-react";
import { cn } from "../../utils/cn";
import { getUser } from "../../services/session";
import { logout } from "../../services/authService";

const navBase =
  "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition";

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const isDoctor = user?.role === "doctor";

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/booking", label: "Book appointment", icon: CalendarDays, show: !isDoctor },
    { to: "/doctors", label: "Doctors", icon: Stethoscope, show: !isDoctor },
    { to: "/doctor", label: "Doctor view", icon: Users, show: isDoctor },
    { to: "/admin", label: "Admin", icon: Shield, show: isAdmin },
  ].filter((i) => i.show);

  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-slate-200/70 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/60 lg:block">
      <div className="flex h-screen flex-col px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">MediConnect</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Healthcare appointments
            </div>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
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
                      ? "bg-brand-600 text-white shadow-soft"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900/60"
                  )
                }
              >
                <Icon className="h-4 w-4 opacity-90" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className={cn(
              navBase,
              "w-full justify-start border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
            )}
          >
            <LogOut className="h-4 w-4 opacity-90" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}


import { useState, useEffect } from "react";
import {
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  UsersRound,
  Beaker,
  Pill,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  UserPlus,
  UserCheck,
  Receipt,
  Activity,
  DollarSign,
  HelpCircle,
  Video,
  AlertTriangle,
  Layers,
  Palette,
  ShieldAlert,
  Package
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../../services/authService";
import { getUser } from "../../services/session";
import { cn } from "../../utils/cn";
import { useBranding } from "../../contexts/BrandingContext";

const navBase =
  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200";

function buildNavItems(role, path = "", permissions = []) {
  if (path.startsWith("/super-admin")) {
    return [
      {
        title: "Workspace",
        items: [
          { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
          { to: "/super-admin/analytics", label: "Analytics", icon: Activity },
          { to: "/super-admin/system-health", label: "System Health", icon: ShieldAlert },
        ],
      },
      {
        title: "Operations",
        items: [
          { to: "/super-admin/hospitals", label: "Hospitals", icon: Building2 },
          { to: "/super-admin/onboarding", label: "Onboarding", icon: UserPlus },
          { to: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
          { to: "/super-admin/revenue", label: "Revenue", icon: DollarSign },
          { to: "/super-admin/support", label: "Support", icon: HelpCircle },
        ],
      },
    ];
  }

  if (path.startsWith("/admin")) {
    const allClinical = [
      { to: "/admin/doctors", label: "Doctors", icon: Stethoscope, permission: "manage_doctors" },
      { to: "/admin/patients", label: "Patients", icon: UsersRound, permission: "view_patients" },
      { to: "/admin/appointments", label: "Appointments", icon: CalendarDays, permission: "view_appointments" },
      { to: "/admin/lab", label: "Lab Management", icon: Beaker, permission: "manage_lab_orders" },
    ];

    const allOps = [
      { to: "/admin/billing", label: "Billing", icon: CreditCard, permission: "record_payments" },
      { to: "/admin/reports", label: "Reports", icon: TrendingUp, permission: "view_reports" },
      { to: "/admin/business", label: "Business Analytics", icon: DollarSign, permission: "view_analytics" },
      { to: "/admin/pmjay-dashboard", label: "PM-JAY Analytics", icon: ShieldCheck, permission: "pmjay.analytics.read" },
      { to: "/admin/inventory", label: "Inventory", icon: Package, permission: "manage_inventory" },
      { to: "/admin/departments", label: "Departments", icon: Building2, permission: "department.read" },
    ];

    const allSystem = [
      { to: "/admin/subscription", label: "Subscription", icon: Layers, permission: "manage_settings" },
      { to: "/admin/branding", label: "Branding", icon: Palette, permission: "manage_settings" },
      { to: "/admin/settings", label: "Settings", icon: Settings, permission: "manage_settings" },
    ];

    const isAdmin = ["super_admin", "hospital_admin", "admin"].includes(role);
    const filterFn = (item) => !item.permission || isAdmin || (permissions || []).includes(item.permission);

    return [
      {
        title: "Workspace",
        items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        title: "Clinical Care",
        items: allClinical.filter(filterFn),
      },
      {
        title: "Business Ops",
        items: allOps.filter(filterFn),
      },
      {
        title: "System settings",
        items: allSystem.filter(filterFn),
      },
    ];
  }

  if (path.startsWith("/doctor")) {
    return [
      {
        title: "Workspace",
        items: [
          { to: "/doctor", label: "Dashboard", icon: LayoutDashboard },
          { to: "/doctor/appointments", label: "My Appointments", icon: CalendarDays },
        ],
      },
      {
        title: "Patient Care",
        items: [
          { to: "/doctor/patients", label: "My Patients", icon: UsersRound },
          { to: "/doctor/emr", label: "EMR", icon: FileText },
          { to: "/doctor/prescriptions", label: "Prescriptions", icon: Pill },
          { to: "/doctor/lab-requests", label: "Lab Requests", icon: Beaker },
        ],
      },
    ];
  }

  if (path.startsWith("/reception")) {
    return [
      {
        title: "Workspace",
        items: [{ to: "/reception", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        title: "Front Desk",
        items: [
          { to: "/reception/patients", label: "Patient Registration", icon: UserPlus },
          { to: "/reception/appointments", label: "Appointments", icon: CalendarDays },
          { to: "/reception/check-in", label: "Check-In", icon: UserCheck },
        ],
      },
      {
        title: "Financials",
        items: [
          { to: "/reception/billing", label: "Billing", icon: CreditCard },
          { to: "/reception/payments", label: "Payments", icon: Receipt },
        ],
      },
    ];
  }

  if (path.startsWith("/lab")) {
    return [
      {
        title: "Diagnostics",
        items: [
          { to: "/lab", label: "Dashboard", icon: LayoutDashboard },
          { to: "/lab/orders", label: "Lab Orders", icon: Beaker },
          { to: "/lab/sample-collection", label: "Sample Collection", icon: UserCheck },
          { to: "/lab/test-results", label: "Test Results", icon: Activity },
          { to: "/lab/reports", label: "Reports", icon: FileText },
        ],
      },
    ];
  }

  if (path.startsWith("/pharmacy")) {
    return [
      {
        title: "Pharmacy Ops",
        items: [
          { to: "/pharmacy", label: "Dashboard", icon: LayoutDashboard },
          { to: "/pharmacy/prescriptions", label: "Prescriptions", icon: Pill },
          { to: "/pharmacy/inventory", label: "Inventory", icon: Layers },
          { to: "/pharmacy/sales", label: "Sales", icon: DollarSign },
          { to: "/pharmacy/stock-alerts", label: "Stock Alerts", icon: AlertTriangle },
        ],
      },
    ];
  }

  if (path.startsWith("/nurse")) {
    return [
      {
        title: "Patient Care",
        items: [
          { to: "/nurse", label: "Dashboard", icon: LayoutDashboard },
          { to: "/nurse/patients", label: "Assigned Patients", icon: UsersRound },
          { to: "/nurse/vitals", label: "Vitals", icon: Activity },
          { to: "/nurse/care-notes", label: "Care Notes", icon: FileText },
          { to: "/nurse/medications", label: "Medication Tracking", icon: Pill },
        ],
      },
    ];
  }

  if (path.startsWith("/patient")) {
    return [
      {
        title: "My Health",
        items: [
          { to: "/patient", label: "Dashboard", icon: LayoutDashboard },
          { to: "/patient/appointments", label: "Appointments", icon: CalendarDays },
          { to: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
          { to: "/patient/reports", label: "Lab Reports", icon: Beaker },
          { to: "/patient/payments", label: "Payments", icon: CreditCard },
          { to: "/patient/telemedicine", label: "Telemedicine", icon: Video },
        ],
      },
    ];
  }

  const isAdmin = ["super_admin", "hospital_admin", "admin"].includes(role);
  const isBillingStaffOrAdmin = ["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"].includes(role);

  // Default / Legacy fallback grouped items
  const mainItems = [
    { to: isAdmin ? "/admin" : "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/records", label: "Medical records", icon: FileText },
  ];

  const coreItems = [];
  if (role === "patient") {
    coreItems.push(
      { to: "/doctors", label: "Find doctors", icon: Stethoscope },
      { to: "/patient/reports", label: "Lab Reports", icon: Beaker },
      { to: "/patient/pharmacy", label: "Medications", icon: Pill },
      { to: "/patient/billing", label: "Billing", icon: CreditCard }
    );
  } else if (role === "doctor") {
    coreItems.push(
      { to: "/patients", label: "Patients", icon: UsersRound }
    );
  } else {
    coreItems.push(
      { to: isAdmin ? "/admin/patients" : "/patients", label: "Patients", icon: UsersRound },
      { to: isAdmin ? "/admin/doctors" : "/doctors", label: "Doctors", icon: Stethoscope },
      { to: isBillingStaffOrAdmin ? "/admin/billing" : "/billing", label: "Billing", icon: CreditCard }
    );
  }

  const adminItems = [];
  if (isAdmin) {
    adminItems.push(
      { to: "/admin/lab", label: "Lab Management", icon: Beaker },
      { to: "/admin/pharmacy", label: "Pharmacy Management", icon: Pill },
      { to: "/admin/audit-logs", label: "Audit Logs", icon: ShieldCheck }
    );
  }

  return [
    {
      title: "Workspace",
      items: mainItems,
    },
    {
      title: "Services",
      items: coreItems,
    },
    ...(adminItems.length > 0 ? [{ title: "Administration", items: adminItems }] : []),
  ];
}

export default function Sidebar({ collapsed: propCollapsed, onToggleCollapse, isMobile, onCloseMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { branding } = useBranding();
  const items = buildNavItems(user?.role, location.pathname, user?.permissions);
  
  const [localCollapsed, setLocalCollapsed] = useState(() => {
    const saved = localStorage.getItem("mc_sidebar_collapsed");
    return saved === "true";
  });


  const collapsed = isMobile ? false : (propCollapsed !== undefined ? propCollapsed : localCollapsed);

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !localCollapsed;
      setLocalCollapsed(next);
      localStorage.setItem("mc_sidebar_collapsed", String(next));
    }
  };

  const initials = (user?.fullName || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const handleNavClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside
      className={cn(
        "shrink-0 h-screen transition-all duration-300 ease-in-out z-30 sticky top-0 flex flex-col px-4 py-4",
        isMobile ? "w-[280px]" : (collapsed ? "w-[88px]" : "w-[290px]"),
        isMobile ? "h-full px-0 py-0" : "hidden lg:flex"
      )}
    >
      <div
        className={cn(
          "flex flex-col h-full bg-white/70 border border-slate-200/80 shadow-premium backdrop-blur-xl transition-all duration-300",
          "dark:border-slate-800/80 dark:bg-slate-950/75",
          isMobile ? "rounded-none border-y-0 border-l-0" : "rounded-3xl"
        )}
      >
        {/* Branding header */}
        <div className={cn("flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/60", collapsed && "justify-center p-4")}>
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Hospital Logo"
                className="h-9 max-w-[120px] shrink-0 object-contain"
                onError={e => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-soft"
                style={branding?.primaryColor ? { background: branding.primaryColor } : {}}>
                <Stethoscope className="h-5 w-5" />
              </div>
            )}
            {!collapsed && (
              <div>
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  {branding?.displayName || "MediConnect"}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-400 mt-1"
                  style={branding?.primaryColor ? { color: branding.primaryColor } : {}}>
                  HMS Platform
                </div>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle button */}
          {!isMobile && (
            <button
              onClick={toggleCollapse}
              className={cn(
                "p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100",
                "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800",
                collapsed && "absolute -right-3 top-7 z-40 shadow-md border-slate-200 dark:border-slate-700 rounded-full p-1"
              )}
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* User profile section */}
        <div className={cn("p-4 border-b border-slate-100 dark:border-slate-800/60", collapsed && "flex justify-center p-3")}>
          {collapsed ? (
            <div
              className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 text-xs font-bold"
              title={user?.fullName}
            >
              {initials}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-3.5 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-800/20">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white text-xs font-bold">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {user?.fullName}
                  </div>
                  <div className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                    {user?.role?.replace("_", " ")}
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/40 space-y-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{user?.hospitalName || "Hospital"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 tracking-wider uppercase">
                    {user?.hospitalCode || "TENANT"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {items.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {!collapsed && (
                <div className="px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 mt-2">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleNavClick}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        navBase,
                        collapsed && "justify-center px-0 w-11 h-11 mx-auto",
                        isActive
                          ? "bg-brand-600 text-white shadow-soft hover:bg-brand-700 dark:bg-brand-500 dark:text-slate-950 dark:font-bold"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/60"
                      )
                    }
                  >
                    <Icon className={cn("h-4.5 w-4.5 shrink-0", collapsed && "h-5 w-5")} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: branding text + sign out */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/60">
          {!collapsed && branding?.footerText && (
            <div className="px-2 pb-2 text-[10px] text-slate-400 dark:text-slate-600 truncate">
              {branding.footerText}
            </div>
          )}
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              navBase,
              "w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10",
              collapsed && "justify-center px-0 w-11 h-11 mx-auto"
            )}
          >
            <LogOut className={cn("h-4.5 w-4.5 shrink-0", collapsed && "h-5 w-5")} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { Drawer } from "../components/ui/Drawer";

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("mc_sidebar_collapsed");
    return saved === "true";
  });

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("mc_sidebar_collapsed", String(next));
  };

  return (
    <div className="min-h-screen bg-shell text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Dynamic Grid Dot Matrix shell pattern */}
      <div className="absolute inset-0 bg-shell-pattern opacity-80 pointer-events-none" />
      
      <div className="relative mx-auto flex max-w-[1600px] items-stretch">
        {/* Desktop Sidebar (lg Screen and above) */}
        <Sidebar collapsed={collapsed} onToggleCollapse={handleToggleCollapse} />

        {/* Mobile Sidebar (Slide Over Drawer) */}
        <Drawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          title="Navigation"
          side="left"
          size="max-w-[280px]"
          className="p-0 select-none"
        >
          <Sidebar
            isMobile={true}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
        </Drawer>

        {/* Main Panel Content Area */}
        <div className="flex min-w-0 flex-1 flex-col min-h-screen">
          <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import AppShell from "./layouts/AppShell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardPage from "./pages/Dashboard";
import DoctorsPage from "./pages/DoctorsPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import MedicalRecordsPage from "./pages/MedicalRecordsPage";
import BillingPage from "./pages/BillingPage";
import { refreshSession } from "./services/authService";
import { clearSession, hasSession } from "./services/session";
import { applyTheme, getTheme } from "./utils/theme";

function BootScreen() {
  return (
    <div className="min-h-screen bg-shell">
      <div className="absolute inset-0 bg-shell-pattern opacity-80" />
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="rounded-[32px] border border-white/70 bg-white/85 px-8 py-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
          <div className="text-xs font-bold uppercase tracking-[0.26em] text-brand-600 dark:text-brand-300">
            MediConnect HMS
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Preparing hospital workspace...
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    applyTheme(getTheme());

    let active = true;

    async function bootstrap() {
      if (hasSession()) {
        if (active) setBootstrapping(false);
        return;
      }

      try {
        await refreshSession();
      } catch {
        clearSession();
      } finally {
        if (active) setBootstrapping(false);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  if (bootstrapping) {
    return <BootScreen />;
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "18px",
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.92)",
            color: "#fff",
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/doctors"
              element={
                <RoleRoute allowedRoles={["patient", "admin", "receptionist"]}>
                  <DoctorsPage />
                </RoleRoute>
              }
            />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/records" element={<MedicalRecordsPage />} />
            <Route
              path="/billing"
              element={
                <RoleRoute allowedRoles={["patient", "admin", "receptionist"]}>
                  <BillingPage />
                </RoleRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

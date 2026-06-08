import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import RoleRoute from "./components/RoleRoute";
import AppShell from "./layouts/AppShell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import DashboardPage from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminDoctors from "./pages/AdminDoctors";
import AdminPatients from "./pages/AdminPatients";
import DoctorsPage from "./pages/DoctorsPage";
import Doctors from "./pages/Doctors";
import AppointmentsPage from "./pages/AppointmentsPage";
import MedicalRecordsPage from "./pages/MedicalRecordsPage";
import BillingPage from "./pages/BillingPage";
import Patients from "./pages/Patients";
import LabDashboard from "./pages/LabDashboard";
import PatientReports from "./pages/PatientReports";
import AdminLab from "./pages/AdminLab";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import AdminPharmacy from "./pages/AdminPharmacy";
import PatientPharmacy from "./pages/PatientPharmacy";
import AuditLogs from "./pages/AuditLogs";
import { refreshSession } from "./services/authService";
import { clearSession, hasSession } from "./services/session";
import { applyTheme, getTheme } from "./utils/theme";

// Super Admin Pages
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminHospitals from "./pages/SuperAdminHospitals";
import SuperAdminSubscriptions from "./pages/SuperAdminSubscriptions";
import SuperAdminRevenue from "./pages/SuperAdminRevenue";
import SuperAdminAnalytics from "./pages/SuperAdminAnalytics";
import SuperAdminSupport from "./pages/SuperAdminSupport";
import SuperAdminOnboarding from "./pages/SuperAdminOnboarding";
import SuperAdminSystemHealth from "./pages/SuperAdminSystemHealth";

// Hospital Admin Pages
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminSubscription from "./pages/AdminSubscription";
import AdminBranding from "./pages/AdminBranding";
import { BrandingProvider } from "./contexts/BrandingContext";

// Doctor Pages
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorPrescriptions from "./pages/DoctorPrescriptions";
import DoctorLabRequests from "./pages/DoctorLabRequests";

// Reception Pages
import ReceptionDashboard from "./pages/ReceptionDashboard";
import ReceptionCheckIn from "./pages/ReceptionCheckIn";
import ReceptionPayments from "./pages/ReceptionPayments";

// Lab Pages
import LabSampleCollection from "./pages/LabSampleCollection";
import LabTestResults from "./pages/LabTestResults";
import LabReports from "./pages/LabReports";

// Pharmacy Pages
import PharmacyPrescriptions from "./pages/PharmacyPrescriptions";
import PharmacyInventory from "./pages/PharmacyInventory";
import PharmacySales from "./pages/PharmacySales";
import PharmacyStockAlerts from "./pages/PharmacyStockAlerts";

// Nurse Pages
import NurseDashboard from "./pages/NurseDashboard";
import NursePatients from "./pages/NursePatients";
import NurseVitals from "./pages/NurseVitals";
import NurseCareNotes from "./pages/NurseCareNotes";
import NurseMedications from "./pages/NurseMedications";

// Patient Pages
import PatientDashboard from "./pages/PatientDashboard";
import PatientTelemedicine from "./pages/PatientTelemedicine";



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
      <BrandingProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Super Admin Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["super_admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/hospitals" element={<SuperAdminHospitals />} />
              <Route path="/super-admin/subscriptions" element={<SuperAdminSubscriptions />} />
              <Route path="/super-admin/revenue" element={<SuperAdminRevenue />} />
              <Route path="/super-admin/analytics" element={<SuperAdminAnalytics />} />
              <Route path="/super-admin/support" element={<SuperAdminSupport />} />
              <Route path="/super-admin/onboarding" element={<SuperAdminOnboarding />} />
              <Route path="/super-admin/system-health" element={<SuperAdminSystemHealth />} />
            </Route>
          </Route>
        </Route>

        {/* Hospital Admin Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["admin", "hospital_admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/doctors" element={<AdminDoctors />} />
              <Route path="/admin/patients" element={<AdminPatients />} />
              <Route path="/admin/appointments" element={<AppointmentsPage />} />
              <Route path="/admin/billing" element={<BillingPage />} />
              <Route path="/admin/lab" element={<AdminLab />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/subscription" element={<AdminSubscription />} />
              <Route path="/admin/branding" element={<AdminBranding />} />
            </Route>
          </Route>
        </Route>

        {/* Doctor Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["doctor"]} />}>
            <Route element={<AppShell />}>
              <Route path="/doctor" element={<DoctorDashboard />} />
              <Route path="/doctor/appointments" element={<DoctorDashboard />} />
              <Route path="/doctor/patients" element={<Patients />} />
              <Route path="/doctor/emr" element={<MedicalRecordsPage />} />
              <Route path="/doctor/prescriptions" element={<DoctorPrescriptions />} />
              <Route path="/doctor/lab-requests" element={<DoctorLabRequests />} />
            </Route>
          </Route>
        </Route>

        {/* Reception Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["receptionist"]} />}>
            <Route element={<AppShell />}>
              <Route path="/reception" element={<ReceptionDashboard />} />
              <Route path="/reception/patients" element={<AdminPatients />} />
              <Route path="/reception/appointments" element={<AppointmentsPage />} />
              <Route path="/reception/check-in" element={<ReceptionCheckIn />} />
              <Route path="/reception/billing" element={<BillingPage />} />
              <Route path="/reception/payments" element={<ReceptionPayments />} />
            </Route>
          </Route>
        </Route>

        {/* Lab Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["lab_technician", "super_admin", "hospital_admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="/lab" element={<LabDashboard />} />
              <Route path="/lab/orders" element={<LabDashboard />} />
              <Route path="/lab/sample-collection" element={<LabSampleCollection />} />
              <Route path="/lab/test-results" element={<LabTestResults />} />
              <Route path="/lab/reports" element={<LabReports />} />
            </Route>
          </Route>
        </Route>

        {/* Pharmacy Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["pharmacist", "super_admin", "hospital_admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="/pharmacy" element={<PharmacyDashboard />} />
              <Route path="/pharmacy/prescriptions" element={<PharmacyPrescriptions />} />
              <Route path="/pharmacy/inventory" element={<PharmacyInventory />} />
              <Route path="/pharmacy/sales" element={<PharmacySales />} />
              <Route path="/pharmacy/stock-alerts" element={<PharmacyStockAlerts />} />
            </Route>
          </Route>
        </Route>

        {/* Nurse Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["nurse", "super_admin", "hospital_admin"]} />}>
            <Route element={<AppShell />}>
              <Route path="/nurse" element={<NurseDashboard />} />
              <Route path="/nurse/patients" element={<NursePatients />} />
              <Route path="/nurse/vitals" element={<NurseVitals />} />
              <Route path="/nurse/care-notes" element={<NurseCareNotes />} />
              <Route path="/nurse/medications" element={<NurseMedications />} />
            </Route>
          </Route>
        </Route>

        {/* Patient Portal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allowedRoles={["patient"]} />}>
            <Route element={<AppShell />}>
              <Route path="/patient" element={<PatientDashboard />} />
              <Route path="/patient/appointments" element={<AppointmentsPage />} />
              <Route path="/patient/prescriptions" element={<PatientPharmacy />} />
              <Route path="/patient/reports" element={<PatientReports />} />
              <Route path="/patient/payments" element={<BillingPage />} />
              <Route path="/patient/telemedicine" element={<PatientTelemedicine />} />
            </Route>
          </Route>
        </Route>

        {/* Legacy / Shared Routes */}
        <Route element={<ProtectedAdminRoute />}>
          <Route element={<AppShell />}>
            <Route path="/admin/legacy-dashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

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
            <Route path="/patients" element={<Patients />} />
            <Route path="/doctors-list" element={<Doctors />} />
            <Route
              path="/admin/billing"
              element={
                <RoleRoute allowedRoles={["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"]}>
                  <BillingPage />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/billing"
              element={
                <RoleRoute allowedRoles={["patient"]}>
                  <BillingPage />
                </RoleRoute>
              }
            />
            <Route
              path="/lab/dashboard"
              element={
                <RoleRoute allowedRoles={["lab_technician", "super_admin", "hospital_admin", "admin"]}>
                  <LabDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/reports"
              element={
                <RoleRoute allowedRoles={["patient"]}>
                  <PatientReports />
                </RoleRoute>
              }
            />
            <Route
              path="/patient/pharmacy"
              element={
                <RoleRoute allowedRoles={["patient"]}>
                  <PatientPharmacy />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/lab"
              element={
                <RoleRoute allowedRoles={["super_admin", "hospital_admin", "admin"]}>
                  <AdminLab />
                </RoleRoute>
              }
            />
            <Route
              path="/pharmacy/dashboard"
              element={
                <RoleRoute allowedRoles={["pharmacist", "super_admin", "hospital_admin", "admin"]}>
                  <PharmacyDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/pharmacy"
              element={
                <RoleRoute allowedRoles={["super_admin", "hospital_admin", "admin"]}>
                  <AdminPharmacy />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <RoleRoute allowedRoles={["super_admin", "hospital_admin", "admin"]}>
                  <AuditLogs />
                </RoleRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
      </BrandingProvider>
    </BrowserRouter>
  );
}

import { Navigate } from "react-router-dom";
import { getUser } from "../services/session";

export default function DashboardPage() {
  const user = getUser();

  if (user?.role === "super_admin") {
    return <Navigate to="/super-admin" replace />;
  }

  // Specialist roles that go to the admin portal (permission-filtered sidebar)
  if (["hospital_admin", "admin", "patient_manager", "lab_admin", "report_admin", "billing_admin", "inventory_admin"].includes(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === "doctor") {
    return <Navigate to="/doctor" replace />;
  }

  // Receptionist gets their own dedicated portal
  if (user?.role === "receptionist") {
    return <Navigate to="/reception" replace />;
  }

  if (user?.role === "pharmacist") {
    return <Navigate to="/pharmacy" replace />;
  }

  if (user?.role === "lab_technician") {
    return <Navigate to="/lab" replace />;
  }

  if (user?.role === "nurse") {
    return <Navigate to="/nurse" replace />;
  }

  if (user?.role === "patient") {
    return <Navigate to="/patient" replace />;
  }

  return <Navigate to="/login" replace />;
}

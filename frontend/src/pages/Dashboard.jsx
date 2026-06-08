import { Navigate } from "react-router-dom";
import { getUser } from "../services/session";
import PatientDashboard from "./PatientDashboard";

export default function DashboardPage() {
  const user = getUser();

  if (user?.role === "super_admin") {
    return <Navigate to="/super-admin" replace />;
  }
  if (["hospital_admin", "admin"].includes(user?.role)) {
    return <Navigate to="/admin" replace />;
  }
  if (user?.role === "doctor") {
    return <Navigate to="/doctor" replace />;
  }
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


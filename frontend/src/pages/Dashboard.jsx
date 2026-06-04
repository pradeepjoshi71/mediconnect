import { Navigate } from "react-router-dom";
import { getUser } from "../services/session";
import PatientDashboard from "./PatientDashboard";
import DoctorDashboard from "./DoctorDashboard";
import ReceptionDashboard from "./ReceptionDashboard";

export default function DashboardPage() {
  const user = getUser();

  if (["super_admin", "hospital_admin", "admin"].includes(user?.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (user?.role === "doctor") return <DoctorDashboard />;
  if (user?.role === "receptionist") return <ReceptionDashboard />;
  if (user?.role === "pharmacist") return <Navigate to="/pharmacy/dashboard" replace />;
  return <PatientDashboard />;
}

import { getUser } from "../services/session";
import PatientDashboard from "./PatientDashboard";
import DoctorDashboard from "./DoctorDashboard";
import AdminDashboard from "./AdminDashboard";
import ReceptionDashboard from "./ReceptionDashboard";

export default function DashboardPage() {
  const user = getUser();

  if (user?.role === "doctor") return <DoctorDashboard />;
  if (["super_admin", "hospital_admin", "admin"].includes(user?.role)) return <AdminDashboard />;
  if (user?.role === "receptionist") return <ReceptionDashboard />;
  return <PatientDashboard />;
}

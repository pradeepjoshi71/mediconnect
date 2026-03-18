import { getUser } from "../services/session";
import PatientDashboard from "./PatientDashboard";
import DoctorDashboard from "./DoctorDashboard";
import AdminDashboard from "./AdminDashboard";
import ReceptionDashboard from "./ReceptionDashboard";

export default function DashboardPage() {
  const user = getUser();

  if (user?.role === "doctor") return <DoctorDashboard />;
  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "receptionist") return <ReceptionDashboard />;
  return <PatientDashboard />;
}

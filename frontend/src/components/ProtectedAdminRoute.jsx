import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasSession, getUser } from "../services/session";

export default function ProtectedAdminRoute({ children }) {
  const location = useLocation();
  const user = getUser();

  if (!hasSession()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const isAuthorized = user?.role === "admin" || user?.role === "hospital_admin" || user?.role === "super_admin";

  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return children || <Outlet />;
}

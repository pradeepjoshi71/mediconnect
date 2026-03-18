import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasSession } from "../services/session";

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children || <Outlet />;
}

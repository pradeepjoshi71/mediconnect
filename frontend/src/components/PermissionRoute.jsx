import { Navigate, Outlet } from "react-router-dom";
import { getUser } from "../services/session";

export default function PermissionRoute({ requiredPermission, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;

  const permissions = user.permissions || [];
  const isAuthorized =
    permissions.includes(requiredPermission) ||
    ["super_admin", "hospital_admin", "admin"].includes(user.role);

  if (!isAuthorized) return <Navigate to="/dashboard" replace />;

  return children || <Outlet />;
}

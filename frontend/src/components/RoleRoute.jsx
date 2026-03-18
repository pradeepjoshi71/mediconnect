import { Navigate } from "react-router-dom";
import { getUser } from "../services/session";

export default function RoleRoute({ allowedRoles, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles?.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}


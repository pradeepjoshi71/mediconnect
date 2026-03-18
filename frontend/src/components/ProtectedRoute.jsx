import { Navigate } from "react-router-dom";
import { getAccessToken } from "../services/session";

export default function ProtectedRoute({ children }) {
  const token = getAccessToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

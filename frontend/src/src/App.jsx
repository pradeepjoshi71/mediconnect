import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Doctors from "./pages/Doctors";
import BookAppointment from "./pages/BookAppointment";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctors"
          element={
            <ProtectedRoute>
              <Doctors />
            </ProtectedRoute>
          }
        />

        <Route
          path="/book"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["patient", "admin"]}>
                <BookAppointment />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["admin"]}>
                <AdminPanel />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

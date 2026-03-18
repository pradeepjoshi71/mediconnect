import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import AppShell from "./layouts/AppShell";

import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorsPage from "./pages/DoctorsPage";
import BookingPage from "./pages/BookingPage";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<PatientDashboard />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route
            path="/booking"
            element={
              <RoleRoute allowedRoles={["patient", "admin"]}>
                <BookingPage />
              </RoleRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <RoleRoute allowedRoles={["doctor", "admin"]}>
                <DoctorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </RoleRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

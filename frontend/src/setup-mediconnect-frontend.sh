#!/bin/bash

mkdir -p src/api src/components src/pages src/utils

cat > src/api/api.js <<'EOT'
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
EOT

cat > src/utils/auth.js <<'EOT'
export const getToken = () => localStorage.getItem("token");

export const getUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
EOT

cat > src/components/Navbar.jsx <<'EOT'
import { Link, useNavigate } from "react-router-dom";
import { getUser, logout } from "../utils/auth";

function Navbar() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav style={styles.nav}>
      <h2 style={{ margin: 0 }}>MediConnect</h2>

      <div style={styles.links}>
        <Link style={styles.link} to="/dashboard">Dashboard</Link>
        <Link style={styles.link} to="/doctors">Doctors</Link>

        {(user?.role === "patient" || user?.role === "admin") && (
          <Link style={styles.link} to="/book">Book Appointment</Link>
        )}

        {user?.role === "admin" && (
          <Link style={styles.link} to="/admin">Admin Panel</Link>
        )}

        <button style={styles.button} onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 25px",
    backgroundColor: "#1976d2",
    color: "#fff",
    flexWrap: "wrap",
    gap: "10px",
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },
  link: {
    color: "#fff",
    textDecoration: "none",
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#fff",
    color: "#1976d2",
    border: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
  },
};

export default Navbar;
EOT

cat > src/components/ProtectedRoute.jsx <<'EOT'
import { Navigate } from "react-router-dom";
import { getToken } from "../utils/auth";

function ProtectedRoute({ children }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
EOT

cat > src/components/RoleRoute.jsx <<'EOT'
import { Navigate } from "react-router-dom";
import { getUser } from "../utils/auth";

function RoleRoute({ children, allowedRoles }) {
  const user = getUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default RoleRoute;
EOT

cat > src/pages/Dashboard.jsx <<'EOT'
import Navbar from "../components/Navbar";
import { getUser } from "../utils/auth";

function Dashboard() {
  const user = getUser();

  return (
    <>
      <Navbar />
      <div style={styles.container}>
        <h1>Welcome to MediConnect</h1>
        <p>Hello, <strong>{user?.name || "User"}</strong> 👋</p>
        <p>Your role: <strong>{user?.role || "patient"}</strong></p>

        <div style={styles.cards}>
          <div style={styles.card}>
            <h3>Doctors</h3>
            <p>View the list of available doctors and specializations.</p>
          </div>

          <div style={styles.card}>
            <h3>Appointments</h3>
            <p>Book and manage appointments easily from one place.</p>
          </div>

          <div style={styles.card}>
            <h3>Admin Control</h3>
            <p>Admins can manage users and appointments from the admin panel.</p>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: "30px",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
    marginTop: "30px",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
};

export default Dashboard;
EOT

cat > src/pages/Doctors.jsx <<'EOT'
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/api";

function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await api.get("/doctors");
      setDoctors(res.data);
    } catch (err) {
      setError("Failed to load doctors");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div style={styles.container}>
        <h1>Doctor List</h1>

        {loading && <p>Loading doctors...</p>}
        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.grid}>
          {doctors.map((doctor) => (
            <div key={doctor.id} style={styles.card}>
              <h3>{doctor.name}</h3>
              <p><strong>Email:</strong> {doctor.email}</p>
              <p><strong>Specialization:</strong> {doctor.specialization}</p>
              <p><strong>Experience:</strong> {doctor.experience || 0} years</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: "30px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    marginTop: "20px",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  error: {
    color: "red",
  },
};

export default Doctors;
EOT

cat > src/pages/BookAppointment.jsx <<'EOT'
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/api";

function BookAppointment() {
  const [doctors, setDoctors] = useState([]);
  const [formData, setFormData] = useState({
    doctorId: "",
    appointmentDate: "",
    reason: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await api.get("/doctors");
      setDoctors(res.data);
    } catch (err) {
      setError("Failed to load doctors");
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        doctorId: Number(formData.doctorId),
        appointmentDate: formData.appointmentDate,
        reason: formData.reason,
      };

      const res = await api.post("/appointments", payload);
      setMessage(res.data.message || "Appointment booked successfully");

      setFormData({
        doctorId: "",
        appointmentDate: "",
        reason: "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to book appointment");
    }
  };

  return (
    <>
      <Navbar />
      <div style={styles.container}>
        <h1>Book Appointment</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label>Select Doctor</label>
          <select
            name="doctorId"
            value={formData.doctorId}
            onChange={handleChange}
            required
          >
            <option value="">-- Select Doctor --</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} - {doctor.specialization}
              </option>
            ))}
          </select>

          <label>Appointment Date & Time</label>
          <input
            type="datetime-local"
            name="appointmentDate"
            value={formData.appointmentDate}
            onChange={handleChange}
            required
          />

          <label>Reason</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            placeholder="Describe your issue"
            rows="4"
            required
          />

          <button type="submit" style={styles.button}>Book Appointment</button>
        </form>

        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: "30px",
  },
  form: {
    maxWidth: "500px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "20px",
  },
  button: {
    backgroundColor: "#1976d2",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
  },
  success: {
    color: "green",
    marginTop: "15px",
  },
  error: {
    color: "red",
    marginTop: "15px",
  },
};

export default BookAppointment;
EOT

cat > src/pages/AdminPanel.jsx <<'EOT'
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/api";

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [usersRes, appointmentsRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/appointments"),
      ]);

      setUsers(usersRes.data);
      setAppointments(appointmentsRes.data);
    } catch (err) {
      setError("Failed to load admin data");
    }
  };

  return (
    <>
      <Navbar />
      <div style={styles.container}>
        <h1>Admin Panel</h1>
        {error && <p style={styles.error}>{error}</p>}

        <section style={styles.section}>
          <h2>All Users</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={styles.td}>{user.id}</td>
                    <td style={styles.td}>{user.name}</td>
                    <td style={styles.td}>{user.email}</td>
                    <td style={styles.td}>{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.section}>
          <h2>All Appointments</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Patient</th>
                  <th style={styles.th}>Doctor</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td style={styles.td}>{appt.id}</td>
                    <td style={styles.td}>{appt.patient_name}</td>
                    <td style={styles.td}>{appt.doctor_name}</td>
                    <td style={styles.td}>{new Date(appt.appointment_date).toLocaleString()}</td>
                    <td style={styles.td}>{appt.reason}</td>
                    <td style={styles.td}>{appt.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

const styles = {
  container: {
    padding: "30px",
  },
  section: {
    marginTop: "30px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
  th: {
    border: "1px solid #ddd",
    padding: "10px",
    backgroundColor: "#f4f4f4",
    textAlign: "left",
  },
  td: {
    border: "1px solid #ddd",
    padding: "10px",
  },
  error: {
    color: "red",
  },
};

export default AdminPanel;
EOT

cat > src/pages/Login.jsx <<'EOT'
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", formData);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Login</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            name="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Enter password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit" style={styles.button}>Login</button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fb",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "15px",
  },
  button: {
    backgroundColor: "#1976d2",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
  },
  error: {
    color: "red",
    marginTop: "12px",
  },
};

export default Login;
EOT

cat > src/App.jsx <<'EOT'
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
EOT

cat > src/main.jsx <<'EOT'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOT

echo "Frontend files created successfully."

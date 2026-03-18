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

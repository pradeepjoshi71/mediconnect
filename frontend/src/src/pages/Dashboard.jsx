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

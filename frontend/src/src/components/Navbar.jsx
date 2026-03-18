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

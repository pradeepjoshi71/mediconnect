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

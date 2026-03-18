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

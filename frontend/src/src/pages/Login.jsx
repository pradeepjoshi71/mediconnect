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

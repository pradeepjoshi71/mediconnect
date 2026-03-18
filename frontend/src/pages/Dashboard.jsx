import { useEffect, useState } from "react";
import { getDoctors } from "../services/doctorService";

export default function Dashboard() {

  const [doctors, setDoctors] = useState([]);

  const [formData, setFormData] = useState({
    patient_name: "",
    doctor_id: "",
    appointment_date: ""
  });

  const token = localStorage.getItem("token");

  useEffect(() => {

    async function loadDoctors() {

      const data = await getDoctors();

      setDoctors(data);

    }

    loadDoctors();

  }, []);

  const handleSubmit = async (e) => {

    e.preventDefault();

    const response = await fetch("http://localhost:5000/appointments", {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },

      body: JSON.stringify(formData)

    });

    const data = await response.json();

    alert(data.message);

  };

  return (

    <div className="container">

      <h2>Book Appointment</h2>

      <form onSubmit={handleSubmit}>

        <input
          placeholder="Patient Name"
          onChange={(e)=>
            setFormData({...formData, patient_name:e.target.value})
          }
        />

        <select
          onChange={(e)=>
            setFormData({...formData, doctor_id:e.target.value})
          }
        >

          <option>Select Doctor</option>

          {doctors.map((doc)=>(
            <option key={doc.id} value={doc.id}>
              {doc.name} - {doc.specialization}
            </option>
          ))}

        </select>

        <input
          type="date"
          onChange={(e)=>
            setFormData({...formData, appointment_date:e.target.value})
          }
        />

        <button type="submit">
          Book Appointment
        </button>

      </form>

    </div>

  );
}
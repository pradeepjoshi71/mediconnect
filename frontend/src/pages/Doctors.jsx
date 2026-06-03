import { useEffect, useState } from "react";
import { listDoctors } from "../services/doctorService";
import DoctorCard from "../components/DoctorCard";
import "./Doctors.css";

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    listDoctors()
      .then((data) => {
        if (!cancelled) {
          setDoctors(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Failed to load doctors. Please try again.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="doctors-page">
      <header className="doctors-page__header">
        <p className="doctors-page__eyebrow">Our clinical team</p>
        <h1 className="doctors-page__title">Find a Doctor</h1>
        <p className="doctors-page__description">
          Browse our qualified clinicians by specialty and experience.
        </p>
      </header>

      {loading && (
        <div className="doctors-page__state">
          <div className="doctors-page__spinner" aria-label="Loading doctors" />
          <p className="doctors-page__state-text">Loading doctors...</p>
        </div>
      )}

      {error && !loading && (
        <div className="doctors-page__state doctors-page__state--error" role="alert">
          <p className="doctors-page__state-text">{error}</p>
          <button
            className="doctors-page__retry"
            onClick={() => {
              setError(null);
              setLoading(true);
              listDoctors()
                .then((data) => {
                  setDoctors(Array.isArray(data) ? data : []);
                  setLoading(false);
                })
                .catch((err) => {
                  setError(err?.response?.data?.message || "Failed to load doctors.");
                  setLoading(false);
                });
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && doctors.length === 0 && (
        <div className="doctors-page__state">
          <p className="doctors-page__state-text">No doctors found.</p>
        </div>
      )}

      {!loading && !error && doctors.length > 0 && (
        <div className="doctors-page__grid">
          {doctors.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
}

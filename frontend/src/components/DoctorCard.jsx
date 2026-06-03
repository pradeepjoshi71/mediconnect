import { Stethoscope, Clock, Star } from "lucide-react";

export default function DoctorCard({ doctor }) {
  const initials = doctor.fullName
    ? doctor.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "DR";

  return (
    <div className="doctor-card">
      <div className="doctor-card__avatar">{initials}</div>

      <div className="doctor-card__body">
        <h3 className="doctor-card__name">{doctor.fullName}</h3>

        <div className="doctor-card__badges">
          <span className="doctor-card__badge doctor-card__badge--specialty">
            <Stethoscope size={12} />
            {doctor.specialization}
          </span>
          {doctor.department && (
            <span className="doctor-card__badge doctor-card__badge--dept">
              {doctor.department}
            </span>
          )}
        </div>

        <div className="doctor-card__stats">
          <div className="doctor-card__stat">
            <Clock size={14} className="doctor-card__stat-icon" />
            <span className="doctor-card__stat-value">
              {doctor.experienceYears ?? 0}
            </span>
            <span className="doctor-card__stat-label">yrs exp</span>
          </div>

          {doctor.rating != null && (
            <div className="doctor-card__stat">
              <Star size={14} className="doctor-card__stat-icon doctor-card__stat-icon--star" />
              <span className="doctor-card__stat-value">{doctor.rating}</span>
              <span className="doctor-card__stat-label">rating</span>
            </div>
          )}
        </div>

        {doctor.biography && (
          <p className="doctor-card__bio">{doctor.biography}</p>
        )}
      </div>
    </div>
  );
}

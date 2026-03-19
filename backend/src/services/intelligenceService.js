const doctorRepository = require("../repositories/doctorRepository");
const intelligenceRepository = require("../repositories/intelligenceRepository");
const { AppError } = require("../utils/http");
const auditService = require("./auditService");

const specialtyMap = [
  { keywords: ["chest pain", "palpitation", "shortness of breath", "hypertension"], specialization: "Cardiology" },
  { keywords: ["headache", "seizure", "numbness", "migraine", "dizziness"], specialization: "Neurology" },
  { keywords: ["rash", "eczema", "itching", "skin"], specialization: "Dermatology" },
  { keywords: ["cough", "asthma", "wheezing", "breathing"], specialization: "Pulmonology" },
  { keywords: ["child", "fever", "vaccination"], specialization: "Pediatrics" },
  { keywords: ["sugar", "thyroid", "endocrine"], specialization: "Endocrinology" },
];

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function specializationSignals(careNeed, symptoms) {
  const combined = [careNeed, ...(symptoms || [])].map(normalizeText).join(" ");
  return unique(
    specialtyMap
      .filter((item) => item.keywords.some((keyword) => combined.includes(keyword)))
      .map((item) => item.specialization)
  );
}

function buildDoctorRationale(doctor, score, matchedSpecialty) {
  const reasons = [];
  if (matchedSpecialty) {
    reasons.push(`matched for ${matchedSpecialty.toLowerCase()} care`);
  }
  if (Number(doctor.rating) >= 4.8) {
    reasons.push("top-rated clinician");
  }
  if (Number(doctor.experienceYears) >= 10) {
    reasons.push("high clinical experience");
  }
  if (Number(doctor.consultationFeeCents) <= 5000) {
    reasons.push("cost-efficient slot");
  }

  return {
    score,
    rationale: reasons.length ? reasons.join(", ") : "balanced quality and availability profile",
  };
}

async function getDoctorRecommendations(user, filters, context) {
  const recommendedSpecializations = specializationSignals(filters.careNeed, filters.symptoms);
  const doctors = await doctorRepository.listDoctors({
    hospitalId: user.hospitalId,
    specialization: filters.specialization || "",
    search: filters.search || "",
    minExperience: filters.minExperience || 0,
    minRating: filters.minRating || 0,
    sort: "rating",
  });

  const ranked = doctors
    .map((doctor) => {
      const matchedSpecialty = recommendedSpecializations.find(
        (item) => normalizeText(item) === normalizeText(doctor.specialization)
      );
      let score =
        Number(doctor.rating || 0) * 20 +
        Number(doctor.experienceYears || 0) * 2 -
        Number(doctor.consultationFeeCents || 0) / 1000;

      if (matchedSpecialty) {
        score += 30;
      }
      if (
        filters.specialization &&
        normalizeText(filters.specialization) === normalizeText(doctor.specialization)
      ) {
        score += 20;
      }

      return {
        ...doctor,
        matchedSpecialty: matchedSpecialty || null,
        ...buildDoctorRationale(doctor, Math.round(score), matchedSpecialty),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  await auditService.recordAuditEvent({
    user,
    action: "intelligence.doctor_recommendations",
    entityType: "doctor",
    entityId: "collection",
    metadata: {
      careNeed: filters.careNeed || null,
      recommendations: ranked.length,
    },
    context,
  });

  return {
    recommendations: ranked,
    recommendedSpecializations,
  };
}

async function runSymptomCheck(user, payload, context) {
  const symptoms = payload.symptoms.map(normalizeText).filter(Boolean);
  const recommendedSpecializations = specializationSignals(payload.careNeed, symptoms);
  const redFlags = [];

  if (symptoms.some((item) => item.includes("chest pain"))) {
    redFlags.push("Possible cardiac symptom escalation");
  }
  if (symptoms.some((item) => item.includes("shortness of breath") || item.includes("breathing"))) {
    redFlags.push("Respiratory compromise indicator");
  }
  if (symptoms.some((item) => item.includes("faint") || item.includes("unconscious"))) {
    redFlags.push("Altered consciousness warning");
  }

  let triage = "routine";
  if (payload.severity === "severe" || redFlags.length >= 2) {
    triage = "emergency";
  } else if (payload.severity === "moderate" || redFlags.length === 1) {
    triage = "urgent";
  }

  const result = {
    triage,
    redFlags,
    recommendedSpecializations:
      recommendedSpecializations.length ? recommendedSpecializations : ["General Medicine"],
    summary:
      triage === "emergency"
        ? "Seek emergency assessment immediately or book the earliest emergency slot."
        : triage === "urgent"
          ? "Arrange a same-day or next-day consultation with an appropriate specialist."
          : "Schedule a routine consultation and monitor symptoms for worsening.",
    disclaimer:
      "This rules-based symptom triage is a clinical support placeholder and not a diagnosis engine.",
  };

  await auditService.recordAuditEvent({
    user,
    action: "intelligence.symptom_check",
    entityType: "symptom_check",
    entityId: user.id,
    metadata: {
      triage,
      symptomCount: symptoms.length,
      severity: payload.severity,
    },
    context,
  });

  return result;
}

function classifyFollowUp(item) {
  const dueAt = new Date(item.followUpDueAt);
  const now = new Date();
  const diffDays = Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    ...item,
    status: diffDays < 0 ? "overdue" : diffDays <= 7 ? "due_soon" : "scheduled_later",
    daysUntilDue: diffDays,
  };
}

async function getFollowUpReminders(user) {
  const items = await intelligenceRepository.listFollowUpCandidates({
    hospitalId: user.hospitalId,
    patientId: user.role === "patient" ? user.patientProfileId : undefined,
  });

  return items.map(classifyFollowUp).filter((item) => item.status !== "scheduled_later").slice(0, 20);
}

function scoreAppointmentRisk(item) {
  let riskScore = 10;

  riskScore += Number(item.noShowCount || 0) * 25;
  riskScore += Number(item.pendingPayments || 0) * 12;

  if (item.priority === "urgent") riskScore += 8;
  if (item.priority === "routine") riskScore += 5;

  const riskLevel = riskScore >= 60 ? "high" : riskScore >= 35 ? "medium" : "low";

  return {
    ...item,
    riskScore,
    riskLevel,
  };
}

async function getPredictiveInsights(user) {
  if (!["admin", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Predictive insights are restricted to hospital operations roles");
  }

  const riskItems = (await intelligenceRepository.listUpcomingAppointmentsForRisk(user.hospitalId))
    .map(scoreAppointmentRisk)
    .sort((a, b) => b.riskScore - a.riskScore);

  return {
    summary: {
      totalUpcoming: riskItems.length,
      highRiskAppointments: riskItems.filter((item) => item.riskLevel === "high").length,
      mediumRiskAppointments: riskItems.filter((item) => item.riskLevel === "medium").length,
    },
    appointments: riskItems.slice(0, 12),
  };
}

module.exports = {
  getDoctorRecommendations,
  runSymptomCheck,
  getFollowUpReminders,
  getPredictiveInsights,
};

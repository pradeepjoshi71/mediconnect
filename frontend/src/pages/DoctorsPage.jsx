import { Search, SlidersHorizontal, Sparkles, Star, Stethoscope, Award, Activity, Heart, Shield, Landmark } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listDoctors } from "../services/doctorService";
import { getDoctorRecommendations } from "../services/intelligenceService";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { KpiCard } from "../components/ui/KpiCard";
import { Skeleton } from "../components/ui/Skeleton";
import { formatCurrency } from "../utils/formatters";

const getInitials = (name) => {
  if (!name) return "DR";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

function DoctorsListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden glass-panel border-white/70 bg-white/85 dark:border-slate-800 dark:bg-slate-950/80 p-6 space-y-4 animate-pulse">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
            <Skeleton className="h-14 w-14 rounded-3xl" />
          </div>
          <div className="grid gap-3 grid-cols-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </div>
  );
}

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [specialization, setSpecialization] = useState("");
  const [careNeed, setCareNeed] = useState("");
  const [sort, setSort] = useState("rating");
  const [minExperience, setMinExperience] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendedSpecializations, setRecommendedSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listDoctors({
        search: deferredSearch,
        specialization,
        sort,
        minExperience,
      }),
      getDoctorRecommendations({
        search: deferredSearch,
        careNeed,
        specialization,
        minExperience,
      }),
    ])
      .then(([doctorData, recommendationData]) => {
        setDoctors(doctorData);
        setRecommendations(recommendationData.recommendations || []);
        setRecommendedSpecializations(recommendationData.recommendedSpecializations || []);
      })
      .catch(() => toast.error("Unable to load doctors"))
      .finally(() => setLoading(false));
  }, [careNeed, deferredSearch, specialization, sort, minExperience]);

  const specializations = Array.from(
    new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))
  );

  // Compute metrics from the active list
  const totalClinicians = doctors.length;
  const highRatedCount = doctors.filter((d) => (d.rating || 0) >= 4.5).length;
  const avgExperience = doctors.length
    ? Math.round(doctors.reduce((sum, d) => sum + (d.experienceYears || d.years_experience || 0), 0) / doctors.length)
    : 0;
  const activeSpecialties = new Set(doctors.map((d) => d.specialization).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Doctor discovery"
        title="Find the right clinician for every visit"
        description="Search doctors by specialty, experience, fee, and quality score, then use recommendation support to route patients faster."
      />

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Clinicians"
          value={totalClinicians}
          icon={Stethoscope}
          accent="brand"
        />
        <KpiCard
          label="High-Rated Doctors (4.5+)"
          value={highRatedCount}
          icon={Star}
          accent="amber"
        />
        <KpiCard
          label="Average Experience"
          value={`${avgExperience} Years`}
          icon={Award}
          accent="success"
        />
        <KpiCard
          label="Active Specialties"
          value={activeSpecialties}
          icon={Activity}
          accent="teal"
        />
      </div>

      {/* Filters Card */}
      <Card className="glass-panel border-white/70 dark:border-slate-800/80 p-5 rounded-[24px]">
        <CardContent className="p-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.1fr_0.9fr_0.8fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-11"
              placeholder="Search doctor or department..."
            />
          </div>
          <Input
            value={careNeed}
            onChange={(event) => setCareNeed(event.target.value)}
            placeholder="Symptom, condition or care need..."
          />
          <div>
            <select
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500/70"
            >
              <option value="">All specialties</option>
              {specializations.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            min="0"
            value={minExperience}
            onChange={(event) => setMinExperience(Number(event.target.value))}
            placeholder="Min years experience"
          />
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500/70"
            >
              <option value="rating">Sort by rating</option>
              <option value="experience">Sort by experience</option>
              <option value="fee">Sort by fee</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation Engine Alert Box */}
      <Card className="rounded-[24px] border border-brand-100/50 bg-brand-50/10 p-5 dark:border-brand-950/20 dark:bg-brand-950/5">
        <CardHeader className="p-0 pb-4 flex flex-row items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600 animate-pulse-subtle" />
          <CardTitle className="text-base font-bold text-brand-900 dark:text-brand-300">Clinician Recommendation Engine</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            {recommendedSpecializations.length ? (
              recommendedSpecializations.map((item) => (
                <Badge key={item} tone="brand">
                  {item}
                </Badge>
              ))
            ) : (
              <Badge tone="slate">General triage</Badge>
            )}
          </div>

          {recommendations.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {recommendations.slice(0, 3).map((doctor) => (
                <Card key={`recommended-${doctor.id}`} className="border-brand-200/50 dark:border-brand-900/40 hover-glow transition-all duration-300 bg-white/60 dark:bg-neutral-100/5 rounded-2xl">
                  <CardContent className="p-4.5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {doctor.fullName}
                        </div>
                        <div className="mt-1 text-xxs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          {doctor.department}
                        </div>
                      </div>
                      <Badge tone="teal">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {doctor.score}% match
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <Badge tone="brand" className="scale-95 origin-left">{doctor.specialization}</Badge>
                      {doctor.matchedSpecialty && (
                        <Badge tone="amber" className="scale-95 origin-left">Matched care path</Badge>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {doctor.rationale}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Recommendation engine ready"
              description="Enter conditions or symptoms above to filter best-matched doctors."
            />
          )}
        </CardContent>
      </Card>

      {/* Main Doctors List / Grid */}
      {loading ? (
        <DoctorsListSkeleton />
      ) : doctors.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="overflow-hidden glass-panel border-slate-200 bg-white/60 dark:border-neutral-200/5 dark:bg-neutral-100/10 hover-glow transition-all duration-300 rounded-[24px]">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                      {doctor.fullName}
                    </h4>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Badge tone="brand">{doctor.specialization}</Badge>
                      <Badge tone="teal">{doctor.department}</Badge>
                    </div>
                  </div>
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-tealish-500 font-extrabold text-lg text-white shadow-premium-glow">
                    {getInitials(doctor.fullName)}
                    <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-50" />
                  </div>
                </div>

                <div className="grid gap-3 grid-cols-3">
                  <MetricCard label="Experience" value={`${doctor.experienceYears || doctor.years_experience || 0} Yrs`} icon={Award} />
                  <MetricCard
                    label="Quality Rating"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {doctor.rating}
                      </span>
                    }
                    icon={Star}
                  />
                  <MetricCard label="Consultation Fee" value={formatCurrency(doctor.consultationFeeCents || (doctor.consultation_fee * 100))} icon={Landmark} />
                </div>

                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {doctor.biography ||
                    "Experienced clinical expert offering comprehensive inpatient and outpatient consultations."}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No clinicians match your query"
          description="Try relaxing your experience thresholds, sorting variables, or search queries."
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-neutral-200/5 dark:bg-neutral-100/5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-black text-slate-800 dark:text-slate-200">
        {value}
      </div>
    </div>
  );
}

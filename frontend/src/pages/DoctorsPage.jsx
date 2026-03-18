import { Search, SlidersHorizontal, Star } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listDoctors } from "../services/doctorService";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency } from "../utils/formatters";

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [specialization, setSpecialization] = useState("");
  const [sort, setSort] = useState("rating");
  const [minExperience, setMinExperience] = useState(0);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    listDoctors({
      search: deferredSearch,
      specialization,
      sort,
      minExperience,
    })
      .then(setDoctors)
      .catch(() => toast.error("Unable to load doctors"));
  }, [deferredSearch, specialization, sort, minExperience]);

  const specializations = Array.from(
    new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Doctor discovery"
        title="Find the right clinician for every visit"
        description="Search doctors by specialty, experience, fee, and quality score before booking an appointment."
      />

      <Card>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-11" placeholder="Search by doctor name, specialty, or department" />
          </div>
          <select value={specialization} onChange={(event) => setSpecialization(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <option value="">All specialties</option>
            {specializations.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Input type="number" min="0" value={minExperience} onChange={(event) => setMinExperience(event.target.value)} placeholder="Minimum years" />
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <option value="rating">Sort by rating</option>
              <option value="experience">Sort by experience</option>
              <option value="fee">Sort by fee</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {doctors.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="overflow-hidden">
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                      {doctor.fullName}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{doctor.specialization}</Badge>
                      <Badge tone="teal">{doctor.department}</Badge>
                    </div>
                  </div>
                  <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-tealish-600 text-lg font-black text-white">
                    {doctor.fullName?.charAt(0)}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Experience" value={`${doctor.experienceYears} years`} />
                  <Metric label="Rating" value={<span className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />{doctor.rating}</span>} />
                  <Metric label="Fee" value={formatCurrency(doctor.consultationFeeCents)} />
                </div>
                <div className="text-sm leading-7 text-slate-600 dark:text-slate-400">
                  {doctor.biography || "Experienced clinician available for inpatient and outpatient consultations."}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No doctors match your filters" description="Try broadening the search by specialty or experience." />
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/60">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-lg font-black tracking-tight text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

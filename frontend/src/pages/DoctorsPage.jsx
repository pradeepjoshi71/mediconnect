import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { listDoctors } from "../services/doctorService";

export default function DoctorsPage() {
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await listDoctors({ search, specialization });
        if (mounted) setDoctors(data);
      } catch {
        toast.error("Failed to load doctors");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [search, specialization]);

  const specializations = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Find a doctor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">All specializations</option>
              {specializations.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          </>
        ) : doctors.length ? (
          doctors.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              <CardContent className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-base font-extrabold tracking-tight">{d.full_name}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {d.specialization} • {d.experience_years} yrs • ⭐ {d.rating}
                  </div>
                  {d.bio ? (
                    <div className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                      {d.bio}
                    </div>
                  ) : null}
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                  {(d.full_name || "D")[0]?.toUpperCase()}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
            No doctors match that search yet.
          </div>
        )}
      </div>
    </div>
  );
}


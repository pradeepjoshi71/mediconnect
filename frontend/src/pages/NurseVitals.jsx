import { Activity, Plus, Heart, Flame } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function NurseVitals() {
  const [vitals, setVitals] = useState([
    { id: 1, patient: "Maya Rao", BP: "128/82", pulse: "76 bpm", temp: "98.6°F", date: "2026-06-07 16:00" },
    { id: 2, patient: "Rohan Das", BP: "120/80", pulse: "72 bpm", temp: "99.1°F", date: "2026-06-07 15:30" }
  ]);

  const [form, setForm] = useState({ patient: "Maya Rao", BP: "", pulse: "", temp: "" });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.BP || !form.pulse || !form.temp) {
      toast.error("Please fill in all vitals fields");
      return;
    }
    const newVital = {
      id: Date.now(),
      patient: form.patient,
      BP: form.BP,
      pulse: form.pulse,
      temp: form.temp,
      date: new Date().toLocaleString()
    };
    setVitals([newVital, ...vitals]);
    setForm({ patient: "Maya Rao", BP: "", pulse: "", temp: "" });
    toast.success("Vitals documented successfully");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clinical Charts"
        title="Vitals Tracking Console"
        description="Record blood pressures, cardiovascular pulse rates, and core temperatures into clinical charts."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Vitals Logs History
          </h2>
          <PaginatedTable
            rows={vitals}
            pageSize={5}
            columns={[
              { key: "patient", label: "Patient" },
              { key: "BP", label: "BP (mmHg)" },
              { key: "pulse", label: "Pulse Rate" },
              { key: "temp", label: "Temperature" },
              { key: "date", label: "Logged At" }
            ]}
          />
        </div>

        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Document Vitals Entry
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Patient Profile
              </div>
              <select
                value={form.patient}
                onChange={(e) => setForm({ ...form, patient: e.target.value })}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="Maya Rao">Maya Rao</option>
                <option value="Rohan Das">Rohan Das</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Blood Pressure (e.g. 120/80)
              </div>
              <Input
                value={form.BP}
                onChange={(e) => setForm({ ...form, BP: e.target.value })}
                placeholder="120/80"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Pulse Rate (e.g. 72 bpm)
              </div>
              <Input
                value={form.pulse}
                onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                placeholder="72 bpm"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Body Temperature (e.g. 98.6°F)
              </div>
              <Input
                value={form.temp}
                onChange={(e) => setForm({ ...form, temp: e.target.value })}
                placeholder="98.6°F"
              />
            </label>

            <Button type="submit" className="w-full">
              <Plus className="h-4 w-4" /> Save Vitals Log
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

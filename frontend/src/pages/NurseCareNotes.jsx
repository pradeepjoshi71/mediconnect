import { FileText, Plus, PenTool } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function NurseCareNotes() {
  const [notes, setNotes] = useState([
    { id: 1, patient: "Maya Rao", author: "Sister Sarah", note: "Patient complains of minor headache. BP stable. Advised rest.", date: "2026-06-07 15:45" },
    { id: 2, patient: "Rohan Das", author: "Sister Sarah", note: "Wound dressing changed. No active bleeding or redness observed.", date: "2026-06-07 12:30" }
  ]);

  const [form, setForm] = useState({ patient: "Maya Rao", content: "" });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.content.trim()) {
      toast.error("Please enter note details");
      return;
    }
    const newNote = {
      id: Date.now(),
      patient: form.patient,
      author: "Sister Sarah",
      note: form.content,
      date: new Date().toLocaleString()
    };
    setNotes([newNote, ...notes]);
    setForm({ patient: "Maya Rao", content: "" });
    toast.success("Nursing care note added successfully");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Shift Documentation"
        title="Nursing Care Notes & Handover"
        description="Log hourly patient comfort notes, record wound dressing status, and document shift handovers."
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Daily Care Notes History
          </h2>
          <PaginatedTable
            rows={notes}
            pageSize={5}
            columns={[
              { key: "patient", label: "Patient" },
              { key: "note", label: "Care Note Details" },
              { key: "author", label: "Nurse" },
              { key: "date", label: "Logged Date" }
            ]}
          />
        </div>

        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Write Care Plan Note
          </h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Select Patient
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
                Care Plan Note details
              </div>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={5}
                placeholder="Log patient feedback, active dressing details, comfort scales..."
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>

            <Button type="submit" className="w-full">
              <Plus className="h-4 w-4" /> Save Nursing Note
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

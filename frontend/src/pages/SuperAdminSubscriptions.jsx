import { useEffect, useState } from "react";
import {
  CreditCard, Zap, Layers, AlertTriangle, Plus, Pencil, Ban, CheckCircle,
  Building2, ChevronDown, ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";
import subscriptionService from "../services/subscriptionService";
import hospitalService from "../services/hospitalService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency } from "../utils/formatters";

const TABS = ["Plans", "Subscriptions", "Expiring"];

const statusTone = { active: "success", trialing: "warning", expired: "danger", cancelled: "slate" };

function PlanModal({ plan, hospitals, onClose, onSave }) {
  const [form, setForm] = useState(plan || {
    name: "", code: "", priceCents: 0, doctorLimit: "", patientLimit: "",
    storageGb: 5, durationDays: 30, features: {}
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        priceCents: Number(form.priceCents),
        doctorLimit: form.doctorLimit === "" ? null : Number(form.doctorLimit),
        patientLimit: form.patientLimit === "" ? null : Number(form.patientLimit),
        storageGb: Number(form.storageGb),
        durationDays: Number(form.durationDays),
      };
      if (plan?.id) {
        await subscriptionService.updatePlan(plan.id, payload);
        toast.success("Plan updated");
      } else {
        await subscriptionService.createPlan(payload);
        toast.success("Plan created");
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-950 shadow-2xl p-7 space-y-5">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">
          {plan?.id ? "Edit Plan" : "New Plan"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block col-span-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Plan Name</span>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Professional" required className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Code</span>
              <Input value={form.code} onChange={e => set("code", e.target.value.toLowerCase())} placeholder="pro" required className="mt-1" disabled={!!plan?.id} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Price (paise)</span>
              <Input type="number" value={form.priceCents} onChange={e => set("priceCents", e.target.value)} placeholder="999900" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Doctor Limit (blank=∞)</span>
              <Input type="number" value={form.doctorLimit} onChange={e => set("doctorLimit", e.target.value)} placeholder="50" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Patient Limit (blank=∞)</span>
              <Input type="number" value={form.patientLimit} onChange={e => set("patientLimit", e.target.value)} placeholder="2000" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Storage (GB)</span>
              <Input type="number" value={form.storageGb} onChange={e => set("storageGb", e.target.value)} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Duration (days)</span>
              <Input type="number" value={form.durationDays} onChange={e => set("durationDays", e.target.value)} className="mt-1" />
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">Save</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ hospitals, plans, onClose, onSave }) {
  const [hospitalId, setHospitalId] = useState("");
  const [planId, setPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hospitalId || !planId) return toast.error("Select hospital and plan");
    setSaving(true);
    try {
      await subscriptionService.assignPlan(Number(hospitalId), Number(planId), notes);
      toast.success("Plan assigned successfully");
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || "Assignment failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-950 shadow-2xl p-7 space-y-5">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">Assign Plan to Hospital</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hospital</span>
            <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} required
              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
              <option value="">Select hospital…</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} ({h.code})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Plan</span>
            <select value={planId} onChange={e => setPlanId(e.target.value)} required
              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
              <option value="">Select plan…</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.priceCents === 0 ? "Free" : formatCurrency(p.priceCents)}/mo</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Notes (optional)</span>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contract ref, discount reason…" className="mt-1" />
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">Assign</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuperAdminSubscriptions() {
  const [tab, setTab] = useState("Plans");
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planModal, setPlanModal] = useState(null); // null | {} | existing plan
  const [assignModal, setAssignModal] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, s, e, h] = await Promise.all([
        subscriptionService.getPlans(true),
        subscriptionService.getSubscriptions(),
        subscriptionService.getExpiring(14),
        hospitalService.listHospitals(),
      ]);
      setPlans(p.plans || []);
      setSubscriptions(s.subscriptions || []);
      setExpiring(e.subscriptions || []);
      setHospitals(h.hospitals || []);
    } catch { toast.error("Failed to load subscription data"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  const activeSubs = subscriptions.filter(s => s.status === "active").length;
  const trialSubs  = subscriptions.filter(s => s.status === "trialing").length;

  async function togglePlan(plan) {
    try {
      if (plan.isActive) {
        await subscriptionService.disablePlan(plan.id);
        toast.success(`"${plan.name}" disabled`);
      } else {
        await subscriptionService.enablePlan(plan.id);
        toast.success(`"${plan.name}" enabled`);
      }
      loadAll();
    } catch { toast.error("Failed to update plan"); }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="SaaS Management"
        title="Subscriptions & Licensing"
        description="Manage plan catalogue, assign plans to hospital tenants, and monitor renewals."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Layers}        label="Active Plans"       value={plans.filter(p => p.isActive).length} helper="In catalogue" accent="brand" />
        <StatCard icon={CheckCircle}   label="Active Subscriptions" value={activeSubs} helper="Paid tenants" accent="success" />
        <StatCard icon={AlertTriangle} label="Expiring (14d)"     value={expiring.length} helper="Needs renewal" accent="amber" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 dark:bg-slate-900/60 p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}>{t}{t === "Expiring" && expiring.length > 0 ? ` (${expiring.length})` : ""}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === "Plans" && (
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Plan Catalogue</h2>
            <Button size="sm" onClick={() => setPlanModal({})}>
              <Plus className="h-4 w-4 mr-1" /> New Plan
            </Button>
          </div>
          <PaginatedTable rows={plans} pageSize={10}
            emptyState={<EmptyState title="No plans" description="Create a plan to get started." />}
            columns={[
              { key: "name", label: "Plan" },
              { key: "code", label: "Code", render: r => <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">{r.code}</span> },
              { key: "priceCents", label: "Price/mo", render: r => r.priceCents === 0 ? <span className="text-emerald-600 font-bold">Free</span> : formatCurrency(r.priceCents) },
              { key: "doctorLimit", label: "Doctors", render: r => r.doctorLimit ?? "∞" },
              { key: "patientLimit", label: "Patients", render: r => r.patientLimit ?? "∞" },
              { key: "storageGb", label: "Storage", render: r => `${r.storageGb} GB` },
              { key: "isActive", label: "Status", render: r => <Badge tone={r.isActive ? "success" : "slate"}>{r.isActive ? "Active" : "Disabled"}</Badge> },
              { key: "actions", label: "Actions", render: r => (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPlanModal(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className={r.isActive ? "text-red-500 border-red-200 hover:bg-red-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"} onClick={() => togglePlan(r)}>
                    {r.isActive ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )},
            ]}
          />
        </div>
      )}

      {/* Subscriptions Tab */}
      {tab === "Subscriptions" && (
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">All Subscriptions</h2>
            <Button size="sm" onClick={() => setAssignModal(true)}>
              <Building2 className="h-4 w-4 mr-1" /> Assign Plan
            </Button>
          </div>
          <PaginatedTable rows={subscriptions} pageSize={10}
            emptyState={<EmptyState title="No subscriptions" description="Assign a plan to a hospital tenant." />}
            columns={[
              { key: "hospitalName", label: "Hospital" },
              { key: "hospitalCode", label: "Code", render: r => <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">{r.hospitalCode}</span> },
              { key: "planName", label: "Plan" },
              { key: "status", label: "Status", render: r => <Badge tone={statusTone[r.status] || "slate"}>{r.status}</Badge> },
              { key: "expiresAt", label: "Expires", render: r => r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("en-IN") : "—" },
              { key: "upgradeRequest", label: "Upgrade Req.", render: r => r.upgradeRequest
                ? <span className="text-amber-600 font-semibold text-xs">⚑ Pending</span>
                : <span className="text-slate-400 text-xs">None</span>
              },
            ]}
          />
        </div>
      )}

      {/* Expiring Tab */}
      {tab === "Expiring" && (
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Expiring within 14 days</h2>
          <PaginatedTable rows={expiring} pageSize={10}
            emptyState={<EmptyState title="No upcoming expirations" description="All subscriptions are healthy." />}
            columns={[
              { key: "hospitalName", label: "Hospital" },
              { key: "hospitalCode", label: "Code", render: r => <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">{r.hospitalCode}</span> },
              { key: "planName", label: "Plan" },
              { key: "status", label: "Status", render: r => <Badge tone={statusTone[r.status] || "slate"}>{r.status}</Badge> },
              { key: "expiresAt", label: "Expires", render: r => new Date(r.expiresAt).toLocaleDateString("en-IN") },
              { key: "daysLeft", label: "Days Left", render: r => (
                <span className={`font-bold ${r.daysLeft <= 3 ? "text-red-500" : "text-amber-500"}`}>{r.daysLeft}d</span>
              )},
            ]}
          />
        </div>
      )}

      {planModal !== null && (
        <PlanModal plan={planModal?.id ? planModal : null} hospitals={hospitals}
          onClose={() => setPlanModal(null)} onSave={() => { setPlanModal(null); loadAll(); }} />
      )}
      {assignModal && (
        <AssignModal hospitals={hospitals} plans={plans.filter(p => p.isActive)}
          onClose={() => setAssignModal(false)} onSave={() => { setAssignModal(false); loadAll(); }} />
      )}
    </div>
  );
}

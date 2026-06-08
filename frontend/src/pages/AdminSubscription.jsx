import { useEffect, useState } from "react";
import {
  CreditCard, Calendar, Users, HardDrive, Zap, Clock, CheckCircle, TrendingUp, Send
} from "lucide-react";
import toast from "react-hot-toast";
import subscriptionService from "../services/subscriptionService";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { EmptyState } from "../components/ui/EmptyState";

const statusTone = { active: "success", trialing: "warning", expired: "danger", cancelled: "slate" };

function UsageBar({ label, used, limit, icon: Icon }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-brand-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <Icon className="h-4 w-4 text-slate-400" /> {label}
        </span>
        <span className="font-bold text-slate-900 dark:text-white">
          {used}{limit ? <span className="text-slate-400 font-normal"> / {limit}</span> : <span className="text-slate-400 font-normal"> / ∞</span>}
        </span>
      </div>
      {limit ? (
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <div className="h-2 w-full rounded-full bg-emerald-400 opacity-40" />
        </div>
      )}
    </div>
  );
}

export default function AdminSubscription() {
  const [sub, setSub] = useState(null);
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [myData, histData] = await Promise.all([
          subscriptionService.getMySubscription(),
          subscriptionService.getMyHistory(),
        ]);
        setSub(myData.subscription);
        setUsage(myData.usage);
        setHistory(histData.history || []);
      } catch {
        toast.error("Failed to load subscription data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUpgradeRequest(e) {
    e.preventDefault();
    if (upgradeMsg.trim().length < 5) return toast.error("Please describe your upgrade needs");
    setSending(true);
    try {
      await subscriptionService.requestUpgrade(upgradeMsg.trim());
      toast.success("Upgrade request submitted to Super Admin");
      setUpgradeMsg("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSending(false);
    }
  }

  const daysLeft = sub?.expiresAt
    ? Math.max(0, Math.ceil((new Date(sub.expiresAt) - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Subscription & Plan"
        description="View your current plan limits, usage metrics, and request an upgrade."
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="text-sm font-semibold text-slate-500 animate-pulse">Loading subscription…</div>
        </div>
      ) : !sub ? (
        <EmptyState title="No active subscription" description="Contact Super Admin to assign a plan to your hospital." />
      ) : (
        <>
          {/* Current Plan Card */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="col-span-1 md:col-span-2 rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300 mb-1">Current Plan</div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white">{sub.planName}</div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge tone={statusTone[sub.status] || "slate"}>{sub.status}</Badge>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Code:</span> {sub.planCode}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {sub.priceCents === 0
                    ? <div className="text-2xl font-black text-emerald-500">Free</div>
                    : <div className="text-2xl font-black text-slate-900 dark:text-white">
                        ₹{(sub.priceCents / 100).toLocaleString("en-IN")}<span className="text-sm font-normal text-slate-400">/mo</span>
                      </div>
                  }
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-5 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Started</div>
                    <div className="font-semibold">{new Date(sub.startedAt).toLocaleDateString("en-IN")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expires</div>
                    <div className={`font-semibold ${daysLeft !== null && daysLeft <= 7 ? "text-red-500" : ""}`}>
                      {new Date(sub.expiresAt).toLocaleDateString("en-IN")}
                      {daysLeft !== null && <span className="ml-1 text-xs">({daysLeft}d)</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <HardDrive className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Storage</div>
                    <div className="font-semibold">{sub.storageGb} GB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upgrade Request */}
            <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70 flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mb-1">
                  <TrendingUp className="h-4 w-4 text-brand-500" /> Request Upgrade
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Describe your needs and a Super Admin will contact you.
                </p>
              </div>
              {sub.upgradeRequest ? (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                  <div className="font-bold mb-1">⚑ Request Pending</div>
                  {sub.upgradeRequest}
                </div>
              ) : (
                <form onSubmit={handleUpgradeRequest} className="space-y-3 flex flex-col flex-1">
                  <textarea
                    value={upgradeMsg}
                    onChange={e => setUpgradeMsg(e.target.value)}
                    placeholder="E.g. We need the Professional plan — expecting 100+ doctors by Q3…"
                    rows={4}
                    className="w-full flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950 resize-none"
                  />
                  <Button type="submit" size="sm" loading={sending} className="w-full">
                    <Send className="h-3.5 w-3.5 mr-1" /> Send Request
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Usage Summary */}
          {usage && (
            <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70 space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Usage Summary</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <UsageBar label="Doctors" used={usage.doctorCount} limit={sub.doctorLimit} icon={Users} />
                <UsageBar label="Patients" used={usage.patientCount} limit={sub.patientLimit} icon={Users} />
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Subscription History</h2>
            <PaginatedTable rows={history} pageSize={5}
              emptyState={<EmptyState title="No history" description="Subscription changes will appear here." />}
              columns={[
                { key: "planName", label: "Plan" },
                { key: "status", label: "Status", render: r => <Badge tone={statusTone[r.status] || "slate"}>{r.status}</Badge> },
                { key: "startedAt", label: "Started", render: r => new Date(r.startedAt).toLocaleDateString("en-IN") },
                { key: "expiresAt", label: "Expired", render: r => r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("en-IN") : "—" },
                { key: "notes", label: "Notes", render: r => <span className="text-xs text-slate-500">{r.notes || "—"}</span> },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

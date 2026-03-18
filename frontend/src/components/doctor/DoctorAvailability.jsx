import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import {
  addMyTimeOff,
  getMyAvailabilityRules,
  listMyTimeOff,
  setMyAvailabilityRules,
} from "../../services/availabilityService";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultRules() {
  // Mon-Fri 09:00-17:00, 30m
  return [1, 2, 3, 4, 5].map((wd) => ({
    weekday: wd,
    startTime: "09:00",
    endTime: "17:00",
    slotMinutes: 30,
  }));
}

export default function DoctorAvailability() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [offForm, setOffForm] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([getMyAvailabilityRules(), listMyTimeOff()]);
      setRules(r.length ? r.map(mapRuleFromApi) : defaultRules());
      setTimeOff(o);
    } catch {
      toast.error("Failed to load availability");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function mapRuleFromApi(r) {
    const toHHMM = (t) => String(t).slice(0, 5);
    return {
      weekday: r.weekday,
      startTime: toHHMM(r.start_time),
      endTime: toHHMM(r.end_time),
      slotMinutes: Number(r.slot_minutes),
    };
  }

  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of rules) {
      const key = r.weekday;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return m;
  }, [rules]);

  async function save() {
    setSaving(true);
    try {
      await setMyAvailabilityRules(rules);
      toast.success("Availability saved");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addOff(e) {
    e.preventDefault();
    try {
      await addMyTimeOff({
        startsAt: new Date(offForm.startsAt).toISOString(),
        endsAt: new Date(offForm.endsAt).toISOString(),
        reason: offForm.reason || undefined,
      });
      toast.success("Time off added");
      setOffForm({ startsAt: "", endsAt: "", reason: "" });
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.message || "Failed to add time off");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Availability</CardTitle>
        <CardDescription>Define weekly hours and time-off blocks for booking.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : (
          <>
            <div className="space-y-4">
              <div className="text-sm font-semibold">Weekly rules</div>
              <div className="space-y-3">
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
                  <div
                    key={wd}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold">{weekdayLabels[wd]}</div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRules((prev) => [
                            ...prev,
                            { weekday: wd, startTime: "09:00", endTime: "17:00", slotMinutes: 30 },
                          ])
                        }
                      >
                        Add window
                      </Button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(grouped.get(wd) || []).map((r, idx) => (
                        <div key={`${wd}-${idx}`} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                          <Input
                            type="time"
                            value={r.startTime}
                            onChange={(e) =>
                              setRules((prev) =>
                                prev.map((x) =>
                                  x === r ? { ...x, startTime: e.target.value } : x
                                )
                              )
                            }
                          />
                          <Input
                            type="time"
                            value={r.endTime}
                            onChange={(e) =>
                              setRules((prev) =>
                                prev.map((x) => (x === r ? { ...x, endTime: e.target.value } : x))
                              )
                            }
                          />
                          <select
                            value={r.slotMinutes}
                            onChange={(e) =>
                              setRules((prev) =>
                                prev.map((x) =>
                                  x === r ? { ...x, slotMinutes: Number(e.target.value) } : x
                                )
                              )
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
                          >
                            {[15, 20, 30, 45, 60].map((m) => (
                              <option key={m} value={m}>
                                {m} min
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="ghost"
                            onClick={() => setRules((prev) => prev.filter((x) => x !== r))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      {!grouped.get(wd)?.length ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          No booking windows.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={save} loading={saving}>
                  Save availability
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Time off</div>
              <form onSubmit={addOff} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <Input
                  type="datetime-local"
                  value={offForm.startsAt}
                  onChange={(e) => setOffForm((p) => ({ ...p, startsAt: e.target.value }))}
                  required
                />
                <Input
                  type="datetime-local"
                  value={offForm.endsAt}
                  onChange={(e) => setOffForm((p) => ({ ...p, endsAt: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Reason (optional)"
                  value={offForm.reason}
                  onChange={(e) => setOffForm((p) => ({ ...p, reason: e.target.value }))}
                />
                <Button type="submit" variant="secondary">
                  Add time off
                </Button>
              </form>

              {timeOff.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400">
                        <th className="py-2">Starts</th>
                        <th className="py-2">Ends</th>
                        <th className="py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeOff.slice(0, 10).map((o) => (
                        <tr
                          key={o.id}
                          className="border-t border-slate-200/70 dark:border-slate-800/60"
                        >
                          <td className="py-3">{format(new Date(o.starts_at), "PP p")}</td>
                          <td className="py-3">{format(new Date(o.ends_at), "PP p")}</td>
                          <td className="py-3">{o.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                  No time off scheduled.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


import { Calendar, Clock, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { bookAppointment } from "../services/appointmentService";
import { listDoctors } from "../services/doctorService";
import { getDoctorSlots } from "../services/availabilityService";
import { createCheckout, markPaid } from "../services/paymentService";
import { cn } from "../utils/cn";
import SlotsCalendarPicker from "../components/booking/SlotsCalendarPicker";

function formatDateInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function BookingPage() {
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(() => formatDateInput(new Date()));
  const [slotIso, setSlotIso] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState("stripe");
  const [payment, setPayment] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    listDoctors()
      .then((d) => mounted && setDoctors(d))
      .catch(() => toast.error("Failed to load doctors"))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => String(d.id) === String(doctorId)),
    [doctors, doctorId]
  );

  useEffect(() => {
    let mounted = true;
    async function loadSlots() {
      setSlots([]);
      setSlotIso("");
      setPayment(null);
      setCheckoutUrl("");
      if (!doctorId || !date) return;
      setSlotsLoading(true);
      try {
        const s = await getDoctorSlots(doctorId, date);
        if (mounted) setSlots(s);
      } catch (e) {
        toast.error(e.response?.data?.message || "Failed to load slots");
      } finally {
        if (mounted) setSlotsLoading(false);
      }
    }
    loadSlots();
    return () => {
      mounted = false;
    };
  }, [doctorId, date]);

  const startsAt = useMemo(() => {
    if (!slotIso) return null;
    return new Date(slotIso);
  }, [slotIso]);

  const endsAt = useMemo(() => {
    if (!startsAt) return null;
    return new Date(startsAt.getTime() + 30 * 60 * 1000);
  }, [startsAt]);

  const canSubmit = Boolean(doctorId && startsAt && endsAt);

  async function onConfirm() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const booked = await bookAppointment({
        doctorId: Number(doctorId),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: reason.trim() || undefined,
      });
      toast.success("Appointment requested.");
      setSlotIso("");
      setReason("");
      // optional: immediately create a placeholder checkout
      const checkout = await createCheckout({
        appointmentId: booked.appointment.id,
        provider: paymentProvider,
      });
      setPayment(checkout.payment);
      setCheckoutUrl(checkout.checkoutUrl);
    } catch (e) {
      toast.error(e.response?.data?.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Book an appointment</CardTitle>
            <CardDescription>Select a doctor, date and time slot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-sm font-semibold">Doctor</div>
                <div className="relative">
                  <Stethoscope className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
                    disabled={loading}
                  >
                    <option value="">Select a doctor</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} — {d.specialization}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-semibold">Date</div>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Time slots</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Based on doctor availability
                </div>
              </div>
              {slotsLoading ? (
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
              ) : slots.length ? (
                <SlotsCalendarPicker slots={slots} selected={slotIso} onSelect={setSlotIso} />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                  No slots available for this date.
                </div>
              )}
            </div>

            <label className="block">
              <div className="mb-1 text-sm font-semibold">Reason (optional)</div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g., follow-up, skin rash, recurring headaches…"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
              />
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Review before confirming.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-slate-500 dark:text-slate-400">Doctor</div>
                <div className="font-semibold text-right">
                  {selectedDoctor ? selectedDoctor.full_name : "—"}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-slate-500 dark:text-slate-400">Specialization</div>
                <div className="font-semibold text-right">
                  {selectedDoctor ? selectedDoctor.specialization : "—"}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-slate-500 dark:text-slate-400">When</div>
                <div className="font-semibold text-right">
                  {startsAt ? startsAt.toLocaleString() : "—"}
                </div>
              </div>
            </div>

            <Button className="w-full" loading={submitting} disabled={!canSubmit} onClick={onConfirm}>
              Confirm booking
            </Button>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Availability + time off + double-booking are enforced server-side.
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Payment (placeholder)</div>
                <select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="stripe">Stripe</option>
                  <option value="razorpay">Razorpay</option>
                </select>
              </div>

              {payment ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Checkout URL</div>
                  <div className="break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                    {checkoutUrl}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await markPaid(payment.id);
                        toast.success("Marked paid (demo)");
                      } catch (e2) {
                        toast.error(e2.response?.data?.message || "Failed");
                      }
                    }}
                  >
                    Mark as paid (demo)
                  </Button>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  A demo checkout will be created automatically after booking.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


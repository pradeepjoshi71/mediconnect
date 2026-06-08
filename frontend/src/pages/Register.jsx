import { Building2, UserRound, Mail, Phone, MapPin, Stethoscope, Hash, CheckCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import hospitalService from "../services/hospitalService";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

export default function Register() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    hospitalName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    hospitalType: "General Hospital",
    numberOfDoctors: "10",
  });

  const canSubmit = useMemo(
    () =>
      form.hospitalName.trim().length >= 3 &&
      form.contactPerson.trim().length >= 2 &&
      form.email.includes("@") &&
      form.phone.trim().length >= 5 &&
      form.address.trim().length >= 5 &&
      Number(form.numberOfDoctors) > 0,
    [form]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      await hospitalService.registerHospital({
        hospitalName: form.hospitalName,
        contactPerson: form.contactPerson,
        email: form.email,
        phone: form.phone,
        address: form.address,
        hospitalType: form.hospitalType,
        numberOfDoctors: Number(form.numberOfDoctors)
      });
      toast.success("Registration application submitted!");
      setSuccess(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-shell">
        <div className="absolute inset-0 bg-shell-pattern opacity-80" />
        <div className="relative flex min-h-screen items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-xl p-8 text-center space-y-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                Application Submitted Successfully
              </h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Thank you for registering <strong>{form.hospitalName}</strong> with MediConnect HMS. 
                Our system administrators will review your application details shortly. 
                Upon approval, an invitation email with access credentials will be dispatched to <strong>{form.email}</strong>.
              </p>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
              <Link to="/login">
                <Button className="w-full">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-shell">
      <div className="absolute inset-0 bg-shell-pattern opacity-80" />
      <div className="relative flex min-h-screen items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-2xl p-8">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
            SaaS Portal Onboarding
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Register your clinic or hospital
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Submit your organizational information to register a medical network tenant on MediConnect. 
            Once approved by the Super Admin, your default Hospital Admin credentials will be activated.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block col-span-2">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Hospital Name
                </div>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.hospitalName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, hospitalName: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="MediConnect General Hospital"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Contact Person Name
                </div>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.contactPerson}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contactPerson: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="Dr. Asha Menon"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Hospital Type
                </div>
                <div className="relative">
                  <Stethoscope className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={form.hospitalType}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, hospitalType: event.target.value }))
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <option value="General Hospital">General Hospital</option>
                    <option value="Specialty Clinic">Specialty Clinic</option>
                    <option value="Diagnostic Center">Diagnostic Center</option>
                    <option value="Dental Clinic">Dental Clinic</option>
                  </select>
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Email Address
                </div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="admin@yourhospital.com"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Phone Number
                </div>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="+91-80-4412-3300"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Estimated Number of Doctors
                </div>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="number"
                    min="1"
                    value={form.numberOfDoctors}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, numberOfDoctors: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="15"
                    required
                  />
                </div>
              </label>

              <label className="block col-span-2">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Physical Address
                </div>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/3 h-4 w-4 text-slate-400" />
                  <textarea
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, address: event.target.value }))
                    }
                    rows={3}
                    placeholder="Enter full physical address..."
                    className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
                    required
                  />
                </div>
              </label>
            </div>

            <Button type="submit" className="w-full" loading={submitting} disabled={!canSubmit}>
              Submit Registration Application
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an active account?{" "}
            <Link
              to="/login"
              className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

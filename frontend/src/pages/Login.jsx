import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login } from "../services/authService";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const canSubmit = useMemo(
    () => form.email.trim().length > 3 && form.password.trim().length > 0,
    [form]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      await login(form);
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-shell">
      <div className="absolute inset-0 bg-shell-pattern opacity-80" />
      <div className="relative mx-auto grid min-h-screen max-w-[1380px] grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
              <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
                Secure hospital command center
              </span>
            </div>

            <h1 className="mt-8 text-balance text-5xl font-black tracking-tight text-slate-950 dark:text-white">
              Enterprise healthcare workflows for clinics, hospitals, and care teams.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
              Manage appointments, clinical documentation, billing, notifications, and doctor
              operations from one production-ready hospital management platform.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              ["EHR ready", "Visit timelines, notes, prescriptions, and reports."],
              ["Doctor workflow", "Queue handling, availability, and consultation capture."],
              ["Operations", "Billing, waitlists, analytics, and real-time updates."],
            ].map(([title, description]) => (
              <Card key={title} className="p-5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-xl p-8">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
              Sign in
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Welcome back to MediConnect
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Demo accounts from the seeded database include:
              <br />
              `admin@mediconnect.local`, `doctor@mediconnect.local`, `patient@mediconnect.local`,
              and `reception@mediconnect.local`
              <br />
              Password: `Password@123`
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Email
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
                    placeholder="name@hospital.com"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Password
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    className="pl-11 pr-11"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <Button type="submit" className="w-full" loading={submitting} disabled={!canSubmit}>
                Sign in
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Need a patient portal account?{" "}
              <Link
                to="/register"
                className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Register here
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

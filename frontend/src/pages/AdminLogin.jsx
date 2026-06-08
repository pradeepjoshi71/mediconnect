import { Building2, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login, logout } from "../services/authService";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useBranding } from "../contexts/BrandingContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loadBrandingByCode } = useBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", hospitalCode: "MCH-BLR" });
  const [hospitalBranding, setHospitalBranding] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadBranding() {
      if (!form.hospitalCode.trim()) return;
      try {
        const b = await loadBrandingByCode(form.hospitalCode.trim());
        if (active) {
          setHospitalBranding(b || null);
        }
      } catch (err) {
        // ignore errors
      }
    }
    loadBranding();
    return () => {
      active = false;
    };
  }, [form.hospitalCode, loadBrandingByCode]);

  const canSubmit = useMemo(
    () => form.email.trim().length > 3 && form.password.trim().length > 0,
    [form]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const data = await login({
        email: form.email,
        password: form.password,
        hospitalCode: form.hospitalCode,
      });

      const isAuthorized =
        data.user?.role === "admin" ||
        data.user?.role === "hospital_admin" ||
        data.user?.role === "super_admin";

      if (isAuthorized) {
        toast.success("Admin signed in successfully");
        if (data.user?.role === "super_admin") {
          navigate("/super-admin");
        } else {
          navigate("/admin");
        }
      } else {
        await logout();
        toast.error("Access denied. Only administrators can sign in here.");
      }
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
                Secure administrator portal
              </span>
            </div>

            <h1 className="mt-8 text-balance text-5xl font-black tracking-tight text-slate-950 dark:text-white">
              Hospital Command & Control Center.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
              Access the administrative core to manage hospital resources, doctors, appointments,
              patient billing, and system operations.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              ["System Control", "Monitor active services, hospital tenant settings, and audits."],
              ["Clinician Management", "Provision and manage doctor profiles and shifts."],
              ["Enterprise Ops", "Configure billing, appointments, and hospital networks."],
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
            <div className="flex items-center gap-3">
              {hospitalBranding?.logoUrl ? (
                <img
                  src={hospitalBranding.logoUrl}
                  alt={`${hospitalBranding.displayName || "Hospital"} Logo`}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
                  Administrator sign in
                </div>
              )}
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Welcome back to {hospitalBranding?.displayName || "MediConnect"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Log in with your administrator credentials to access the command center dashboard.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Hospital code
                </div>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.hospitalCode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, hospitalCode: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="MCH-BLR"
                  />
                </div>
              </label>

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
                    placeholder="admin@hospital.com"
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
              <div>
                Not an administrator?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  Go to Patient Portal
                </Link>
              </div>
              {hospitalBranding?.footerText && (
                <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                  {hospitalBranding.footerText}
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

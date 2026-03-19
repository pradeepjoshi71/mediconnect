import { Building2, Eye, EyeOff, Mail, Phone, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { register } from "../services/authService";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    hospitalCode: "MCH-BLR",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const canSubmit = useMemo(
    () =>
      form.fullName.trim().length >= 2 &&
      form.email.includes("@") &&
      form.password.length >= 8 &&
      form.password === form.confirmPassword,
    [form]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      await register({
        hospitalCode: form.hospitalCode,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      toast.success("Patient account created. You can sign in now.");
      navigate("/login");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to register");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-shell">
      <div className="absolute inset-0 bg-shell-pattern opacity-80" />
      <div className="relative flex min-h-screen items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-2xl p-8">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600 dark:text-brand-300">
            Patient onboarding
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Create your patient portal account
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Doctors, admins, and receptionists are provisioned through admin operations. Patients
            can self-register here for appointments, records, reports, and billing.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
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
                  Full name
                </div>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fullName: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="Maya Rao"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Phone
                </div>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    className="pl-11"
                    placeholder="+91 90000 00000"
                  />
                </div>
              </label>
            </div>

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
                  placeholder="patient@hospital.com"
                />
              </div>
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Password
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    className="pr-11"
                    placeholder="At least 8 characters"
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

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Confirm password
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  placeholder="Repeat the password"
                />
              </label>
            </div>

            <Button type="submit" className="w-full" loading={submitting} disabled={!canSubmit}>
              Create patient account
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have access?{" "}
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

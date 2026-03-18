import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login } from "../services/authService";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

export default function Login() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [form, setForm] = useState({ email: "", password: "" });

  const canSubmit = useMemo(
    () => form.email.trim().length > 3 && form.password.length > 0,
    [form]
  );

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await login({ ...form, rememberMe });
      toast.success("Welcome back.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1200px] grid-cols-1 lg:grid-cols-2">
        <div className="relative hidden overflow-hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-600 to-tealish-600" />
          <div className="absolute inset-0 bg-grid opacity-25" />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div>
              <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2 backdrop-blur">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-bold tracking-tight">MediConnect</div>
                  <div className="text-xs text-white/80">Secure healthcare scheduling</div>
                </div>
              </div>

              <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight">
                Care, connected.
                <span className="block text-white/85">Appointments that feel premium.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm text-white/80">
                A modern healthcare SaaS experience with role-based dashboards, real-time
                notifications, and a clean booking flow.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
              <div className="text-sm font-semibold">Tip</div>
              <div className="mt-1 text-sm text-white/80">
                Use your email + password. Your session refreshes automatically.
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Sign in
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Welcome back. Please enter your details.
              </div>
            </div>

            <Card className="p-6">
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Email
                  </div>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="name@clinic.com"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Password
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                      onClick={() => toast("Password reset is a placeholder for now.")}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-200"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Remember me
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Keeps you signed in on this device.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700"
                  />
                </label>

                <Button type="submit" className="w-full" loading={loading} disabled={!canSubmit}>
                  Sign in
                </Button>
              </form>
            </Card>

            <div className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
              Don’t have an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Create one
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

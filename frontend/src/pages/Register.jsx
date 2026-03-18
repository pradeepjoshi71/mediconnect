import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { register } from "../services/authService";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

export default function Register() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const passwordOk = form.password.length >= 8;
  const matchOk = form.password && form.password === form.confirmPassword;
  const canSubmit = useMemo(
    () => form.fullName.trim().length >= 2 && form.email.includes("@") && passwordOk && matchOk,
    [form, passwordOk, matchOk]
  );

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await register({ fullName: form.fullName, email: form.email, password: form.password });
      toast.success("Account created. Please sign in.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1100px] items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Create your account
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Patients can book instantly. Doctors and admins are provisioned by an admin.
            </div>
          </div>

          <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Full name
                </div>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Alex Morgan"
                    className="pl-10"
                    autoComplete="name"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Email
                </div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="name@clinic.com"
                    className="pl-10"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Password
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={show ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="At least 8 characters"
                    className="pl-10 pr-10"
                    autoComplete="new-password"
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
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {passwordOk ? "Looks good." : "Use 8+ characters."}
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Confirm password
                </div>
                <Input
                  type={show ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                />
                {form.confirmPassword ? (
                  <div
                    className={`mt-2 text-xs ${
                      matchOk
                        ? "text-tealish-700 dark:text-tealish-300"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {matchOk ? "Passwords match." : "Passwords don’t match."}
                  </div>
                ) : null}
              </label>

              <Button type="submit" className="w-full" loading={loading} disabled={!canSubmit}>
                Create account
              </Button>
            </form>
          </Card>

          <div className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

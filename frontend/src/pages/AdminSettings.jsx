import { Settings, Shield, Sliders, Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    hospitalName: "MediConnect Bengaluru Hospital",
    slotMinutes: "30",
    timezone: "Asia/Kolkata",
    auditRetention: "3650",
    allowTelemedicine: true,
    billingCurrency: "INR"
  });

  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Hospital configuration updated successfully");
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tenant Setup"
        title="Hospital Parameters & Config"
        description="Configure shift timings, billing currencies, data compliance retention, and basic hospital metadata."
        actions={
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-brand-500" />
              General Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Hospital Display Name
              </div>
              <Input
                value={settings.hospitalName}
                onChange={(e) => setSettings({ ...settings, hospitalName: e.target.value })}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Booking Slot Size
              </div>
              <Select
                value={settings.slotMinutes}
                onChange={(e) => setSettings({ ...settings, slotMinutes: e.target.value })}
                options={[
                  { value: "15", label: "15 Minutes" },
                  { value: "20", label: "20 Minutes" },
                  { value: "30", label: "30 Minutes (Default)" },
                  { value: "45", label: "45 Minutes" },
                  { value: "60", label: "60 Minutes" }
                ]}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                System Timezone
              </div>
              <Input
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-500" />
              Security & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Audit Log Retention (Days)
              </div>
              <Input
                type="number"
                value={settings.auditRetention}
                onChange={(e) => setSettings({ ...settings, auditRetention: e.target.value })}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Billing Currency
              </div>
              <Select
                value={settings.billingCurrency}
                onChange={(e) => setSettings({ ...settings, billingCurrency: e.target.value })}
                options={[
                  { value: "INR", label: "Indian Rupee (₹)" },
                  { value: "USD", label: "US Dollar ($)" },
                  { value: "EUR", label: "Euro (€)" }
                ]}
              />
            </label>

            <div className="flex items-center gap-3 pt-3">
              <input
                type="checkbox"
                id="telemed"
                checked={settings.allowTelemedicine}
                onChange={(e) => setSettings({ ...settings, allowTelemedicine: e.target.checked })}
                className="h-4.5 w-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="telemed" className="text-sm font-semibold text-slate-700 dark:text-slate-300 select-none">
                Enable Telemedicine Video Sessions
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Palette, Image, Type, Save, Eye, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "../services/apiClient";
import { useBranding } from "../contexts/BrandingContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";

const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_SECONDARY = "#14b8a6";

function ColorSwatch({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
        style={{ backgroundColor: color || "#e2e8f0" }}
      />
      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{color || "—"}</span>
    </div>
  );
}

export default function AdminBranding() {
  const { branding, refresh } = useBranding();
  const [form, setForm] = useState({
    displayName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    footerText: "",
  });
  const [saving, setSaving] = useState(false);
  const [previewLogo, setPreviewLogo] = useState("");

  // Populate form from live branding on load
  useEffect(() => {
    setForm({
      displayName:     branding.displayName     || "",
      logoUrl:         branding.logoUrl         || "",
      faviconUrl:      branding.faviconUrl      || "",
      primaryColor:    branding.primaryColor    || DEFAULT_PRIMARY,
      secondaryColor:  branding.secondaryColor  || DEFAULT_SECONDARY,
      footerText:      branding.footerText      || "",
    });
    setPreviewLogo(branding.logoUrl || "");
  }, [branding]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put("/hospitals/branding", form);
      toast.success("Branding saved — changes applied immediately");
      await refresh(); // re-fetch + re-apply CSS vars
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset all branding to MediConnect defaults?")) return;
    setSaving(true);
    try {
      await apiClient.put("/hospitals/branding", {
        displayName: "", logoUrl: "", faviconUrl: "",
        primaryColor: "", secondaryColor: "", footerText: "",
      });
      toast.success("Branding reset to defaults");
      await refresh();
    } catch {
      toast.error("Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="White-Label Settings"
        title="Branding & Appearance"
        description="Customise your hospital's logo, colors, and display name. Changes apply instantly across all portals."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reset Defaults
            </Button>
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4 mr-1" /> Save Branding
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2">

        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-brand-500" /> Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Display Name <span className="font-normal text-slate-400">(shown in sidebar & login)</span>
              </div>
              <Input
                value={form.displayName}
                onChange={e => set("displayName", e.target.value)}
                placeholder="City Heart Hospital"
                maxLength={120}
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Footer Text</div>
              <Input
                value={form.footerText}
                onChange={e => set("footerText", e.target.value)}
                placeholder="© 2026 City Heart Hospital · All rights reserved"
                maxLength={200}
              />
            </label>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-500" /> Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Primary Color</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor || DEFAULT_PRIMARY}
                  onChange={e => set("primaryColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900"
                />
                <Input
                  value={form.primaryColor}
                  onChange={e => set("primaryColor", e.target.value)}
                  placeholder="#3b82f6"
                  maxLength={20}
                  className="font-mono text-sm"
                />
              </div>
              <div className="mt-2"><ColorSwatch color={form.primaryColor} label="Primary" /></div>
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Secondary Color</div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.secondaryColor || DEFAULT_SECONDARY}
                  onChange={e => set("secondaryColor", e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900"
                />
                <Input
                  value={form.secondaryColor}
                  onChange={e => set("secondaryColor", e.target.value)}
                  placeholder="#14b8a6"
                  maxLength={20}
                  className="font-mono text-sm"
                />
              </div>
              <div className="mt-2"><ColorSwatch color={form.secondaryColor} label="Secondary" /></div>
            </label>
          </CardContent>
        </Card>

        {/* Logo & Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-teal-500" /> Logo & Favicon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Logo URL</div>
              <Input
                value={form.logoUrl}
                onChange={e => { set("logoUrl", e.target.value); setPreviewLogo(e.target.value); }}
                placeholder="https://cdn.yourhospital.com/logo.png"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-slate-400">Recommended: SVG or PNG, transparent background, min 200×60px</p>
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Favicon URL</div>
              <Input
                value={form.faviconUrl}
                onChange={e => set("faviconUrl", e.target.value)}
                placeholder="https://cdn.yourhospital.com/favicon.ico"
                maxLength={500}
              />
            </label>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" /> Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mini sidebar mockup */}
            <div
              className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              style={{ fontFamily: "inherit" }}
            >
              <div
                className="flex items-center gap-3 p-4"
                style={{ background: form.primaryColor || DEFAULT_PRIMARY }}
              >
                {previewLogo ? (
                  <img
                    src={previewLogo}
                    alt="Logo preview"
                    className="h-8 object-contain"
                    onError={() => setPreviewLogo("")}
                  />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white text-xs font-bold">
                    {(form.displayName || "M").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-bold text-white">
                  {form.displayName || "Hospital Name"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-3 space-y-1.5">
                {["Dashboard", "Doctors", "Patients", "Subscription"].map(item => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                    style={item === "Dashboard"
                      ? { background: form.primaryColor || DEFAULT_PRIMARY, color: "#fff" }
                      : { color: "#64748b" }
                    }
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ background: item === "Dashboard" ? "#fff" : (form.primaryColor || DEFAULT_PRIMARY) }}
                    />
                    {item}
                  </div>
                ))}
              </div>
              {form.footerText && (
                <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-2 text-[10px] text-slate-400 truncate">
                  {form.footerText}
                </div>
              )}
            </div>

            {/* Color chips */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-3 text-xs font-semibold text-white text-center"
                style={{ background: form.primaryColor || DEFAULT_PRIMARY }}>
                Primary
              </div>
              <div className="flex-1 rounded-xl p-3 text-xs font-semibold text-white text-center"
                style={{ background: form.secondaryColor || DEFAULT_SECONDARY }}>
                Secondary
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

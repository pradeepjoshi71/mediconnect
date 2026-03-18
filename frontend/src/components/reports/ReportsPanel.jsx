import { Download, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { listReports, reportDownloadUrl, uploadReport } from "../../services/reportService";

export default function ReportsPanel() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reports, setReports] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const rows = await listReports();
      setReports(rows);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadReport({ file });
      toast.success("Uploaded");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports</CardTitle>
        <CardDescription>Upload and download patient reports (10MB max).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/50">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload report"}
            <input type="file" className="hidden" onChange={onPick} disabled={uploading} />
          </label>
          <Button variant="ghost" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : reports.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="py-2">File</th>
                  <th className="py-2">Uploaded</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-t border-slate-200/70 dark:border-slate-800/60">
                    <td className="py-3 font-semibold">{r.original_name}</td>
                    <td className="py-3">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <a
                        href={reportDownloadUrl(r.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
            No reports yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

